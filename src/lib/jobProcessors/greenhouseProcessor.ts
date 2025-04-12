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
import { JobType, ExperienceLevel, HiringRegion, JobSource } from '@prisma/client';
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
      const tempJob = rawJob as any; // Cast to access the temporary property
      let determinedRegion: HiringRegion | null = null;

      if (tempJob._determinedHiringRegionType === 'latam') {
        determinedRegion = HiringRegion.LATAM;
      } else if (tempJob._determinedHiringRegionType === 'global') {
        determinedRegion = HiringRegion.GLOBAL;
      } else if (enhancedJob.hiringRegion && Object.values(HiringRegion).includes(enhancedJob.hiringRegion)) {
        // Fallback to existing enhancedJob.hiringRegion if _determinedHiringRegionType is not set/valid
        // and if enhancedJob.hiringRegion is a valid enum value
        determinedRegion = enhancedJob.hiringRegion;
      }
      // Otherwise, determinedRegion remains null

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
        hiringRegion: determinedRegion,
        location: rawJob.location.name,
        country: enhancedJob.country || 'Worldwide', // Default for remote jobs
        workplaceType: enhancedJob.workplaceType || 'REMOTE',
        applicationUrl: rawJob.absolute_url,
        // Map to flat company properties
        companyName: sourceData?.name || enhancedJob.company?.name || '',
        companyEmail: `${sourceData?.config?.boardToken || enhancedJob.company?.boardToken || 'unknown'}@greenhouse.placeholder.com`,
        companyLogo: null,
        companyWebsite: sourceData?.companyWebsite || enhancedJob.company?.website || null,
        updatedAt: new Date(rawJob.updated_at), // Include updatedAt
        publishedAt: new Date(rawJob.updated_at) // Use updated_at as publishedAt for now
      };

      // --- Logo Fetching (using logo.dev) ---
      try {
        // Use website from sourceData first, then from rawJob if available
        const websiteForLogo = sourceData?.companyWebsite || enhancedJob.company?.website;
        if (websiteForLogo) { 
          const domain = extractDomain(websiteForLogo);
          if (domain) {
            // Usar API token se disponível
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
        logger.warn({ jobId: rawJob.id, website: sourceData?.companyWebsite, error: logoError }, 'Error processing company website for logo URL.');
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