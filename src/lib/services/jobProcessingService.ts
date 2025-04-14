import { prisma } from '../prisma';
import { StandardizedJob } from '../../types/StandardizedJob';
import pino from 'pino';
import { Prisma, PrismaClient, HiringRegion } from '@prisma/client';
import { UserRole, JobType, ExperienceLevel, JobStatus } from '@prisma/client';

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
    case 'global': return HiringRegion.WORLDWIDE;
    case 'latam': return HiringRegion.LATAM;
    // case 'brazil': return HiringRegion.BRAZIL; // If needed later
    default: return null; // Default to null if undefined/unexpected
  }
}

export class JobProcessingService {
  private prisma: PrismaClient;
  private logger: pino.Logger;

  constructor() {
    this.prisma = prisma;
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
      const normalizedCompanyName = job.companyName?.trim() || '';
      
      // --- 1. Find or Create Company ---
      let company = await this.prisma.user.findFirst({
        where: {
          name: normalizedCompanyName,
          role: UserRole.COMPANY 
        },
      });

      if (!company) {
        this.logger.info({ companyName: normalizedCompanyName }, 'Company not found, creating new company...');
        try {
          // Generate a unique placeholder email using company name + source
          const placeholderEmail = `${normalizedCompanyName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${job.source}@jobsource.example.com`; // Generic domain
          
          company = await this.prisma.user.create({
            data: {
              email: placeholderEmail,
              name: normalizedCompanyName,
              role: UserRole.COMPANY,
              logo: job.companyLogo,
              website: job.companyWebsite,
              industry: 'Technology', // Default industry
              isVerified: false, // Companies created via scraping are not verified
            },
          });
          this.logger.info({ companyId: company.id, companyName: normalizedCompanyName }, 'Company created successfully.');
        } catch (createError: any) {
           // Handle potential unique constraint violation on email or name during creation
           if (createError.code === 'P2002') { 
                this.logger.warn({ companyName: normalizedCompanyName, error: createError.message }, 'Company creation failed likely due to race condition (unique constraint). Attempting to find again.');
           } else {
                this.logger.error({ companyName: normalizedCompanyName, error: createError }, 'Failed to create company.');
           }
          
          // Try finding again by name regardless of specific error
          company = await this.prisma.user.findFirst({
            where: {
              name: normalizedCompanyName,
              role: UserRole.COMPANY
            },
          });
          if (!company) {
            this.logger.error({ companyName: normalizedCompanyName }, 'Still could not find or create company after error. Skipping job.');
            return false;
          }
           this.logger.info({ companyId: company.id, companyName: normalizedCompanyName }, 'Found company after creation error.');
        }
      } else {
        this.logger.debug({ companyId: company.id, companyName: normalizedCompanyName }, 'Company found.');
         // Optionally update existing company details (e.g., logo, website) if needed
         // Be cautious about overwriting verified data.
         // Consider adding logic here if we want scraped data to update existing fields.
         if (!company.logo && job.companyLogo) {
           // Update logo if missing on existing record and provided in job data
           await this.prisma.user.update({
             where: { id: company.id },
             data: { logo: job.companyLogo },
           });
           this.logger.debug({ companyId: company.id }, 'Updated missing company logo.');
         }
      }

      // --- 2. Prepare Job Data (with Defaults) ---
      const mappedHiringRegion = mapJobType2ToHiringRegion(job.jobType2); // Map the value

      const jobDataForDb = {
        title: job.title,
        description: job.description || '',
        requirements: job.requirements || 'Não especificado', // Default required (Portuguese)
        responsibilities: job.responsibilities || 'Não especificado', // Default required (Portuguese)
        benefits: job.benefits,
        jobType: job.jobType || JobType.FULL_TIME, // Default required
        experienceLevel: job.experienceLevel || ExperienceLevel.MID, // Default required
        skills: job.skills || [],
        location: job.location,
        country: job.country || 'Worldwide', // Default required
        workplaceType: job.workplaceType || 'REMOTE', // Default required
        applicationUrl: job.applicationUrl, 
        minSalary: job.minSalary, // Use the correct field from StandardizedJob
        maxSalary: job.maxSalary, // Use the correct field from StandardizedJob
        currency: job.currency, // Use the correct field from StandardizedJob
        salaryCycle: job.salaryCycle, // Use the correct field from StandardizedJob
        showSalary: !!(job.minSalary && job.maxSalary), // Check if salary values are present
        publishedAt: job.publishedAt || new Date(), // Default to now if not provided
        updatedAt: new Date(), // Always set updatedAt
        status: JobStatus.ACTIVE, // Always set as ACTIVE when saving a new job
        companyId: company.id, // Link to the found/created company
        source: job.source,
        sourceId: job.sourceId,
        visas: [], // Default empty
        languages: [], // Default empty
        hiringRegion: mappedHiringRegion, // Corrected: Use the mapped enum value or null
      };

      // --- 3. Upsert Job ---
      this.logger.trace({ jobDataForDb }, 'Attempting to upsert job...'); // Log data before upsert
      const upsertResult = await this.prisma.job.upsert({
        where: { source_sourceId: { source: job.source, sourceId: job.sourceId } }, // Use unique constraint
        update: jobDataForDb, // Reverted: Update with new data (original behavior)
        create: jobDataForDb, // Create if not exists
      });
      this.logger.trace({ upsertResult }, 'Upsert operation completed.');

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
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logPayload.prismaCode = error.code;
        logPayload.prismaMeta = error.meta;
        logPayload.prismaStack = error.stack?.substring(0, 500) + '...'; // Limit stack trace length
      }
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
}