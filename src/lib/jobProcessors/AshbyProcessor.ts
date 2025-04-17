import { JobProcessor, StandardizedJob, ProcessedJobResult, RawJobData } from './types';
import { 
  extractSkills, 
  detectJobType, 
  detectExperienceLevel,
  parseSections, 
} from '../utils/jobUtils';
import { stripHtml } from '../utils/textUtils';
import pino from 'pino';
import { JobType, ExperienceLevel, HiringRegion, JobSource, Prisma } from '@prisma/client';
import { getCompanyLogo } from '../utils/logoUtils';
import { AshbyApiJob } from '../fetchers/types';

const logger = pino({
  name: 'ashbyProcessor',
  level: process.env.LOG_LEVEL || 'info',
});

// Helper function to map Ashby employmentType to our JobType enum
function mapAshbyEmploymentType(ashbyType?: string): JobType | undefined {
  if (!ashbyType) return undefined;
  const lowerType = ashbyType.toLowerCase();
  switch (lowerType) {
    case 'fulltime':
      return JobType.FULL_TIME;
    case 'parttime':
      return JobType.PART_TIME;
    case 'contract':
      return JobType.CONTRACT;
    case 'intern':
      return JobType.INTERNSHIP;
    default:
      return JobType.UNKNOWN ?? undefined;
  }
}

export class AshbyProcessor implements JobProcessor {
  source = 'ashby';

  async processJob(rawJob: RawJobData, sourceData?: JobSource): Promise<ProcessedJobResult> {
    const ashbyJob = rawJob as AshbyApiJob;

    try {
      logger.debug({ jobId: ashbyJob.id, title: ashbyJob.title }, 'Processing job in AshbyProcessor');

      // Basic check: Skip if job is not listed
      if (ashbyJob.isListed === false) {
        logger.trace({ jobId: ashbyJob.id }, 'Skipping job because isListed is false.');
        return {
          success: false,
          error: 'Job is not listed'
        };
      }

      // --- Strict Remote Check ---
      // Ensure the job is marked as remote according to Ashby
      if (ashbyJob.isRemote !== true) {
          logger.trace({ jobId: ashbyJob.id, isRemote: ashbyJob.isRemote }, 'Skipping job because isRemote is not true.');
          return {
              success: false,
              error: 'Job is not explicitly marked as remote'
          };
      }
      // --- End Strict Remote Check ---

      // Extract content and skills
      const cleanContent = stripHtml(ashbyJob.descriptionHtml || '');
      const sections = parseSections(cleanContent);
      const skills = extractSkills(cleanContent);

      // Determine HiringRegion based on the type passed from the fetcher
      // (Fetcher should have already done primary region filtering)
      let determinedRegion: HiringRegion | undefined = undefined;
      if (ashbyJob._determinedHiringRegionType === 'latam') {
        determinedRegion = HiringRegion.LATAM;
      } else if (ashbyJob._determinedHiringRegionType === 'global') {
        determinedRegion = HiringRegion.WORLDWIDE;
      } // If fetcher didn't set it, it remains undefined

      // Refined company details
      const companyName = sourceData?.name || ashbyJob.organizationName || 'Unknown Company';

      // Workplace type is now confirmed REMOTE
      const determinedWorkplaceType = 'REMOTE'; 

      // Attempt to get country from primary address
      const primaryCountry = ashbyJob.address?.postalAddress?.addressCountry;

      const standardizedJob: StandardizedJob = {
        sourceId: ashbyJob.id,
        source: this.source,
        title: ashbyJob.title,
        description: sections.description || cleanContent,
        requirements: sections.requirements,
        responsibilities: sections.responsibilities,
        benefits: sections.benefits,
        jobType: mapAshbyEmploymentType(ashbyJob.employmentType) || detectJobType(cleanContent),
        experienceLevel: detectExperienceLevel(cleanContent),
        skills: skills,
        tags: [...skills],
        hiringRegion: determinedRegion,
        location: ashbyJob.location || 'Remote', // Default to Remote if location is missing but isRemote is true
        country: primaryCountry || undefined, 
        workplaceType: determinedWorkplaceType, // Always REMOTE here
        applicationUrl: ashbyJob.applyUrl || ashbyJob.jobUrl,
        companyName: companyName,
        companyLogo: undefined, // Fetched below
        companyWebsite: sourceData?.companyWebsite || undefined,
        updatedAt: ashbyJob.updatedAt ? new Date(ashbyJob.updatedAt) : new Date(),
        publishedAt: ashbyJob.publishedAt ? new Date(ashbyJob.publishedAt) : new Date(), 
      };

      // --- Logo Fetching --- 
       try {
        const websiteForLogo = standardizedJob.companyWebsite;
        if (websiteForLogo) {
          standardizedJob.companyLogo = getCompanyLogo(websiteForLogo);
          logger.trace({ jobId: ashbyJob.id, websiteUsed: websiteForLogo, logoUrl: standardizedJob.companyLogo }, 'Called getCompanyLogo.');
        } else {
          logger.trace({ jobId: ashbyJob.id }, 'Company website not available for logo fetching.');
        }
      } catch (logoError) {
        logger.warn({ jobId: ashbyJob.id, website: standardizedJob.companyWebsite, error: logoError }, 'Error processing company website for logo URL.');
      }

      logger.debug({ jobId: ashbyJob.id }, 'Successfully processed job in AshbyProcessor');

      return {
        success: true,
        job: standardizedJob
      };
    } catch (error) {
      logger.error({ error, jobId: ashbyJob?.id, title: ashbyJob?.title }, 'Error processing job in AshbyProcessor');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error processing job'
      };
    }
  }
} 