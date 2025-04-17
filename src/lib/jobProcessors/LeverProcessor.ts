import { JobProcessor, ProcessedJobResult } from "./types";
import { StandardizedJob } from "../../types/StandardizedJob";
import { JobSource, JobType, ExperienceLevel } from "@prisma/client";
import pino from "pino";
import { LeverApiPosting } from "../fetchers/types"; // Import Lever API type
import { stripHtml } from "../utils/textUtils";
import { detectExperienceLevel, detectJobType, extractSkills } from "../utils/jobUtils";

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const MAX_JOB_AGE_DAYS = 30; // Filter jobs older than 30 days

export class LeverProcessor implements JobProcessor {
    source: string = 'lever'; // Identifier for this processor

    async processJob(rawJob: LeverApiPosting, sourceData?: JobSource): Promise<ProcessedJobResult> {
        // Ensure child logger inherits parent's level if possible, default to env/info
        const effectiveLogLevel = logger.level; // Get the current level of the base logger
        const jobLogger = logger.child({ processor: 'Lever', jobId: rawJob?.id, sourceName: sourceData?.name }, { level: effectiveLogLevel });
        jobLogger.trace('Starting Lever job processing...');

        if (!sourceData) {
            jobLogger.error('Missing sourceData, cannot process job.');
            return { success: false, error: 'Missing sourceData' };
        }

        try {
            if (!rawJob || typeof rawJob !== 'object' || !rawJob.id || !rawJob.text) {
                 throw new Error('Invalid or incomplete raw job data provided');
            }

            // --- Age Filter --- 
            if (rawJob.createdAt) {
                const jobCreationDate = new Date(rawJob.createdAt);
                const maxAgeDate = new Date();
                maxAgeDate.setDate(maxAgeDate.getDate() - MAX_JOB_AGE_DAYS);

                if (jobCreationDate < maxAgeDate) {
                    jobLogger.info({ createdAt: jobCreationDate.toISOString() }, `Job is older than ${MAX_JOB_AGE_DAYS} days, skipping.`);
                    return { success: false, error: `Job older than ${MAX_JOB_AGE_DAYS} days` };
                }
            } else {
                jobLogger.warn('Missing createdAt timestamp, cannot apply age filter.');
                // Decide whether to proceed or fail if timestamp is missing
                // For now, let's proceed but warn
            }
            // --- End Age Filter ---
            
            // Explicitly await, though _mapToStandardizedJob is synchronous
            const standardizedJob = await this._mapToStandardizedJob(rawJob, sourceData); 
            
            jobLogger.info(`Successfully mapped job: ${standardizedJob.title}`);
            return { success: true, job: standardizedJob };

        } catch (error: any) {
            jobLogger.error({ error, rawJobId: rawJob?.id }, 'Failed to process Lever job');
            return { success: false, error: error.message || 'Unknown processing error' };
        }
    }

