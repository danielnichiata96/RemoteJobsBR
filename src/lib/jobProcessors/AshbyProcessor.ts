import { StandardizedJob } from '../../types/StandardizedJob';
import { JobProcessor, ProcessedJobResult } from './types';
import { JobSource, JobType, ExperienceLevel, JobStatus, Prisma, HiringRegion } from '@prisma/client';
import pino from 'pino';
import { detectJobType, detectExperienceLevel, extractSkills } from '../utils/jobUtils';
import { stripHtml, parseDate } from '../utils/textUtils';
import { AshbyApiJob, AshbyLocation } from '../fetchers/types'; 

// --- Interfaces Corretas para API Ashby --- (REMOVED - Moved to fetchers/types.ts)
/*
interface AshbyLocation { ... }
interface AshbyRawJob { ... } // Replaced by AshbyApiJob
*/

// Logger default
const defaultLogger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class AshbyProcessor implements JobProcessor {
    readonly source = 'ashby';

    /**
     * Determines if a job is relevant based on remote/LATAM criteria
     * Used by processJob to filter out irrelevant jobs early
     */
    private _isJobRelevant(job: AshbyApiJob, logger: pino.Logger): boolean {
        if (!job.isListed) {
            logger.debug({ title: job.title, id: job.id }, 'Rejecting job: isListed is false');
            return false;
        }

        // Check isRemote flag first (most explicit)
        if (job.isRemote === true) {
            logger.debug({ title: job.title, id: job.id }, 'Accepting job: isRemote is true');
            return true;
        }

        // Check location names for remote or LATAM keywords
        const locationString = this._buildLocationString(job.locations, job.secondaryLocations, job.isRemote, logger);
        const locationLower = locationString.toLowerCase();

        // Check for remote keywords
        if (locationLower.includes('remote') || locationLower.includes('anywhere') || locationLower.includes('global')) {
            logger.debug({ title: job.title, location: locationString }, 'Accepting job: Remote keyword found in location');
            return true;
        }

        // Check for LATAM keywords
        const latamKeywords = ['brazil', 'brasil', 'latam', 'latin america', 'south america'];
        const hasLatamKeyword = latamKeywords.some(keyword => locationLower.includes(keyword));

        if (hasLatamKeyword) {
            logger.debug({ title: job.title, location: locationString }, 'Accepting job: LATAM keyword found in location');
            return true;
        }

        // Fallback to job description for remote signals (if needed)
        const descriptionText = job.descriptionPlain || stripHtml(job.descriptionHtml) || '';
        const descriptionLower = descriptionText.toLowerCase();

        if (
            descriptionLower.includes('remote') ||
            descriptionLower.includes('work from home') ||
            descriptionLower.includes('work from anywhere')
        ) {
            logger.debug({ title: job.title }, 'Accepting job: Remote keyword found in description');
            return true;
        }

        // Combine title and description for LATAM check
        const fullText = `${job.title?.toLowerCase() || ''} ${descriptionLower}`;
        const hasLatamInText = latamKeywords.some(keyword => fullText.includes(keyword));

        if (hasLatamInText) {
            logger.debug({ title: job.title }, 'Accepting job: LATAM keyword found in title/description');
            return true;
        }

        // If we got here, the job is not relevant
        logger.debug({ title: job.title, location: locationString }, 'Rejecting job: Did not meet remote/LATAM criteria');
        return false;
    }

    async processJob(
        rawJob: AshbyApiJob, // Using the shared AshbyApiJob type now
        sourceData: JobSource,
        logger: pino.Logger = defaultLogger
    ): Promise<ProcessedJobResult> {
        const logJobId = rawJob.jobUrl || rawJob.id || 'unknown_ashby_job';
        const jobLogger = logger.child({ processor: 'ashby', jobId: logJobId, jobTitle: rawJob.title });

        jobLogger.debug("--- ENTERED AshbyProcessor.processJob ---");

        if (!rawJob.title) {
            jobLogger.warn('Job processing skipped: Missing title.');
            return { success: false, error: 'Missing title' };
        }
        
        // Check for missing sourceId (both jobUrl and id)
        if (!rawJob.jobUrl && !rawJob.id) {
            jobLogger.warn({ title: rawJob.title }, 'Could not determine a unique sourceId. Both jobUrl and id are missing.');
            return { success: false, error: 'Missing jobUrl to use as sourceId' };
        }
        
        const sourceId = rawJob.jobUrl || rawJob.id;

        // Early relevance check
        if (!this._isJobRelevant(rawJob, jobLogger)) {
            jobLogger.info('Job determined irrelevant and skipped.');
            return { success: false, error: 'Job determined irrelevant' };
        }

        jobLogger.trace("Initial raw job validation passed.");

        try {
            jobLogger.trace("Attempting to map raw job to StandardizedJob...");
            // Pass AshbyApiJob directly
            const standardizedJobPartial = this._mapToStandardizedJob(rawJob, sourceData, sourceId, jobLogger);
            jobLogger.trace("Mapping successful.");

            return {
                success: true,
                job: standardizedJobPartial as Omit<StandardizedJob, 'id' | 'createdAt' | 'status'>
            };
        } catch (error: any) {
            jobLogger.error({ errorMsg: error.message, stackPreview: error.stack?.substring(0, 200) }, 'Error during mapping in _mapToStandardizedJob');
            return { success: false, error: `Mapping error: ${error.message}` };
        }
    }

    private _mapToStandardizedJob(
        job: AshbyApiJob, // Using AshbyApiJob here too
        sourceData: JobSource,
        sourceId: string,
        logger: pino.Logger
    ): Omit<StandardizedJob, 'id' | 'createdAt' | 'updatedAt' | 'status'> 
    {
        logger.trace("Starting _mapToStandardizedJob execution.");

        const textForAnalysis = job.descriptionPlain || stripHtml(job.descriptionHtml) || '';
        const combinedTextForAnalysis = `${job.title || ''} ${textForAnalysis}`;
        logger.trace({ textLength: combinedTextForAnalysis.length }, "Prepared text for analysis.");

        const skills = extractSkills(combinedTextForAnalysis);
        logger.trace({ skillCount: skills.length }, "Extracted skills.");

        const experienceLevel = detectExperienceLevel(combinedTextForAnalysis);
        logger.trace({ experienceLevel }, "Detected experience level.");

        const jobType = this._mapEmploymentType(job.employmentType);
        logger.trace({ employmentType: job.employmentType, mappedJobType: jobType }, "Mapped employment type.");

        // Pass AshbyLocation[] directly
        const locationString = this._buildLocationString(job.locations, job.secondaryLocations, job.isRemote, logger);
        logger.trace({ locationString }, "Built location string.");

        // Map hiringRegion based on _determinedHiringRegionType
        let hiringRegion: HiringRegion | undefined = undefined;
        if (job._determinedHiringRegionType === 'latam') {
            hiringRegion = HiringRegion.LATAM;
        } else if (job._determinedHiringRegionType === 'global') {
            hiringRegion = HiringRegion.WORLDWIDE;
        } else if (locationString.toLowerCase().includes('brazil') || locationString.toLowerCase().includes('brasil')) {
            hiringRegion = HiringRegion.BRAZIL;
        }
        logger.trace({ hiringRegionType: job._determinedHiringRegionType, hiringRegion }, "Determined hiring region.");

        const workplaceType = (job.isRemote === true || job._determinedHiringRegionType !== undefined) ? 'REMOTE' : 'UNKNOWN'; 
        logger.trace({ hiringRegionType: job._determinedHiringRegionType, isRemote: job.isRemote, workplaceType }, "Determined hiring region type and workplace type.");

        const publishedAt = parseDate(job.publishedAt);
        const jobUpdatedAt = parseDate(job.updatedAt);
        logger.trace({ publishedAt, jobUpdatedAt }, "Parsed dates.");

        // Determine country based on location and hiringRegion
        let country = undefined;
        if (hiringRegion === HiringRegion.BRAZIL) {
            country = 'Brazil';
        } else if (hiringRegion === HiringRegion.LATAM) {
            country = 'LATAM';
        } else if (hiringRegion === HiringRegion.WORLDWIDE) {
            country = 'Worldwide';
        }

        const mappedJob: Omit<StandardizedJob, 'id' | 'createdAt' | 'updatedAt' | 'status'> = {
            source: this.source,
            sourceId: sourceId,
            title: job.title,
            description: job.descriptionHtml || job.descriptionPlain || '',
            location: locationString,
            applicationUrl: job.applyUrl || job.jobUrl || '',
            companyName: sourceData.name,
            companyWebsite: sourceData.companyWebsite ?? undefined,
            publishedAt: publishedAt ?? new Date(),
            jobType: jobType,
            experienceLevel: experienceLevel,
            jobType2: job._determinedHiringRegionType,
            hiringRegion: hiringRegion, // Add hiringRegion field
            country: country, // Add country field 
            workplaceType: workplaceType,
            skills: skills,
            minSalary: undefined,
            maxSalary: undefined,
            currency: undefined,
            salaryCycle: undefined,
        };
        logger.trace("Finished mapping to StandardizedJob partial object.");
        return mappedJob;
    }

    private _mapEmploymentType(type?: string | null): JobType {
        switch (type) {
            case 'FullTime': return JobType.FULL_TIME;
            case 'PartTime': return JobType.PART_TIME;
            case 'Contract': return JobType.CONTRACT;
            case 'Intern': return JobType.INTERNSHIP;
            case 'Temporary': return JobType.CONTRACT;
            default: return JobType.UNKNOWN;
        }
    }

    private _buildLocationString(
        locations: AshbyLocation[] | undefined | null, // Using shared AshbyLocation
        secondaryLocations: AshbyLocation[] | undefined | null, // Using shared AshbyLocation
        isJobRemote: boolean | null,
        logger: pino.Logger
    ): string {
        const allLocations = [...(locations || []), ...(secondaryLocations || [])];
        if (allLocations.length === 0) {
            return isJobRemote === true ? 'Remote' : 'Location Unknown';
        }

        const locationParts = new Set<string>();

        // Location name handling - Process both name and address
        allLocations.forEach(loc => {
            if (!loc) return; // Safety check

            // Special case for remote locations
            if (loc.isRemote === true || (loc.name && loc.name.toLowerCase() === 'remote')) {
                locationParts.add('Remote');
                return;
            }

            // Process location name if present and not already handled as remote
            if (loc.name) {
                locationParts.add(loc.name);
            }

            // Also add address details if available
            if (loc.address) {
                const addressParts = [];
                if (loc.address.city) addressParts.push(loc.address.city);
                if (loc.address.state) addressParts.push(loc.address.state);
                if (loc.address.countryCode) addressParts.push(loc.address.countryCode.toUpperCase());
                
                const addressString = addressParts.join(', ');
                if (addressString) {
                    locationParts.add(addressString);
                }
            }
        });

        // Combine all unique location parts
        let finalString = [...locationParts].join(' | ');

        // Fallback for remote jobs with no location parts
        if (!finalString && isJobRemote === true) {
            finalString = 'Remote';
        }
        
        // Final fallback for cases with no location information
        if (!finalString) {
            finalString = 'Location Not Specified';
        }

        logger.trace({ finalLocationString: finalString }, "Generated location string.");
        return finalString;
    }
} 