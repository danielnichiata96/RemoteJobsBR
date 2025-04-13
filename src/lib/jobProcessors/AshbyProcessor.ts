import { StandardizedJob } from '@/types/StandardizedJob'; 
import { JobProcessor, ProcessedJobResult } from './types';
import { JobSource, JobType, HiringRegion, ExperienceLevel, JobStatus } from '@prisma/client';
import pino from 'pino';
import { detectJobType, detectExperienceLevel, extractSkills } from '../utils/jobUtils';
// Commenting out missing utils imports
// import { parseDate } from '../utils/dateUtils'; 
// import { cleanHtml } from '../utils/htmlUtils';

// Default logger instance within the processor scope
const defaultLogger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Define the structure of the raw job data from Ashby API
interface AshbyRawJob {
    title: string;
    location?: string;
    secondaryLocations?: { location?: string; address?: AshbyAddress }[];
    department?: string;
    team?: string;
    isRemote?: boolean;
    descriptionHtml?: string;
    descriptionPlain?: string;
    publishedAt?: string; // ISO DateTime string
    employmentType?: "FullTime" | "PartTime" | "Intern" | "Contract" | "Temporary";
    address?: { postalAddress?: AshbyAddress };
    jobUrl?: string;
    applyUrl?: string;
    isListed?: boolean;
}

interface AshbyAddress {
    addressLocality?: string; // City
    addressRegion?: string; // State/Province
    addressCountry?: string;
}

export class AshbyProcessor implements JobProcessor {
    source = 'ashby';

    async processJob(
        rawJob: AshbyRawJob, 
        sourceData?: JobSource, 
        logger: pino.Logger = defaultLogger 
    ): Promise<ProcessedJobResult> {
        const logJobId = rawJob.jobUrl || rawJob.title || 'unknown_ashby_job';
        const jobLogger = logger.child({ processor: 'ashby', jobId: logJobId });

        // Force log entry
        jobLogger.info("--- ENTERED AshbyProcessor.processJob ---"); 

        // 1. Ensure source data is provided for mapping
        if (!sourceData) {
            jobLogger.error('Job processing failed: Missing sourceData.');
            return { success: false, error: 'Missing sourceData' };
        }
        jobLogger.debug("SourceData check passed.");
        
        // 2. Check if the job is listed
        if (rawJob.isListed === false) {
            jobLogger.info('Job skipped: isListed is false.');
            return { success: false, error: 'Job not listed' };
        }
        jobLogger.debug("isListed check passed.");

        // 3. Check for essential URL (used as sourceId)
        if (!rawJob.jobUrl) {
            jobLogger.warn('Job processing failed: Missing jobUrl.');
            return { success: false, error: 'Missing jobUrl' };
        }
        jobLogger.debug("jobUrl check passed.");
        
        try {
            jobLogger.info("Attempting to call _mapToStandardizedJob..."); // Log before map
            const standardizedJobPartial = this._mapToStandardizedJob(rawJob, sourceData);
            jobLogger.info("Returned from _mapToStandardizedJob. Keys: %s", Object.keys(standardizedJobPartial).join(', ')); // Log after map

            // Basic validation (needs sourceId which is jobUrl)
            if (!standardizedJobPartial.title || !standardizedJobPartial.sourceId) {
                 jobLogger.error({ titleExists: !!standardizedJobPartial.title, sourceIdExists: !!standardizedJobPartial.sourceId }, 'Job processing failed: Mapping missing essential fields.');
                return { success: false, error: 'Mapping failed for essential fields' };
            }
            jobLogger.debug("Essential fields validation passed.");

            jobLogger.info('--- EXITING AshbyProcessor.processJob (SUCCESS) ---');
            return {
                success: true,
                job: standardizedJobPartial as StandardizedJob
            };
        } catch (error: any) {
            jobLogger.error({ errorMsg: error.message, stackPreview: error.stack?.substring(0, 200) }, '--- EXITING AshbyProcessor.processJob (CAUGHT ERROR) ---');
            return { success: false, error: `Processing error: ${error.message}` };
        }
    }

    // No logger needed for mapping
    private _mapToStandardizedJob(job: AshbyRawJob, sourceData: JobSource): Partial<StandardizedJob> {
        // Commenting out cleanHtml usage
        // const descriptionClean = job.descriptionHtml ? cleanHtml(job.descriptionHtml) : '';
        const descriptionClean = job.descriptionHtml || ''; // Use raw HTML for now
        const skills = extractSkills(descriptionClean + ' ' + (job.title || '')); 

        const sourceId = job.jobUrl; // Ensure jobUrl exists before calling this

        // Ensure title exists
        if (!job.title) {
            // Optionally throw an error or return a partial object indicating failure
            throw new Error('Missing required job title for mapping'); 
        }
        
        // Ensure sourceData.name exists
        if (!sourceData.name) {
            throw new Error('Missing required sourceData.name for mapping');
        }

        return {
            source: this.source,
            sourceId: sourceId, // sourceId is now required
            title: job.title, // Title is now guaranteed
            description: descriptionClean,
            applicationUrl: job.applyUrl || job.jobUrl, // Use jobUrl as fallback
            companyName: sourceData.name, // Name is now guaranteed
            companyWebsite: sourceData.companyWebsite ?? undefined, 
            publishedAt: job.publishedAt ? new Date(job.publishedAt) : undefined,
            updatedAt: job.publishedAt ? new Date(job.publishedAt) : undefined,
            jobType: this._mapEmploymentType(job.employmentType),
            experienceLevel: detectExperienceLevel(job.title || ''), 
            skills: skills,
            location: job.location || (job.isRemote ? 'Remote' : undefined),
            country: job.address?.postalAddress?.addressCountry, 
            hiringRegion: this._determineHiringRegion(job),
            workplaceType: job.isRemote ? 'REMOTE' : 'UNKNOWN',
        };
    }
    
    private _mapEmploymentType(type?: string): JobType {
        switch (type) {
            case 'FullTime': return JobType.FULL_TIME;
            case 'PartTime': return JobType.PART_TIME;
            case 'Contract': return JobType.CONTRACT;
            case 'Intern': return JobType.INTERNSHIP;
            case 'Temporary': return JobType.CONTRACT; // Map Temporary to Contract for now
            default: return JobType.UNKNOWN;
        }
    }
    
    private _determineHiringRegion(job: AshbyRawJob): HiringRegion {
        if (job.isRemote === true) {
            return HiringRegion.WORLDWIDE;
        }
        const location = (job.location || '').toLowerCase();
        const latamCountries = ['brazil', 'brasil', 'argentina', 'colombia', 'mexico', 'chile', 'peru'];
        if (latamCountries.some(country => location.includes(country))) {
            return HiringRegion.LATAM;
        }
        if (location.includes('brazil') || location.includes('brasil')) {
            return HiringRegion.BRAZIL;
        }
        return HiringRegion.WORLDWIDE;
    }
} 