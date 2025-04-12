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
import { JobType, ExperienceLevel, HiringRegion, JobSource, Prisma } from '@prisma/client';
import { extractDomain } from '../utils/logoUtils';

const logger = pino({
  name: 'greenhouseProcessor',
  level: process.env.LOG_LEVEL || 'info',
});

export class GreenhouseProcessor implements JobProcessor {
  source = 'greenhouse';

  async processJob(rawJob: GreenhouseJob | EnhancedGreenhouseJob, sourceData?: JobSource): Promise<ProcessedJobResult> {
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

      // Determine HiringRegion based on the type passed from the fetcher
      const tempJob = rawJob as any; // Keep this cast for flexibility
      let determinedRegion: HiringRegion | undefined = undefined; // Default to undefined

      // Check the property added by the fetcher
      if (tempJob._determinedHiringRegionType === 'latam') {
        determinedRegion = HiringRegion.LATAM;
      } else if (tempJob._determinedHiringRegionType === 'global') {
        // Use WORLDWIDE instead of GLOBAL if that's the enum value
        determinedRegion = HiringRegion.WORLDWIDE; 
      }
      // Remove the fallback check for enhancedJob.hiringRegion as it caused errors
      // If _determinedHiringRegionType wasn't set, determinedRegion will remain undefined.

      // Ensure config is treated as JSON object for boardToken access
      const sourceConfig = sourceData?.config as Prisma.JsonObject | null;

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
        // Use the determined region, falling back if necessary
        hiringRegion: determinedRegion, // Assign the potentially undefined value
        location: rawJob.location.name,
        country: enhancedJob.country || 'Worldwide', // Default for remote jobs
        workplaceType: enhancedJob.workplaceType || 'REMOTE',
        applicationUrl: rawJob.absolute_url,
        // Map to flat company properties
        companyName: sourceData?.name || enhancedJob.company?.name || '',
        // Use boardToken from sourceData.config safely
        companyEmail: `${sourceConfig?.boardToken || 'unknown'}@greenhouse.placeholder.com`,
        // Assign undefined instead of null for optional string fields
        companyLogo: undefined,
        companyWebsite: sourceData?.companyWebsite || enhancedJob.company?.website || undefined,
        updatedAt: new Date(rawJob.updated_at), // Include updatedAt
        publishedAt: new Date(rawJob.updated_at) // Use updated_at as publishedAt for now
      };

      // --- Logo Fetching (using logo.dev) ---
      try {
        // Use website from sourceData first, then from rawJob if available
        const websiteForLogo = standardizedJob.companyWebsite; // Use the value already assigned
        if (websiteForLogo) { 
          const domain = extractDomain(websiteForLogo);
          if (domain) {
            const apiToken = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN || '';
            const tokenParam = apiToken ? `?token=${apiToken}` : '';
            standardizedJob.companyLogo = `https://img.logo.dev/${domain}${tokenParam}`;
            logger.trace({ jobId: rawJob.id, domain, websiteUsed: websiteForLogo, logoUrl: standardizedJob.companyLogo }, 'Generated logo URL.');
          } else {
             logger.trace({ jobId: rawJob.id, website: websiteForLogo }, 'Could not extract domain for logo.');
          }
        } else {
             logger.trace({ jobId: rawJob.id }, 'Company website not available for logo fetching.');
        }
      } catch (logoError) {
        logger.warn({ jobId: rawJob.id, website: standardizedJob.companyWebsite, error: logoError }, 'Error processing company website for logo URL.');
      }
      // -------------------------------------

      // Log the final logo URL before returning
      logger.debug({ 
          jobId: rawJob.id, 
          companyName: standardizedJob.companyName, 
          companyWebsite: standardizedJob.companyWebsite,
          finalCompanyLogo: standardizedJob.companyLogo 
      }, 'Final standardizedJob details before returning from processor');

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