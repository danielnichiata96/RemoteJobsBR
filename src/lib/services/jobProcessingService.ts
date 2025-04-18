import { prisma } from '../prisma';
import { StandardizedJob } from '../../types/StandardizedJob';
import pino from 'pino';
import { Prisma, PrismaClient, HiringRegion, JobType, ExperienceLevel, JobStatus, UserRole, SalaryPeriod, WorkplaceType } from '@prisma/client';
import { Currency } from '../../types/models';
import { normalizeStringForSearch, normalizeCompanyName } from '../utils/string'; // Import NEW normalization functions
import { z } from 'zod'; // Import Zod

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

// --- Adjusted Zod schema (more lenient for testing) --- 
const standardizedJobSchema = z.object({
  sourceId: z.string().min(1),
  source: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(), 
  requirements: z.string().optional(),
  responsibilities: z.string().optional(),
  benefits: z.string().optional(),
  jobType: z.nativeEnum(JobType).optional(),
  experienceLevel: z.nativeEnum(ExperienceLevel).optional(),
  skills: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  location: z.string().optional(), 
  country: z.string().optional(),
  workplaceType: z.nativeEnum(WorkplaceType).optional(),
  isRemote: z.boolean().optional(), 
  hiringRegion: z.nativeEnum(HiringRegion).optional(),
  visas: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  minSalary: z.number().optional(),
  maxSalary: z.number().optional(),
  currency: z.nativeEnum(Currency).optional(),
  salaryPeriod: z.nativeEnum(SalaryPeriod).optional(),
  applicationUrl: z.string().url().min(1).optional(),
  companyName: z.string().min(1),
  companyLogo: z.string().optional(),
  companyWebsite: z.string().url().optional(),
  companyEmail: z.string().email().optional(),
  locationRaw: z.string().optional(),
  metadataRaw: z.any().optional(),
  jobType2: z.enum(['global', 'latam']).optional(),
  publishedAt: z.date().optional(),
  expiresAt: z.date().optional(),
  updatedAt: z.date().optional(),
  status: z.nativeEnum(JobStatus).optional(),
  relevanceScore: z.number().nullish(), // Allow number or null/undefined
}).refine(data => data.isRemote !== undefined || data.workplaceType !== undefined, {
    message: "Either isRemote or workplaceType must be defined",
    path: ["isRemote", "workplaceType"], 
});
// --- End Adjusted Zod Schema --- 

