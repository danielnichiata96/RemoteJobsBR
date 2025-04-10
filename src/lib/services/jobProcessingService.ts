import { prisma } from '../prisma';
import { StandardizedJob } from '../jobProcessors/types';
import { GreenhouseProcessor } from '../jobProcessors/greenhouseProcessor';
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
    this.prisma = new PrismaClient();
    this.logger = pino({ /* ... pino config ... */ });
  }

  private processors: { 
    [key: string]: { processJob: (rawJob: any) => Promise<any> } 
  } = {
    greenhouse: new GreenhouseProcessor(),
    // Add other processors here as they're created
  };

  async processAndSaveJob(source: string, rawJob: any) {
    const processor = this.processors[source];
    if (!processor) {
      throw new Error(`No processor found for source: ${source}`);
    }

    const result = await processor.processJob(rawJob);
    
    if (!result.success || !result.job) {
      logger.warn({ source, error: result.error }, 'Failed to process job');
      return false;
    }

    try {
      await this.saveJob(result.job, source);
      return true;
    } catch (error) {
      logger.error({ source, error }, 'Failed to save job');
      return false;
    }
  }

  private async saveJob(job: StandardizedJob, source: string) {
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
          // Generate a unique placeholder email ONLY for creation
          // Use companyName + source for more consistency
          const placeholderEmail = `${normalizedCompanyName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${source}@greenhouse.example.com`;
          
          company = await this.prisma.user.create({
            data: {
              email: placeholderEmail,
              name: normalizedCompanyName,
              role: UserRole.COMPANY,
              logo: job.companyLogo,
              website: job.companyWebsite,
              industry: 'Technology', // Default industry, consider adding to StandardizedJob
              isVerified: false, // Companies created via scraping are not verified by default
              // Add other relevant company fields from StandardizedJob if available
            },
          });
          this.logger.info({ companyId: company.id, companyName: normalizedCompanyName }, 'Company created successfully.');
        } catch (createError) {
          this.logger.error({ companyName: normalizedCompanyName, error: createError }, 'Failed to create company.');
          // If creation failed (e.g., race condition on name?), try finding again by name
          company = await this.prisma.user.findFirst({
            where: {
              name: normalizedCompanyName,
              role: UserRole.COMPANY
            },
          });
          if (!company) {
            this.logger.error('Still could not find or create company. Skipping job.');
            return false;
          }
        }
      } else {
        // Optionally update existing company details if needed (e.g., logo, website)
        // Be cautious about overwriting verified data
        // await this.prisma.user.update({ where: { id: company.id }, data: { ... } });
        this.logger.debug({ companyId: company.id, companyName: normalizedCompanyName }, 'Company found.');
      }

      // --- 2. Prepare Job Data (with Defaults) ---
      const jobData = {
        title: job.title,
        description: job.description || '',
        requirements: job.requirements || 'Not specified', // Default required
        responsibilities: job.responsibilities || 'Not specified', // Default required
        benefits: job.benefits,
        jobType: job.jobType || JobType.FULL_TIME, // Default required
        experienceLevel: job.experienceLevel || ExperienceLevel.MID, // Default required
        skills: job.skills || [],
        location: job.location,
        country: job.country || 'Worldwide', // Default required
        workplaceType: job.workplaceType || 'REMOTE', // Default required
        applicationUrl: job.applicationUrl, // Removed sourceUrl fallback
        minSalary: job.minSalary,
        maxSalary: job.maxSalary,
        currency: job.currency,
        salaryCycle: job.salaryCycle,
        showSalary: !!(job.minSalary && job.maxSalary), // Show salary if min/max provided
        publishedAt: job.publishedAt || new Date(), // Default to now if not provided
        updatedAt: new Date(), // Always set updatedAt
        status: JobStatus.ACTIVE, // Assume jobs processed are active
        companyId: company.id,
        source: job.source,
        sourceId: job.sourceId,
        // visas and languages are optional in schema, handle if needed
        visas: [], // Default empty
        languages: [], // Default empty
      };

      // --- 3. Upsert Job ---
      const upsertResult = await this.prisma.job.upsert({
        where: { source_sourceId: { source: job.source, sourceId: job.sourceId } }, // Use @@unique constraint
        update: jobData, // Update with new data
        create: jobData, // Create if not exists
      });

      this.logger.info({ jobId: upsertResult.id, source: job.source, sourceId: job.sourceId }, 'Job processed and saved/updated successfully.');
      return true;

    } catch (error) {
      this.logger.error({ source: job.source, sourceId: job.sourceId, error }, 'Error processing job in service');
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