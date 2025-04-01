import { prisma } from '../prisma';
import { StandardizedJob } from '../jobProcessors/types';
import { GreenhouseProcessor } from '../jobProcessors/greenhouseProcessor';
import pino from 'pino';

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
  private processors = {
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
    // First ensure the company exists
    const company = await prisma.user.upsert({
      where: {
        email: job.company.email
      },
      update: {
        name: job.company.name,
        logo: job.company.logo,
        website: job.company.website,
        industry: job.company.industry,
        isActive: true
      },
      create: {
        email: job.company.email,
        name: job.company.name,
        role: 'COMPANY',
        logo: job.company.logo,
        website: job.company.website,
        industry: job.company.industry,
        isActive: true
      }
    });

    // Then create/update the job
    await prisma.job.upsert({
      where: {
        source_sourceId: {
          source,
          sourceId: job.sourceId
        }
      },
      update: {
        title: job.title,
        description: job.description,
        requirements: job.requirements,
        responsibilities: job.responsibilities,
        benefits: job.benefits,
        jobType: job.jobType,
        experienceLevel: job.experienceLevel,
        skills: job.skills,
        tags: job.tags,
        location: job.location,
        country: job.country,
        workplaceType: job.workplaceType,
        applicationUrl: job.applicationUrl,
        sourceUrl: job.sourceUrl,
        sourceLogo: job.sourceLogo,
        source,
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
      create: {
        sourceId: job.sourceId,
        source,
        title: job.title,
        description: job.description,
        requirements: job.requirements,
        responsibilities: job.responsibilities,
        benefits: job.benefits,
        jobType: job.jobType,
        experienceLevel: job.experienceLevel,
        skills: job.skills,
        tags: job.tags,
        location: job.location,
        country: job.country,
        workplaceType: job.workplaceType,
        applicationUrl: job.applicationUrl,
        sourceUrl: job.sourceUrl,
        sourceLogo: job.sourceLogo,
        status: 'ACTIVE',
        companyId: company.id,
      }
    });
  }
} 