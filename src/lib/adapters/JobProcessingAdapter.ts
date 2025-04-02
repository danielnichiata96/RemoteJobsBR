import { PrismaClient } from '@prisma/client';
import { JobProcessingService } from '../services/jobProcessingService';
import { StandardizedJob } from '../../types/StandardizedJob';
import { JobProcessor, ProcessedJobResult, EnhancedGreenhouseJob } from '../jobProcessors/types';
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

/**
 * Adapter class for JobProcessingService to handle different interfaces
 * and provide additional functionality
 */
export class JobProcessingAdapter {
  private jobProcessingService: JobProcessingService;
  
  constructor() {
    this.jobProcessingService = new JobProcessingService();
  }
  
  /**
   * Process and save a standardized job
   * Adapts the new standardized job format to what JobProcessingService expects
   */
  async processAndSaveJob(standardizedJob: StandardizedJob): Promise<boolean> {
    try {
      if (!standardizedJob.source || !standardizedJob.sourceId) {
        logger.error('Job missing required source or sourceId');
        return false;
      }

      // Log input data
      logger.debug({
        sourceId: standardizedJob.sourceId,
        title: standardizedJob.title,
        hasRequiredFields: Boolean(
          standardizedJob.requirements && 
          standardizedJob.responsibilities &&
          standardizedJob.jobType &&
          standardizedJob.experienceLevel
        )
      }, 'Processing standardized job');

      // Create a company object in the format expected by JobProcessingService
      const company = {
        name: standardizedJob.companyName,
        // Create a deterministic email from the company name and source
        email: `${standardizedJob.companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${standardizedJob.source}@example.com`,
        logo: standardizedJob.companyLogo,
        website: standardizedJob.companyWebsite,
        industry: 'Technology' // Default
      };
      
      // Build the raw job object in the expected format for the original JobProcessor
      const rawJob: EnhancedGreenhouseJob = {
        id: parseInt(standardizedJob.sourceId, 10), // Convert sourceId back to number if possible
        title: standardizedJob.title,
        updated_at: standardizedJob.updatedAt?.toISOString() || new Date().toISOString(),
        location: { name: standardizedJob.location },
        content: standardizedJob.description,
        absolute_url: standardizedJob.applicationUrl || '', // Use applicationUrl as fallback
        metadata: standardizedJob.metadataRaw || [],
        departments: [], // Departments not usually in standardized data
        company: {
          name: standardizedJob.companyName,
          boardToken: '', // Placeholder, not critical for processing
          logo: standardizedJob.companyLogo,
          website: standardizedJob.companyWebsite
        },
        // Add the extra fields we expect in EnhancedGreenhouseJob
        requirements: standardizedJob.requirements,
        responsibilities: standardizedJob.responsibilities,
        benefits: standardizedJob.benefits,
        jobType: standardizedJob.jobType,
        experienceLevel: standardizedJob.experienceLevel,
        skills: standardizedJob.skills,
        tags: standardizedJob.tags,
        country: standardizedJob.country,
        workplaceType: standardizedJob.workplaceType,
      };
      
      // Call the original service
      logger.debug('Calling JobProcessingService with adapted job data');
      return await this.jobProcessingService.processAndSaveJob(standardizedJob.source, rawJob);
    } catch (error) {
      logger.error({ error }, 'Error in JobProcessingAdapter');
      return false;
    }
  }
} 