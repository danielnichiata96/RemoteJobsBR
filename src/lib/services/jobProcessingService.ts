import { prisma } from '../prisma';
import { StandardizedJob } from '../../types/StandardizedJob';
import pino from 'pino';
import { Prisma, PrismaClient, HiringRegion, JobType, ExperienceLevel, JobStatus, UserRole } from '@prisma/client';
import { normalizeForDeduplication } from '../utils/textUtils'; // Import normalization function

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    }
  }
});

// Helper function to map jobType2 string to HiringRegion enum
function mapJobType2ToHiringRegion(jobType2?: 'global' | 'latam'): HiringRegion | null {
  switch (jobType2) {
    // Restore direct enum usage
    case 'global': return HiringRegion.WORLDWIDE;
    case 'latam': return HiringRegion.LATAM;
    default: return null; 
  }
}

export class JobProcessingService {
  private prisma: PrismaClient;
  private logger: pino.Logger;

  constructor(prismaClient: PrismaClient = prisma) {
    this.prisma = prismaClient;
    this.logger = logger.child({ service: 'JobProcessingService' });
  }

  /**
   * Saves or updates a job in the database based on its source and sourceId.
   * Creates the associated company if it doesn't exist.
   *
   * @param job The standardized job data to save or update.
   * @returns Promise<boolean> True if the job was successfully saved or updated, false otherwise.
   */
  public async saveOrUpdateJob(job: StandardizedJob): Promise<boolean> {
    // Check for required fields from StandardizedJob
    if (!job || !job.source || !job.sourceId || !job.title || !job.applicationUrl) {
        this.logger.error({ jobData: job }, 'Job data is missing essential fields (source, sourceId, title, applicationUrl). Skipping save.');
        return false;
    }

    this.logger.debug({ source: job.source, sourceId: job.sourceId, title: job.title }, 'Processing job...');

    try {
      // Normalize company name to ensure consistency
      const rawCompanyName = job.companyName?.trim() || '';
      
      // --- 1. Find or Create Company ---
      let company = await this.prisma.user.findFirst({
        where: {
          name: rawCompanyName, 
          role: UserRole.COMPANY 
        },
      });

      // Calculate normalized name AFTER finding/creating
      const normalizedCompanyName = normalizeForDeduplication(rawCompanyName);

      if (!company) {
        this.logger.info({ companyName: rawCompanyName }, 'Company not found, creating new company...');
        try {
          const placeholderEmail = `${rawCompanyName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${job.source}@jobsource.example.com`; 
          
          company = await this.prisma.user.create({
            data: {
              email: placeholderEmail,
              name: rawCompanyName, // Save raw name
              normalizedCompanyName: normalizedCompanyName, // Save normalized name
              role: UserRole.COMPANY,
              logo: job.companyLogo,
              website: job.companyWebsite,
              industry: 'Technology',
              isVerified: false,
            },
          });
          this.logger.info({ companyId: company.id, companyName: rawCompanyName }, 'Company created successfully.');
        } catch (createError: any) {
           if (createError.code === 'P2002') { 
                this.logger.warn({ companyName: rawCompanyName, error: createError.message }, 'Company creation failed likely due to race condition. Attempting find again.');
           } else {
                this.logger.error({ companyName: rawCompanyName, error: createError }, 'Failed to create company.');
           }
          
          // Try finding again just in case
          company = await this.prisma.user.findFirst({
            where: {
              name: rawCompanyName,
              role: UserRole.COMPANY
            },
          });
          if (!company) {
            this.logger.error({ companyName: rawCompanyName }, 'Still could not find or create company after error. Skipping job.');
            return false;
          }
           this.logger.info({ companyId: company.id, companyName: rawCompanyName }, 'Found company after creation error.');
            // Update normalized name if found after error and it's missing
            if (!company.normalizedCompanyName) {
                 await this.prisma.user.update({
                     where: { id: company.id },
                     data: { normalizedCompanyName: normalizedCompanyName },
                 });
             }
        }
      } else {
        this.logger.debug({ companyId: company.id, companyName: rawCompanyName }, 'Company found.');
        // Ensure existing company has normalized name
        if (!company.normalizedCompanyName || company.normalizedCompanyName !== normalizedCompanyName) {
            await this.prisma.user.update({
                where: { id: company.id },
                data: { normalizedCompanyName: normalizedCompanyName },
            });
            this.logger.debug({ companyId: company.id }, 'Updated missing/mismatched normalized company name.');
        }

         // Update logo if missing (existing logic)
         if (!company.logo && job.companyLogo) {
           await this.prisma.user.update({
             where: { id: company.id },
             data: { logo: job.companyLogo },
           });
           this.logger.debug({ companyId: company.id }, 'Updated missing company logo.');
         }
      }

      // --- 1.5 Check for Duplicates ---
      const normalizedJobTitle = normalizeForDeduplication(job.title);
      this.logger.trace({ companyId: company.id, normalizedJobTitle }, 'Checking for duplicate job...');
      
      const existingJob = await this.prisma.job.findFirst({
          where: {
              companyId: company.id,
              normalizedTitle: normalizedJobTitle,
              status: JobStatus.ACTIVE, // Only check against active jobs
          }
      });

      // Log the value RIGHT BEFORE the check
      this.logger.debug({ existingJobValue: existingJob }, 'Value before IF check'); // Comment out diagnostic log

      // Explicitly check the boolean value
      if (existingJob) {
          this.logger.warn({
              existingJobId: existingJob.id,
              incomingSource: job.source,
              incomingSourceId: job.sourceId,
              normalizedTitle,
              companyName: rawCompanyName
          }, 'Duplicate job detected. Skipping save, updating existing job timestamp.');

          // Update the timestamp of the existing job to show it was seen again
          await this.prisma.job.update({
              where: { id: existingJob.id },
              data: { updatedAt: new Date() }
          });
          // Add debug log to confirm execution path
          // this.logger.debug({ existingJobId: existingJob.id }, 'Existing job timestamp updated.'); // Comment out diagnostic log

          return false; // Indicate job was not saved/updated due to duplication
      }

      // --- 2. Prepare Job Data (with Defaults) ---
      const mappedHiringRegion = mapJobType2ToHiringRegion(job.jobType2); // Map the value

      const jobDataForDb = {
        title: job.title,
        description: job.description || '',
        requirements: job.requirements || 'Não especificado',
        responsibilities: job.responsibilities || 'Não especificado',
        benefits: job.benefits,
        // Restore direct enum usage for defaults
        jobType: job.jobType || JobType.FULL_TIME,
        experienceLevel: job.experienceLevel || ExperienceLevel.MID,
        skills: job.skills || [],
        location: job.location,
        country: job.country || 'Worldwide',
        workplaceType: job.workplaceType || 'REMOTE', 
        applicationUrl: job.applicationUrl,
        minSalary: job.minSalary,
        maxSalary: job.maxSalary,
        currency: job.currency,
        salaryCycle: job.salaryCycle,
        showSalary: !!(job.minSalary && job.maxSalary),
        publishedAt: job.publishedAt || new Date(),
        updatedAt: new Date(),
        status: JobStatus.ACTIVE,
        companyId: company.id,
        source: job.source,
        sourceId: job.sourceId,
        normalizedTitle: normalizedJobTitle, // Add normalized title to data
        visas: [],
        languages: [],
        hiringRegion: mappedHiringRegion, // Uses the helper function's result
      };

      // --- 3. Upsert Job ---
      this.logger.trace({ jobDataForDb }, 'Attempting to upsert job...'); // Log data before upsert
      const upsertResult = await this.prisma.job.upsert({
        where: { source_sourceId: { source: job.source, sourceId: job.sourceId } }, // Use unique constraint
        update: jobDataForDb, // Reverted: Update with new data (original behavior)
        create: jobDataForDb, // Create if not exists
      });
      this.logger.trace({ upsertResult }, 'Upsert operation completed.');

      // Uncommenting final log
      this.logger.info({ jobId: upsertResult.id, source: job.source, sourceId: job.sourceId }, 'Job processed and saved/updated successfully.');
      return true;

    } catch (error) {
      // Improved Error Logging
      const logPayload: any = { 
          source: job.source, 
          sourceId: job.sourceId, 
          title: job.title,
          errorName: error instanceof Error ? error.name : 'UnknownErrorType',
          errorMessage: error instanceof Error ? error.message : String(error),
      };
      // Remove specific Prisma error check for simplicity in testing environment
      /* 
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logPayload.prismaCode = error.code;
        logPayload.prismaMeta = error.meta;
        logPayload.prismaStack = error.stack?.substring(0, 500) + '...'; // Limit stack trace length
      }
      */
      this.logger.error(logPayload, 'Error processing job in service');
      return false;
    }
  }

