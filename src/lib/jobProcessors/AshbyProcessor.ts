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
// Based on: https://app.ashbyhq.com/docs/api/job-board-api
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
    // compensation data is optional and might be added later
}

interface AshbyAddress {
    addressLocality?: string; // City
    addressRegion?: string; // State/Province
    addressCountry?: string;
}

/**
 * Processes raw job data from the Ashby API into a StandardizedJob format.
 */
export class AshbyProcessor implements JobProcessor {
    source = 'ashby';

    // Method signature now accepts an optional logger
    async processJob(
        rawJob: AshbyRawJob, 
        sourceData?: JobSource, 
        // Optional logger parameter, defaults to the module-scoped logger
        logger: pino.Logger = defaultLogger 
    ): Promise<ProcessedJobResult> {
        // Ensure sourceData is provided, as it's needed for mapping company info
        if (!sourceData) {
            // Use the provided (or default) logger for errors before child creation
            logger.error({ rawJob }, 'Missing sourceData in AshbyProcessor.processJob');
            return { success: false, error: 'Internal error: Missing sourceData' };
        }
        
        // Use the provided logger to create the job-specific child logger
        const jobLogger = logger.child({ processor: 'Ashby', sourceName: sourceData.name, jobId: rawJob.jobUrl }); 
        // jobLogger.debug('AshbyProcessor.processJob called'); // Removed entry log

        // Early exit if jobUrl is missing, as it's used for sourceId
        if (!rawJob.jobUrl) {
            // Use the job-specific logger created from the provided logger
            jobLogger.warn({ title: rawJob.title }, 'Could not determine a unique sourceId (using jobUrl)');
            return { success: false, error: 'Missing jobUrl to use as sourceId' };
        }

        try {
            // Pass the job-specific logger to helper methods
            const isRelevant = this._isJobRelevant(rawJob, jobLogger); 
            // jobLogger.debug({ isRelevantResult: isRelevant }, 'Result from _isJobRelevant'); // Removed relevance check log

            if (!isRelevant) {
                return { success: false, error: 'Job determined irrelevant' };
            }
            
            const standardizedJobPartial = this._mapToStandardizedJob(rawJob, sourceData);
            
            jobLogger.debug({ partialJobSourceId: standardizedJobPartial.sourceId }, 'Checking for sourceId before casting'); // Log before check
            // Ensure sourceId is present before considering it a full StandardizedJob
            if (!standardizedJobPartial.sourceId) {
                 jobLogger.warn({ rawJob }, 'Could not determine a unique sourceId (using jobUrl)');
                 return { success: false, error: 'Missing jobUrl to use as sourceId' };
            }

            // Now we are sure sourceId exists, cast to StandardizedJob for the return type
            const standardizedJob = standardizedJobPartial as StandardizedJob;

            return { success: true, job: standardizedJob };
        } catch (error) {
            // Check if error is an instance of Error before accessing message
            const errorMessage = error instanceof Error ? error.message : 'Unknown error during processing';
            jobLogger.error({ error, rawJob }, `Error processing Ashby job: ${errorMessage}`);
            return { success: false, error: errorMessage };
        }
    }

    // Pass the job-specific logger to helper methods
    private _isJobRelevant(job: AshbyRawJob, jobLogger: pino.Logger): boolean {
        // jobLogger.debug('_isJobRelevant check started'); // Removed entry log
        // 1. Filter out unlisted jobs
        if (job.isListed === false) {
            jobLogger.debug({ title: job.title, jobUrl: job.jobUrl }, 'Skipping job: isListed is false.');
            return false;
        }

        // 2. Prioritize the isRemote flag
        if (job.isRemote === true) {
            jobLogger.debug({ title: job.title, jobUrl: job.jobUrl }, 'Job marked as relevant: isRemote is true.');
            return true; // Definitely relevant
        }
        // jobLogger.debug({ isRemoteValue: job.isRemote }, 'Checked isRemote flag'); // Removed log after isRemote check

        // 3. Check location fields for Brazil/LATAM/Remote keywords
        // TODO: Refine keywords and logic, similar to GreenhouseProcessor
        const locationsToCheck = [
            job.location,
            job.address?.postalAddress?.addressLocality,
            job.address?.postalAddress?.addressRegion,
            job.address?.postalAddress?.addressCountry,
            ...(job.secondaryLocations?.map(l => [
                l.location,
                l.address?.addressLocality,
                l.address?.addressRegion,
                l.address?.addressCountry
            ]).flat() ?? [])
        ].filter(Boolean).map(loc => loc!.toLowerCase()); // Use non-null assertion

        // Basic keywords (should be externalized like Greenhouse)
        const remoteKeywords = ['remote', 'anywhere', 'global', 'worldwide'];
        const latamKeywords = ['latam', 'latin america', 'south america', 'brasil', 'brazil', 'argentina', 'colombia', 'chile', 'mexico', 'peru'];

        for (const loc of locationsToCheck) {
            if (remoteKeywords.some(kw => loc.includes(kw))) {
                jobLogger.debug({ title: job.title, jobUrl: job.jobUrl, location: loc }, 'Job marked as relevant: Remote keyword found in location fields.');
                return true;
            }
            if (latamKeywords.some(kw => loc.includes(kw))) {
                 jobLogger.debug({ title: job.title, jobUrl: job.jobUrl, location: loc }, 'Job marked as relevant: LATAM keyword found in location fields.');
                return true;
            }
        }
        
        // 4. Check title and description as a last resort (less reliable)
        const title = job.title?.toLowerCase() || '';
        const description = job.descriptionPlain?.toLowerCase() || ''; // Use plain text description
        
        // Combine keywords for searching text
        const textKeywords = [...remoteKeywords, ...latamKeywords];
        if (textKeywords.some(kw => title.includes(kw) || description.includes(kw))) {
             jobLogger.debug({ title: job.title, jobUrl: job.jobUrl }, 'Job marked as potentially relevant: Keyword found in title or description.');
             return true;
        }

        jobLogger.debug({ title: job.title, jobUrl: job.jobUrl, location: job.location }, 'Skipping job: Did not meet remote/LATAM criteria based on available fields.');
        return false;
    }

