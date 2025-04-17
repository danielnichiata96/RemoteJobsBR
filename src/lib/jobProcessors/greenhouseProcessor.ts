import { JobProcessor, StandardizedJob, ProcessedJobResult, EnhancedGreenhouseJob, GreenhouseJob } from './types';
import { 
  extractSkills, 
  detectJobType, 
  detectExperienceLevel,
  parseSections,
  isRemoteJob 
} from '../utils/jobUtils';
import { stripHtml } from '../utils/textUtils';
import pino from 'pino';
import { JobType, ExperienceLevel, HiringRegion, JobSource, Prisma } from '@prisma/client';
import { extractDomain, getCompanyLogo } from '../utils/logoUtils';
import { detectRestrictivePattern } from '../utils/filterUtils';

const logger = pino({
  name: 'greenhouseProcessor',
  level: process.env.LOG_LEVEL || 'info',
});

export class GreenhouseProcessor implements JobProcessor {
  source = 'greenhouse';

  async processJob(rawJob: GreenhouseJob | EnhancedGreenhouseJob, sourceData?: JobSource): Promise<ProcessedJobResult> {
    // *** REMOVE TEMP DEBUGGING ***
    // console.log(`[DEBUG ${rawJob.id}] processJob start`);
    // let isRemoteResult: boolean | null = null;
    // let remoteCheckSkipped = false;
    // ***************************
    try {
      // Check if job is remote - skip if we already pre-verified (by having additional fields)
      const isEnhancedJob = 'requirements' in rawJob && 'responsibilities' in rawJob;
      
      // *** REMOVE TEMP DEBUGGING ***
      // console.log(`[DEBUG ${rawJob.id}] isEnhancedJob: ${isEnhancedJob}`);
      // ***************************

      if (!isEnhancedJob) {
        const isRemoteResult = isRemoteJob(rawJob.location.name, rawJob.content);
        // *** REMOVE TEMP DEBUGGING ***
        // console.log(`[DEBUG ${rawJob.id}] isRemoteJob called, result: ${isRemoteResult}`);
        // ***************************
        if (!isRemoteResult) {
            // *** REMOVE TEMP DEBUGGING ***
            // console.log(`[DEBUG ${rawJob.id}] Returning success: false due to isRemoteJob`);
            // ***************************
            return {
                success: false,
                error: 'Job is not remote or has location restrictions'
            };
        }
      } else {
          // *** REMOVE TEMP DEBUGGING ***
          // remoteCheckSkipped = true;
          // console.log(`[DEBUG ${rawJob.id}] isRemoteJob check skipped (enhanced job)`);
          // ***************************
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
        cleanContent = stripHtml(rawJob.content);
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
        const websiteForLogo = standardizedJob.companyWebsite;
        if (websiteForLogo) {
          // *** Use the getCompanyLogo utility function ***
          standardizedJob.companyLogo = getCompanyLogo(websiteForLogo);
          logger.trace({ jobId: rawJob.id, websiteUsed: websiteForLogo, logoUrl: standardizedJob.companyLogo }, 'Called getCompanyLogo.');
          // ***************************************************
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

      // *** REMOVE TEMP DEBUGGING ***
      // console.log(`[DEBUG ${rawJob.id}] Reached end, returning success: true`);
      // ***************************

      return {
        success: true,
        job: standardizedJob
      };
    } catch (error) {
      // *** REMOVE TEMP DEBUGGING ***
      // console.log(`[DEBUG ${rawJob.id}] Caught error: ${error instanceof Error ? error.message : error}`);
      // ***************************
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