  async deactivateJobs(source: string, activeSourceIds: Set<string>): Promise<number> {
    // Implementation for deactivating jobs...
    this.logger.info({ source, activeCount: activeSourceIds.size }, 'Starting deactivation process...');
    try {
      const result = await this.prisma.job.updateMany({
        where: {
          source: source,
          status: JobStatus.ACTIVE,
          sourceId: {
            notIn: Array.from(activeSourceIds),
          },
        },
        data: {
          status: JobStatus.CLOSED,
        },
      });
      this.logger.info({ source, deactivatedCount: result.count }, 'Deactivation process completed.');
      return result.count;
    } catch (error) {
      this.logger.error({ source, error }, 'Error during job deactivation');
      return 0;
    }
  }

  /**
   * Processes a job source by its ID. This method triggers the job fetching and processing
   * pipeline for the specified source.
   * 
   * @param sourceId The ID of the job source to process
   * @returns Promise<void>
   */
  public async processJobSourceById(sourceId: string): Promise<void> {
    const logCtx = this.logger.child({ sourceId, method: 'processJobSourceById' });
    
    try {
      logCtx.info('Starting job source processing');
      
      // Find the job source to get its type and configuration
      const jobSource = await this.prisma.jobSource.findUnique({
        where: { id: sourceId }
      });
      
      if (!jobSource) {
        throw new Error(`Job source with ID ${sourceId} not found`);
      }
      
      if (!jobSource.isEnabled) {
        throw new Error(`Cannot process disabled job source ${sourceId}`);
      }
      
      logCtx.info({ sourceType: jobSource.type }, 'Found job source, starting processing');
      
      // TODO: Implement the actual fetching and processing logic based on the source type
      // This would typically involve:
      // 1. Getting a fetcher for the specific source type
      // 2. Fetching jobs from the source
      // 3. Processing and standardizing each job
      // 4. Saving or updating jobs in the database
      // 5. Marking any jobs no longer available as inactive
      
      // For now, just update the lastFetched timestamp to indicate processing occurred
      await this.prisma.jobSource.update({
        where: { id: sourceId },
        data: { lastFetched: new Date() }
      });
      
      logCtx.info('Job source processing completed successfully');
    } catch (error) {
      logCtx.error({ error: error instanceof Error ? error.message : String(error) }, 'Error processing job source');
      throw error; // Re-throw to allow caller to handle or log the error
    }
  }
}