    private _mapToStandardizedJob(rawJob: LeverApiPosting, sourceData: JobSource): StandardizedJob {
        
        // Use official top-level description field (HTML) as base, fallback to empty
        let baseDescriptionHtml = rawJob.description || ''; 
        
        // Use official top-level descriptionPlain (plain text) or strip the HTML description for text analysis
        const descriptionPlainText = rawJob.descriptionPlain || stripHtml(baseDescriptionHtml);
        const fullTextForAnalysis = `${rawJob.text} ${descriptionPlainText}`; // Use job title (rawJob.text) + description text

        // --- Append top-level Lists Content to Description --- 
        let appendedListContent = '';

        // Access lists directly from rawJob
        if (rawJob.lists && Array.isArray(rawJob.lists)) { 
            for (const list of rawJob.lists) {
                // Append list content if it exists, using list title as heading
                if (list.text && list.content) {
                    // Add a separator and heading for clarity
                    appendedListContent += `<br><hr><br><h3>${stripHtml(list.text)}</h3>${list.content}`;
                }
            }
        }
        // Combine base description with appended list content
        let finalDescriptionHtml = baseDescriptionHtml + appendedListContent;
        // --- End Appending Logic --- 

        // --- Fallback to Plain Text if HTML is still empty ---
        if (!finalDescriptionHtml.trim() && descriptionPlainText.trim()) {
            // Use the base logger for this message
            logger.debug({ jobId: rawJob.id, processor: 'Lever', sourceName: sourceData.name }, 'Using descriptionPlain as fallback since HTML description and lists were empty.');
            // Wrap plain text in paragraphs for basic formatting
            finalDescriptionHtml = '<p>' + descriptionPlainText.replace(/\n+/g, '</p><p>') + '</p>';
        }
        // --- End Fallback ---

        // Determine dates and other fields as before...
        const publishedAt = rawJob.createdAt ? new Date(rawJob.createdAt) : new Date();
        const updatedAt = rawJob.updatedAt ? new Date(rawJob.updatedAt) : publishedAt;
        
        let jobType: JobType = JobType.FULL_TIME; 
        const commitment = rawJob.categories?.commitment?.toLowerCase();
        if (commitment?.includes('part')) { jobType = JobType.PART_TIME; }
        else if (commitment === 'contract' || commitment === 'contractor') { jobType = JobType.CONTRACT; }
        else if (commitment === 'intern' || commitment === 'internship') { jobType = JobType.INTERNSHIP; }

        let minSalary: number | null = null;
        let maxSalary: number | null = null;
        let salaryCurrency: string | null = null; 
        let salaryCycle: string | null = null;
        if (rawJob.salaryRange) {
            minSalary = rawJob.salaryRange.min;
            maxSalary = rawJob.salaryRange.max;
            const rawCurrency = rawJob.salaryRange.currency?.toUpperCase();
            if (rawCurrency && typeof rawCurrency === 'string' && rawCurrency.length > 0) { 
                salaryCurrency = rawCurrency; 
            } else if (rawCurrency) {
                logger.warn({ rawCurrency, jobId: rawJob.id }, 'Unexpected salary currency format encountered');
            }
            const interval = rawJob.salaryRange.interval?.toLowerCase();
            if (interval === 'year' || interval === 'yearly' || interval === 'annual') { salaryCycle = 'YEARLY'; }
            else if (interval === 'month' || interval === 'monthly') { salaryCycle = 'MONTHLY'; }
            else if (interval) { salaryCycle = interval.toUpperCase(); }
        }

        // Determine remote status based on workplaceType primarily, fallback to location category
        let isRemote = false;
        const workplaceTypeLower = rawJob.workplaceType?.toLowerCase();
        const locationLower = rawJob.categories?.location?.toLowerCase() || '';

        if (workplaceTypeLower === 'remote') {
            isRemote = true;
        } else if (workplaceTypeLower !== 'on-site' && workplaceTypeLower !== 'hybrid') {
            // If not explicitly on-site/hybrid, check location for remote keywords
            // Using a simple includes check for this example
            if (locationLower.includes('remote')) {
                isRemote = true;
            }
        }

        return {
            title: rawJob.text,
            companyName: sourceData.name, 
            source: this.source,
            sourceId: String(rawJob.id),
            applicationUrl: rawJob.applyUrl || rawJob.hostedUrl, 
            location: rawJob.categories?.location || (isRemote ? 'Remote' : 'Unknown'),
            isRemote: isRemote, // Add isRemote field
            description: finalDescriptionHtml, 
            publishedAt: publishedAt,
            updatedAt: updatedAt,
            experienceLevel: detectExperienceLevel(fullTextForAnalysis), 
            jobType: jobType, // Already calculated
            skills: extractSkills(fullTextForAnalysis),
            minSalary: minSalary ?? undefined,
            maxSalary: maxSalary ?? undefined,
            currency: salaryCurrency,
            salaryCycle: salaryCycle ?? undefined,
            // Add other potential missing fields with defaults or nulls
            status: 'ACTIVE', // Default to ACTIVE
            companyLogo: sourceData.logoUrl ?? undefined, // Use logo from sourceData if available, default undefined
            companyWebsite: sourceData.companyWebsite ?? undefined, // Use website from sourceData if available, default undefined
            country: 'Unknown', // Default or derive later if possible
            workplaceType: rawJob.workplaceType?.toUpperCase() ?? (isRemote ? 'REMOTE' : 'UNKNOWN'), // Map to enum/string
            visas: [], // Default
            languages: [], // Default
            hiringRegion: undefined, // Default undefined
        };
    }
} 