    // No logger needed for mapping
    private _mapToStandardizedJob(job: AshbyRawJob, sourceData: JobSource): Partial<StandardizedJob> {
        // Commenting out cleanHtml usage
        // const descriptionClean = job.descriptionHtml ? cleanHtml(job.descriptionHtml) : '';
        const descriptionClean = job.descriptionHtml || ''; // Use raw HTML for now
        const skills = extractSkills(descriptionClean + ' ' + (job.title || '')); 

        const sourceId = job.jobUrl;

        return {
            source: this.source,
            sourceId: sourceId,
            title: job.title,
            description: descriptionClean,
            applicationUrl: job.applyUrl || job.jobUrl, 
            // sourceUrl: job.jobUrl, // Removed invalid field
            companyName: sourceData.name, 
            // logoUrl: sourceData.logoUrl ?? undefined, // Removed invalid field
            companyWebsite: sourceData.companyWebsite ?? undefined, 
            // Commenting out parseDate usage
            // publishedAt: job.publishedAt ? parseDate(job.publishedAt) : undefined,
            // updatedAt: job.publishedAt ? parseDate(job.publishedAt) : undefined, 
            publishedAt: job.publishedAt ? new Date(job.publishedAt) : undefined, // Basic Date conversion for now
            updatedAt: job.publishedAt ? new Date(job.publishedAt) : undefined, // Basic Date conversion for now
            jobType: this._mapEmploymentType(job.employmentType),
            experienceLevel: detectExperienceLevel(job.title || ''), 
            skills: skills,
            location: job.location || (job.isRemote ? 'Remote' : undefined), 
            country: job.address?.postalAddress?.addressCountry, 
            hiringRegion: this._determineHiringRegion(job), 
            workplaceType: job.isRemote ? 'REMOTE' : 'UNKNOWN', 
            status: JobStatus.ACTIVE, // Assume jobs from Ashby are active
        };
    }
    
    // No logger needed here
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
    
    // No logger needed here
    private _determineHiringRegion(job: AshbyRawJob): HiringRegion | undefined {
        // Basic logic, can be expanded
        const locationsToCheck = [
            job.location,
            job.address?.postalAddress?.addressLocality,
            job.address?.postalAddress?.addressRegion,
            job.address?.postalAddress?.addressCountry,
             ...(job.secondaryLocations?.map(l => [
                 l.location,
                 l.address?.addressLocality,
                 l.address?.addressRegion,
                 l.address?.addressCountry
             ]).flat() ?? [])
        ].filter(Boolean).map(loc => loc!.toLowerCase()); // Use non-null assertion
        
        const latamKeywords = ['latam', 'latin america', 'south america'];
        const brazilKeywords = ['brasil', 'brazil'];
        const worldwideKeywords = ['remote', 'global', 'worldwide', 'anywhere'];

        // Prioritize specific regions first
        if (locationsToCheck.some(loc => brazilKeywords.some(kw => loc.includes(kw)))) {
            return HiringRegion.BRAZIL;
        }
        if (locationsToCheck.some(loc => latamKeywords.some(kw => loc.includes(kw)))) {
            return HiringRegion.LATAM;
        }
        // Check for general remote/worldwide keywords or the isRemote flag last
        if (job.isRemote === true || locationsToCheck.some(loc => worldwideKeywords.some(kw => loc.includes(kw)))) {
            return HiringRegion.WORLDWIDE;
        }
        
        // TODO: Add more specific country checks if needed

        return undefined; // Default if no specific region identified
    }
} 