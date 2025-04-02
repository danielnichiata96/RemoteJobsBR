import { JobProcessor, StandardizedJob, ProcessedJobResult, EnhancedGreenhouseJob, GreenhouseJob } from './types';
import { 
  extractSkills, 
  cleanHtml, 
  detectJobType, 
  detectExperienceLevel,
  parseSections,
  isRemoteJob 
} from '../utils/jobUtils';
import pino from 'pino';
import { JobType, ExperienceLevel } from '@prisma/client';

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

export class GreenhouseProcessor implements JobProcessor {
  source = 'greenhouse';

  async processJob(rawJob: GreenhouseJob | EnhancedGreenhouseJob): Promise<ProcessedJobResult> {
    try {
      // Check if job is remote - skip if we already pre-verified (by having additional fields)
      const isEnhancedJob = 'requirements' in rawJob && 'responsibilities' in rawJob;
      
      if (!isEnhancedJob && !isRemoteJob(rawJob.location.name, rawJob.content)) {
        return {
          success: false,
          error: 'Job is not remote or has location restrictions'
        };
      }

      // For logging
      logger.debug({
        jobId: rawJob.id,
        isEnhancedJob,
        title: rawJob.title
      }, 'Processing job in GreenhouseProcessor');

      // Get content and sections
      let sections;
      let skills;
      let cleanContent = '';
      
      if (isEnhancedJob) {
        // Use pre-processed data
        const enhancedJob = rawJob as EnhancedGreenhouseJob;
        sections = {
          description: rawJob.content,
          requirements: enhancedJob.requirements || '',
          responsibilities: enhancedJob.responsibilities || '',
          benefits: enhancedJob.benefits || ''
        };
        skills = enhancedJob.skills || [];
        cleanContent = rawJob.content;
      } else {
        // Process the data normally
        cleanContent = cleanHtml(rawJob.content);
        sections = parseSections(cleanContent);
        skills = extractSkills(cleanContent);
      }

      const enhancedJob = rawJob as EnhancedGreenhouseJob;

      const standardizedJob: StandardizedJob = {
        sourceId: `${rawJob.id}`,
        source: this.source,
        title: rawJob.title,
        description: sections.description,
        requirements: sections.requirements,
        responsibilities: sections.responsibilities,
        benefits: sections.benefits,
        // Use pre-defined values if available, otherwise detect
        jobType: enhancedJob.jobType || detectJobType(cleanContent),
        experienceLevel: enhancedJob.experienceLevel || detectExperienceLevel(cleanContent),
        skills: enhancedJob.skills || skills,
        tags: enhancedJob.tags || [...skills], // Use skills as tags if not provided
        location: rawJob.location.name,
        country: enhancedJob.country || 'Worldwide', // Default for remote jobs
        workplaceType: enhancedJob.workplaceType || 'REMOTE',
        applicationUrl: rawJob.absolute_url,
        // Map to flat company properties
        companyName: rawJob.company.name,
        companyEmail: `${rawJob.company.boardToken}@greenhouse.placeholder.com`, // Generate placeholder email
        companyLogo: rawJob.company.logo,
        companyWebsite: rawJob.company.website,
        updatedAt: new Date(rawJob.updated_at), // Include updatedAt
        publishedAt: new Date(rawJob.updated_at) // Use updated_at as publishedAt for now
      };

      return {
        success: true,
        job: standardizedJob
      };
    } catch (error) {
      logger.error({ 
        error, 
        jobId: rawJob.id,
        title: rawJob.title 
      }, 'Error processing job in GreenhouseProcessor');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error processing job'
      };
    }
  }
} 