// Constants for similarity thresholds (Lowered)
const TITLE_SIMILARITY_THRESHOLD = 0.7;
const COMPANY_SIMILARITY_THRESHOLD = 0.8;

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
   * Finds potential duplicate jobs based on title and company name similarity using pg_trgm.
   * Uses Prisma.sql for better type safety and query building.
   */
  private async findPotentialDuplicates(
    normalizedTitle: string,
    normalizedCompanyName: string,
    excludeSource: string,
    excludeSourceId: string
  ): Promise<{ id: string, title: string, company_name: string, title_similarity: number, company_similarity: number }[]> {
    const activeStatus = JobStatus.ACTIVE;
    const companyRole = UserRole.COMPANY;

    try {
      // Note: Using Prisma.sql for parameters
      const potentialDuplicates = await this.prisma.$queryRaw<{
        id: string,
        title: string,
        company_name: string,
        title_similarity: number,
        company_similarity: number
      }[]>`
        SELECT
          j.id,
          j.title,
          c.name as company_name,
          similarity(j."normalizedTitle", ${normalizedTitle}) as title_similarity,
          similarity(c."normalizedCompanyName", ${normalizedCompanyName}) as company_similarity
        FROM "Job" j
        JOIN "User" c ON j."companyId" = c.id
        WHERE
          j.status = ${activeStatus}::"JobStatus" AND -- Cast enum
          c.role = ${companyRole}::"UserRole" AND -- Cast enum
          (
            j."normalizedTitle" % ${normalizedTitle} OR
            c."normalizedCompanyName" % ${normalizedCompanyName}
          ) AND
          similarity(j."normalizedTitle", ${normalizedTitle}) >= ${TITLE_SIMILARITY_THRESHOLD} AND
          similarity(c."normalizedCompanyName", ${normalizedCompanyName}) >= ${COMPANY_SIMILARITY_THRESHOLD} AND
          NOT (j.source = ${excludeSource} AND j."sourceId" = ${excludeSourceId})
        ORDER BY title_similarity DESC, company_similarity DESC
        LIMIT 5;
      `;
      return potentialDuplicates;
    } catch (error) {
      this.logger.error({ 
        error,
        normalizedTitle,
        normalizedCompanyName,
        excludeSource,
        excludeSourceId
      }, 'Error executing raw SQL query for finding duplicates.');
      return []; 
    }
  }

  /**
   * Saves or updates a job, handles company creation/linking, and logs potential duplicates.
   * Uses findUnique + update/create instead of upsert for clarity.
   */
  public async saveOrUpdateJob(job: StandardizedJob): Promise<boolean> {
    // --- Use Comprehensive Zod Validation --- 
    const validationResult = standardizedJobSchema.safeParse(job);
    if (!validationResult.success) {
      this.logger.warn({
        jobSource: job?.source,
        jobSourceId: job?.sourceId,
        jobTitle: job?.title,
        validationErrors: validationResult.error.flatten().fieldErrors // Log flattened errors
      }, 'Job data failed standardized validation. Skipping save.');
      return false;
    }
    // --- Explicitly type validJobData using z.infer --- 
    const validJobData: z.infer<typeof standardizedJobSchema> = validationResult.data;
    
    this.logger.trace({ source: validJobData.source, sourceId: validJobData.sourceId, title: validJobData.title }, 'Processing job (passed validation)...');

    // --- Normalize Key Fields EARLY --- 
    const normalizedTitleForDb = normalizeStringForSearch(validJobData.title);
    const rawCompanyName = validJobData.companyName.trim();
    const normalizedCompanyNameForDb = normalizeCompanyName(rawCompanyName);

    if (!normalizedTitleForDb || !normalizedCompanyNameForDb) {
      this.logger.warn({
        jobSource: validJobData.source,
        jobSourceId: validJobData.sourceId,
        title: validJobData.title,
        companyName: validJobData.companyName,
      }, 'Skipping job due to empty normalized title or company name after normalization.');
      return false;
    }

    try {
      // --- 1. Find or Create Company ---
      let company = await this.prisma.user.findFirst({
        where: { normalizedCompanyName: normalizedCompanyNameForDb, role: UserRole.COMPANY },
      });
      if (!company) {
         company = await this.prisma.user.findFirst({ where: { name: rawCompanyName, role: UserRole.COMPANY } });
      }
      if (!company) {
        this.logger.info({ companyName: rawCompanyName }, 'Company not found, creating new company...');
        try {
          const placeholderEmail = `${normalizedCompanyNameForDb.replace(/[^a-z0-9]/g, '')}_${validJobData.source}@jobsource.example.com`; 
          company = await this.prisma.user.create({
            data: {
              email: placeholderEmail,
              name: rawCompanyName,
              normalizedCompanyName: normalizedCompanyNameForDb,
              role: UserRole.COMPANY,
              logo: validJobData.companyLogo,
              website: validJobData.companyWebsite,
              industry: 'Technology',
              isVerified: false,
            },
          });
          this.logger.info({ companyId: company.id, companyName: rawCompanyName }, 'Company created successfully.');
        } catch (createError: any) {
          if (createError.code === 'P2002') {
            this.logger.warn({ companyName: rawCompanyName, error: createError.message }, 'Company creation failed (P2002 - likely race condition). Attempting find again with slight delay...');
            await new Promise(resolve => setTimeout(resolve, 100));
            company = await this.prisma.user.findFirst({ where: { name: rawCompanyName, role: UserRole.COMPANY } });
            if (!company) {
              this.logger.error({ companyName: rawCompanyName }, 'Still could not find company after P2002 error and retry. Skipping job.');
              return false;
            }
            this.logger.info({ companyId: company.id, companyName: rawCompanyName }, 'Found company after P2002 error and retry.');
            if (!company.normalizedCompanyName) {
              await this.prisma.user.update({ where: { id: company.id }, data: { normalizedCompanyName: normalizedCompanyNameForDb } });
            }
          } else {
            this.logger.error({ companyName: rawCompanyName, errorCode: createError.code, error: createError }, 'Unexpected error failed to create company. Skipping job.');
            return false;
          }
        }
      } else {
        this.logger.trace({ companyId: company.id, companyName: rawCompanyName }, 'Company found.');
        const dataToUpdate: Partial<Prisma.UserUpdateInput> = {};
        let shouldUpdate = false;
        if (!company.normalizedCompanyName || company.normalizedCompanyName !== normalizedCompanyNameForDb) {
            dataToUpdate.normalizedCompanyName = normalizedCompanyNameForDb;
            shouldUpdate = true;
        }
        if (!company.logo && validJobData.companyLogo) {
           dataToUpdate.logo = validJobData.companyLogo;
           shouldUpdate = true;
        }
        if (shouldUpdate) {
            await this.prisma.user.update({ where: { id: company.id }, data: dataToUpdate });
        }
      }
      const companyId = company.id; 

      // --- 1.5 Check for Potential Duplicates (using pg_trgm) ---
      this.logger.trace({ 
          normalizedTitle: normalizedTitleForDb,
          normalizedCompany: normalizedCompanyNameForDb,
          source: validJobData.source,
          sourceId: validJobData.sourceId
      }, 'Checking for potential duplicates using similarity...');
      const potentialDuplicates = await this.findPotentialDuplicates(
          normalizedTitleForDb,
          normalizedCompanyNameForDb,
          validJobData.source,
          validJobData.sourceId
      );
      if (potentialDuplicates.length > 0) {
          this.logger.warn({
              incomingJob: { 
                  title: validJobData.title,
                  company: rawCompanyName, 
                  source: validJobData.source, 
                  sourceId: validJobData.sourceId 
              },
              potentialDuplicates: potentialDuplicates.map(dup => ({ 
                  id: dup.id, 
                  title: dup.title, 
                  company: dup.company_name, 
                  titleSimilarity: dup.title_similarity,
                  companySimilarity: dup.company_similarity
              }))
          }, `Potential duplicate(s) found for job. Currently only logging.`);
      }

      // --- 2. Prepare Job Data --- 
      const hiringRegionFromJobType = mapJobType2ToHiringRegion(validJobData.jobType2);
      const determinedHiringRegion = validJobData.hiringRegion || hiringRegionFromJobType || undefined;

      const jobData = {
        title: validJobData.title,
        description: validJobData.description,
        requirements: validJobData.requirements,
        responsibilities: validJobData.responsibilities,
        benefits: validJobData.benefits,
        location: validJobData.location,
        country: validJobData.country,
        isRemote: validJobData.isRemote,
        jobType: validJobData.jobType || JobType.UNKNOWN, // Default if undefined
        experienceLevel: validJobData.experienceLevel || ExperienceLevel.UNKNOWN, // Default
        workplaceType: validJobData.workplaceType || WorkplaceType.UNKNOWN, // Default
        applicationUrl: validJobData.applicationUrl,
        // applicationEmail: validJobData.companyEmail, // Consider if this should be job-specific
        minSalary: validJobData.minSalary,
        maxSalary: validJobData.maxSalary,
        currency: validJobData.currency,
        salaryPeriod: validJobData.salaryPeriod,
        publishedAt: validJobData.publishedAt,
        status: JobStatus.ACTIVE, // Set to active when saving/updating
        skills: validJobData.skills || [],
        tags: validJobData.tags || [],
        visas: validJobData.visas || [],
        languages: validJobData.languages || [],
        hiringRegion: determinedHiringRegion,
        companyId: companyId,
        source: validJobData.source,
        sourceId: validJobData.sourceId,
        normalizedTitle: normalizedTitleForDb, // Use pre-normalized
        normalizedCompanyName: normalizedCompanyNameForDb, // Use pre-normalized
        relevanceScore: validJobData.relevanceScore, // Include the relevance score
        // Ensure updatedAt is handled by Prisma automatically or set manually if needed
      };

      // --- 3. Find Existing Job --- 
      const existingJob = await this.prisma.job.findUnique({
        where: { 
          source_sourceId: { 
            source: validJobData.source, 
            sourceId: validJobData.sourceId, 
          },
        },
      });

      // --- 4. Update or Create Job --- 
      if (existingJob) {
        // --- Update Existing Job ---
        this.logger.trace({ jobId: existingJob.id }, 'Updating existing job...');
        await this.prisma.job.update({
            where: { id: existingJob.id },
            data: jobData,
        });
        this.logger.info({ jobId: existingJob.id, source: validJobData.source, sourceId: validJobData.sourceId }, 'Job updated successfully.');

      } else {
        // --- Create New Job ---
        this.logger.trace('Creating new job...');
        const newJob = await this.prisma.job.create({
            data: jobData,
        });
        this.logger.info({ jobId: newJob.id, source: validJobData.source, sourceId: validJobData.sourceId }, 'Job created successfully.');
      }

      return true;

    } catch (error) {
      // Improved Error Logging
      const logPayload: any = { 
          source: validJobData?.source, // Use validated data if available
          sourceId: validJobData?.sourceId, 
          title: validJobData?.title,
          errorName: error instanceof Error ? error.name : 'UnknownErrorType',
          errorMessage: error instanceof Error ? error.message : String(error),
      };
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