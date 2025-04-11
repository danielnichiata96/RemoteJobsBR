import { prisma } from '../prisma';
import { StandardizedJob } from '../../types/StandardizedJob';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
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
    if (!job || !job.source || !job.sourceId || !job.title || !job.companyName || !job.applicationUrl) {
        this.logger.error({ jobData: job }, 'Job data is missing required fields (source, sourceId, title, companyName, applicationUrl). Skipping save.');
        return false;
    }

    this.logger.debug({ source: job.source, sourceId: job.sourceId, title: job.title }, 'Processing job...');

    try {
      // Normalize company name to ensure consistency
      const normalizedCompanyName = job.companyName.trim();
      
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
      }

      // --- 2. Prepare Job Data (with Defaults) ---
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
        minSalary: job.salaryMin, // Map from StandardizedJob field name
        maxSalary: job.salaryMax, // Map from StandardizedJob field name
        currency: job.salaryCurrency, // Map from StandardizedJob field name
        salaryCycle: job.salaryPeriod, // Map from StandardizedJob field name
        showSalary: !!(job.salaryMin && job.salaryMax), // Show salary if min/max provided
        publishedAt: job.publishedAt || new Date(), // Default to now if not provided
        updatedAt: new Date(), // Always set updatedAt
        status: job.status || JobStatus.ACTIVE, // Use provided status or default to ACTIVE
        companyId: company.id, // Link to the found/created company
        source: job.source,
        sourceId: job.sourceId,
        visas: [], // Default empty
        languages: [], // Default empty
      };

      // --- 3. Upsert Job ---
      const upsertResult = await this.prisma.job.upsert({
        where: { source_sourceId: { source: job.source, sourceId: job.sourceId } }, // Use unique constraint
        update: jobDataForDb, // Update with new data
        create: jobDataForDb, // Create if not exists
      });

      this.logger.info({ jobId: upsertResult.id, source: job.source, sourceId: job.sourceId }, 'Job processed and saved/updated successfully.');
      return true;

    } catch (error) {
      this.logger.error({ source: job.source, sourceId: job.sourceId, error }, 'Error processing job in service');
      // Log specific Prisma errors if helpful
      // if (error instanceof Prisma.PrismaClientKnownRequestError) { ... }
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