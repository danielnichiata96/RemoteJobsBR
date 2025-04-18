import { JobProcessor, ProcessedJobResult, RawJobData } from './types';
import { StandardizedJob } from '../../types/StandardizedJob';
import { FilterConfig } from '../../types/FilterConfig';
import { JobType, ExperienceLevel, JobSource, SalaryPeriod, HiringRegion, Prisma } from '@prisma/client';
import { Currency } from '../../types/models';
import { AshbyApiJob } from '../fetchers/types';
import { parseDate } from '../utils/textUtils';
import { stripHtml } from '../utils/textUtils';
import { detectExperienceLevel, detectJobType, extractSkills } from '../utils/jobUtils';
import { getCompanyLogo } from '../utils/logoUtils';
import pino from 'pino';
import { 
  parseSections, 
} from '../utils/jobUtils';
import { calculateRelevanceScore } from '../utils/JobRelevanceScorer';

const logger = pino({
  name: 'ashbyProcessor',
  level: process.env.LOG_LEVEL || 'info',
});

const MAX_JOB_AGE_DAYS = 30; // Configurable?

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
      // Return undefined for unknown types to allow fallback to detectJobType
      return undefined;
  }
}

export class AshbyProcessor implements JobProcessor {
  source = 'ashby';

  async processJob(rawJob: RawJobData, sourceData?: JobSource): Promise<ProcessedJobResult> {
    const ashbyJob = rawJob as AshbyApiJob;
    const jobLogger = logger.child({ processor: 'Ashby', jobId: ashbyJob?.id, sourceName: sourceData?.name }, { level: logger.level });

    try {
      jobLogger.debug({ title: ashbyJob.title }, 'Processing job in AshbyProcessor');

      // Basic check: Skip if job is not listed
      if (ashbyJob.isListed === false) {
        jobLogger.trace({ jobId: ashbyJob.id }, 'Skipping job because isListed is false.');
        return {
          success: false,
          error: 'Job is not listed'
        };
      }

      // --- Strict Remote Check ---
      // Ensure the job is marked as remote according to Ashby
      if (ashbyJob.isRemote !== true) {
          jobLogger.trace({ jobId: ashbyJob.id, isRemote: ashbyJob.isRemote }, 'Skipping job because isRemote is not true.');
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

      // --- Relevance Score Calculation ---
      let relevanceScore: number | null = null;
      const sourceConfig = sourceData?.config as Prisma.JsonObject | null;
      if (sourceConfig && sourceConfig.SCORING_SIGNALS) { // Check if scoring signals exist in config
        try {
          relevanceScore = calculateRelevanceScore(
            { 
              title: ashbyJob.title, 
              description: cleanContent, // Use the cleaned description
              location: ashbyJob.location // Use Ashby's location field
            },
            sourceConfig as unknown as FilterConfig // Cast needed, ensure config structure matches
          );
          jobLogger.trace({ score: relevanceScore }, 'Calculated relevance score.');
        } catch (scoreError) {
          jobLogger.warn({ error: scoreError }, 'Error calculating relevance score.');
        }
      } else {
        jobLogger.trace('Scoring signals not found in config, skipping score calculation.');
      }
      // -------------------------------------

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
        isRemote: ashbyJob.isRemote,
        relevanceScore: relevanceScore, // Add the calculated score
        metadataRaw: { // Add relevant Ashby fields to metadataRaw
            employmentType: ashbyJob.employmentType,
            team: ashbyJob.team,
            compensationTier: ashbyJob.compensationTier,
            department: ashbyJob.department,
            locations: ashbyJob.locations, // Include all locations
            address: ashbyJob.address
        }
      };

      // --- Logo Fetching --- 
       try {
        const websiteForLogo = standardizedJob.companyWebsite;
        if (websiteForLogo) {
          standardizedJob.companyLogo = getCompanyLogo(websiteForLogo);
          jobLogger.trace({ jobId: ashbyJob.id, websiteUsed: websiteForLogo, logoUrl: standardizedJob.companyLogo }, 'Called getCompanyLogo.');
        } else {
          jobLogger.trace({ jobId: ashbyJob.id }, 'Company website not available for logo fetching.');
        }
      } catch (logoError) {
        jobLogger.warn({ jobId: ashbyJob.id, website: standardizedJob.companyWebsite, error: logoError }, 'Error processing company website for logo URL.');
      }

      jobLogger.debug({ jobId: ashbyJob.id }, 'Successfully processed job in AshbyProcessor');

      return {
        success: true,
        job: standardizedJob
      };
    } catch (error) {
      jobLogger.error({ error, jobId: ashbyJob?.id, title: ashbyJob?.title }, 'Error processing job in AshbyProcessor');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error processing job'
      };
    }
  }
} 