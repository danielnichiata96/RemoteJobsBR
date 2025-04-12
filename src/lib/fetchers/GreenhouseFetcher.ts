import axios, { AxiosError } from 'axios';
import { decode } from 'html-entities';
import { PrismaClient, JobSource, JobStatus, JobType, ExperienceLevel } from '@prisma/client';
import pMap from 'p-map';
import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';
import { JobProcessingAdapter } from '../adapters/JobProcessingAdapter';
import { FilterConfig, FilterMetadataConfig, getGreenhouseConfig } from '../../types/JobSource'; // Adjust path
import { StandardizedJob } from '../../types/StandardizedJob'; // Adjust path
import { extractSkills, detectJobType, detectExperienceLevel } from '../utils/jobUtils';
import { JobFetcher, SourceStats, FetcherResult } from './types';

// --- Greenhouse Specific Interfaces ---
interface GreenhouseOffice {
    id: number;
    name: string;
    location: string;
}
interface GreenhouseMetadata {
    id: number;
    name: string;
    value: string | string[] | null;
}
interface GreenhouseJob {
    id: number;
    title: string;
    updated_at: string;
    location: { name: string };
    content: string;
    absolute_url: string;
    metadata: GreenhouseMetadata[];
    offices: GreenhouseOffice[];
    departments: Array<{ name: string }>;
    company?: { name: string };
}
interface FilterResult {
    relevant: boolean;
    reason: string;
    type?: 'global' | 'latam';
}

export class GreenhouseFetcher implements JobFetcher {
    private prisma: PrismaClient;
    private jobProcessor: JobProcessingAdapter;

    constructor(prismaClient: PrismaClient, jobProcessingAdapter: JobProcessingAdapter) {
        this.prisma = prismaClient;
        this.jobProcessor = jobProcessingAdapter;
    }

    async processSource(source: JobSource, parentLogger: pino.Logger): Promise<FetcherResult> {
        const sourceLogger = parentLogger.child({ fetcher: 'Greenhouse', sourceName: source.name, sourceId: source.id });
        const stats: SourceStats = { found: 0, relevant: 0, processed: 0, deactivated: 0, errors: 0 }; // Deactivated will be handled by orchestrator
        const foundSourceIds = new Set<string>();
        let filterConfig: FilterConfig | null = null;
        let boardToken: string | null = null;
        let apiUrl: string | null = null;

        try {
            // --- Load Configuration ---
            const greenhouseConfig = getGreenhouseConfig(source.config);
            if (!greenhouseConfig || !greenhouseConfig.boardToken) {
                sourceLogger.error('❌ Missing or invalid boardToken in source config');
                stats.errors++;
                return { stats, foundSourceIds }; // Return early
            }
            boardToken = greenhouseConfig.boardToken;
            apiUrl = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
            sourceLogger.info({ boardToken }, `-> Starting processing...`);

            try {
                const configPath = path.resolve(__dirname, '../../config/greenhouse-filter-config.json');
                const configFile = fs.readFileSync(configPath, 'utf-8');
                filterConfig = JSON.parse(configFile) as FilterConfig;
                sourceLogger.info({ configPath }, `Successfully loaded filter configuration`);
            } catch (error: any) {
                sourceLogger.error({ err: error, configPath: path.resolve(__dirname, '../../config/greenhouse-filter-config.json') }, `❌ Failed to load or parse filter configuration. Aborting.`);
                stats.errors++;
                return { stats, foundSourceIds };
            }

            // --- Fetch Jobs --- 
            sourceLogger.debug({ apiUrl }, 'Fetching jobs from Greenhouse API...');
            const response = await axios.get(apiUrl, { timeout: 45000 });

            if (!response.data || !Array.isArray(response.data.jobs)) {
                sourceLogger.error({ responseStatus: response.status, responseData: response.data }, '❌ Invalid response structure from Greenhouse API');
                stats.errors++;
                return { stats, foundSourceIds };
            }
            const apiJobs: GreenhouseJob[] = response.data.jobs;
            stats.found = apiJobs.length;
            apiJobs.forEach(job => foundSourceIds.add(String(job.id))); // Collect all found IDs
            sourceLogger.info(`+ ${stats.found} jobs found in API response.`);
            
            if (apiJobs.length > 0) {
                sourceLogger.trace({ sampleJobId: apiJobs[0].id, sampleJobTitle: apiJobs[0].title }, 'Sample job structure check');
            }

            // --- Process Jobs --- 
            sourceLogger.debug(`Processing ${apiJobs.length} jobs for relevance...`);
            await pMap(apiJobs, async (job) => {
                try {
                    const relevanceResult = this._isJobRelevant(job, filterConfig!, sourceLogger);
                    if (relevanceResult.relevant) {
                        stats.relevant++;
                        sourceLogger.info(
                            { jobId: job.id, jobTitle: job.title, reason: relevanceResult.reason, type: relevanceResult.type },
                            `➡️ Relevant job found`
                        );

                        // Enhance the job object with the determined hiring region type
                        const enhancedJob = {
                            ...job,
                            _determinedHiringRegionType: relevanceResult.type // Add the type here
                        };

                        // Pass the *enhanced* job object and the source details to the adapter
                        const saved = await this.jobProcessor.processRawJob('greenhouse', enhancedJob, source);
                        
                        if (saved) {
                            stats.processed++;
                            sourceLogger.debug({ jobId: job.id }, 'Job processed/saved via adapter.');
                        } else {
                            // Logging handled within adapter/processor
                             sourceLogger.warn({ jobId: job.id, jobTitle: job.title }, 'Adapter reported job not saved (processor failure, irrelevant, or save issue).');
                        }
                    } else {
                        sourceLogger.trace({ jobId: job.id, jobTitle: job.title, reason: relevanceResult.reason }, `Job skipped as irrelevant`);
                    }
                } catch (jobError: any) { // Catch errors during relevance check or adapter call
                    stats.errors++;
                    // Log more error details
                    const errorDetails = {
                        message: jobError?.message,
                        stack: jobError?.stack,
                        name: jobError?.name,
                        // Add other relevant properties if needed
                    };
                    sourceLogger.error({ 
                        jobId: job.id, 
                        jobTitle: job?.title, 
                        error: errorDetails // Log the extracted details
                    }, '❌ Error processing individual job or calling adapter');
                }
            }, { concurrency: 5, stopOnError: false });

            sourceLogger.info(`✓ Processing completed.`);

        } catch (error) {
            stats.errors++;
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError;
                sourceLogger.error(
                    { status: axiosError.response?.status, data: axiosError.response?.data, message: axiosError.message, apiUrl },
                    `❌ Axios error fetching jobs for source`
                );
            } else {
                sourceLogger.error({ error, boardToken, apiUrl }, '❌ General error processing source');
            }
        }

        return { stats, foundSourceIds };
    }

    // --- Private Helper Methods (Replaced with stricter logic provided by user) ---

    // Function to normalize and check keywords (case-insensitive)
    private _includesKeyword(text: string | null | undefined, keywords: string[]): boolean {
        if (!text) return false;
        const lowerText = text.toLowerCase();
        // Use word boundaries for some keywords to avoid partial matches (e.g., 'us' in 'business') ?
        // For now, stick to includes, but be aware of potential false positives.
        return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
    };

    // Helper to process and clean job content for keyword checks
    private _processJobContent(content: string): string {
        if (!content) return '';
        try {
            let processedContent = decode(content); // Decode HTML entities
            // Basic tag stripping (consider sanitize-html for robustness)
            processedContent = processedContent.replace(/<style[^>]*>.*<\/style>/gms, ''); // Remove style blocks
            processedContent = processedContent.replace(/<script[^>]*>.*<\/script>/gms, ''); // Remove script blocks
            processedContent = processedContent.replace(/<[^>]+>/g, ' '); // Replace all tags with spaces

            // Normalize whitespace
            processedContent = processedContent
                .replace(/(\r\n|\n|\r){2,}/g, '\n') // Collapse multiple newlines to one
                .replace(/[ \t]{2,}/g, ' ') // Collapse multiple spaces/tabs to one
                .replace(/\n /g, '\n') // Remove space after newline
                .replace(/ \n/g, '\n') // Remove space before newline
                .trim();

            return processedContent;
        } catch (error) {
            // Use a logger if available, otherwise console.error
            console.error('Error processing job content:', error);
            return content; // Return original on error
        }
    }


    // Check metadata (adapted from user example)
    private _checkMetadataForRemoteness(metadata: GreenhouseMetadata[], filterConfig: FilterConfig, logger: pino.Logger): 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN' {
        if (!metadata || metadata.length === 0 || !filterConfig.REMOTE_METADATA_FIELDS) return 'UNKNOWN';

        let hasLatamIndicator = false;
        let hasGlobalIndicator = false;
        let hasRejectionIndicator = false;

        for (const item of metadata) {
            const fieldNameLower = item.name?.toLowerCase() || '';
            // Find config entry matching the field name (case-insensitive)
            const configKey = Object.keys(filterConfig.REMOTE_METADATA_FIELDS).find(key => key === fieldNameLower);
            const config = configKey ? filterConfig.REMOTE_METADATA_FIELDS[configKey] : undefined;

            if (config) {
                const value = typeof item.value === 'string' ? item.value.toLowerCase() :
                              Array.isArray(item.value) ? item.value.map(v => v?.toLowerCase()).filter(Boolean) : // Handle string arrays
                              null;
                if (!value) continue;

                const checkValue = (val: string): void => {
                     switch (config.type) {
                        case 'boolean':
                            if ('positiveValue' in config && val === config.positiveValue?.toLowerCase()) {
                                hasGlobalIndicator = true; // Assume global unless specified otherwise
                            } else if ('negativeValue' in config && config.negativeValue && val === config.negativeValue.toLowerCase()) { // Added optional negativeValue check
                                 hasRejectionIndicator = true;
                            } else {
                                 // If boolean but not matching positive/negative, could be reject or unknown based on field meaning
                                 // For simplicity, let's assume non-positive boolean means reject for 'remote eligible' style fields
                                 if (fieldNameLower === 'remote eligible') hasRejectionIndicator = true;
                            }
                            break;
                        case 'string':
                             if ('disallowedValues' in config && config.disallowedValues?.some(disallowed => val.includes(disallowed.toLowerCase()))) {
                                hasRejectionIndicator = true;
                            }
                             // Check allowed values *before* positive values for more specific matching
                            if ('allowedValues' in config && config.allowedValues?.some(allowed => val.includes(allowed.toLowerCase()))) {
                                const allowedValue = config.allowedValues.find(allowed => val.includes(allowed.toLowerCase()));
                                if (allowedValue) {
                                    if (['latam', 'americas'].includes(allowedValue.toLowerCase())) {
                                        hasLatamIndicator = true;
                                    } else if (['worldwide', 'global'].includes(allowedValue.toLowerCase())) {
                                         hasGlobalIndicator = true;
                                    } else {
                                         // If allowed but not global/latam (e.g., 'US'), treat as rejection
                                         hasRejectionIndicator = true;
                                    }
                                }
                            }
                            // Check positive values if no specific allowed match determined acceptance/rejection
                            else if (!hasLatamIndicator && !hasGlobalIndicator && !hasRejectionIndicator && 'positiveValues' in config && config.positiveValues?.some(positive => val.includes(positive.toLowerCase()))) {
                                 const positiveValue = config.positiveValues.find(positive => val.includes(positive.toLowerCase()));
                                 if (positiveValue) {
                                     if (['latam', 'americas'].includes(positiveValue.toLowerCase())) {
                                         hasLatamIndicator = true;
                                     } else {
                                         // Assume other positive values mean global
                                         hasGlobalIndicator = true;
                                     }
                                 }
                            }
                            break;
                    }
                };

                if (typeof value === 'string') {
                     checkValue(value);
                } else if (Array.isArray(value)) {
                     value.forEach(checkValue); // Check each value in the array
                }
            }
             // If we found a rejection signal, we can stop checking this metadata item
            if (hasRejectionIndicator) break;
        }

        // Decision priority: Reject > LATAM > Global
        if (hasRejectionIndicator) return 'REJECT';
        if (hasLatamIndicator) return 'ACCEPT_LATAM';
        if (hasGlobalIndicator) return 'ACCEPT_GLOBAL';

        return 'UNKNOWN'; // No conclusive indicators found
    }


    // Check location name (adapted from user example)
    private _checkLocationName(locationName: string | null | undefined, filterConfig: FilterConfig, logger: pino.Logger): 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN' {
        if (!locationName) return 'UNKNOWN'; // Treat missing location as unknown

        const nameLower = locationName.toLowerCase().trim();
        const keywords = filterConfig.LOCATION_KEYWORDS; // Use loaded config

        // --- Strong Rejection First ---
        // Check specific negative keywords
        if (this._includesKeyword(nameLower, keywords.STRONG_NEGATIVE_RESTRICTION)) {
            // Further check needed: Avoid rejecting "Remote - Latin America" just because it contains "Remote - "
            const isExplicitLatam = this._includesKeyword(nameLower, keywords.STRONG_POSITIVE_LATAM);
            const isExplicitGlobal = this._includesKeyword(nameLower, keywords.STRONG_POSITIVE_GLOBAL);

            if (!isExplicitLatam && !isExplicitGlobal) {
                 // Check if a negative keyword *specifically* matches, not just a substring of a positive one
                 const matchedNegative = keywords.STRONG_NEGATIVE_RESTRICTION.find(neg => nameLower.includes(neg.toLowerCase()));
                 // More robust check: ensure the matched negative term isn't part of an allowed phrase
                 if (matchedNegative && !keywords.STRONG_POSITIVE_LATAM.some(pos => nameLower.includes(pos.toLowerCase())) && !keywords.STRONG_POSITIVE_GLOBAL.some(pos => nameLower.includes(pos.toLowerCase()))) {
                      logger.trace({ locationName, matchedNegative }, 'Location rejected due to STRONG_NEGATIVE_RESTRICTION keyword');
                      return 'REJECT';
                 }
            }
        }
        // Reject if it contains a non-LATAM city/country name and isn't explicitly Worldwide/LATAM
         const containsNonLatamLocation = keywords.STRONG_NEGATIVE_RESTRICTION.some(loc => nameLower.includes(loc.toLowerCase()) && !['remote - ', 'remote in ', 'remote from '].includes(loc.toLowerCase())); // Avoid generic 'remote - ' triggering this alone
         if (containsNonLatamLocation && !this._includesKeyword(nameLower, keywords.STRONG_POSITIVE_LATAM) && !this._includesKeyword(nameLower, keywords.STRONG_POSITIVE_GLOBAL)) {
             logger.trace({ locationName }, 'Location rejected due to specific non-LATAM city/country name');
             return 'REJECT';
         }

        // --- Strong Acceptance ---
        if (this._includesKeyword(nameLower, keywords.STRONG_POSITIVE_GLOBAL)) {
            logger.trace({ locationName }, 'Location accepted as GLOBAL');
            return 'ACCEPT_GLOBAL';
        }
        if (this._includesKeyword(nameLower, keywords.STRONG_POSITIVE_LATAM)) {
            logger.trace({ locationName }, 'Location accepted as LATAM');
            return 'ACCEPT_LATAM';
        }

        // --- Ambiguous "Remote" vs. Non-Remote ---
        if (nameLower.includes('remote')) {
            // It says remote, but didn't match strong positive/negative keywords. Needs content check.
            if (keywords.AMBIGUOUS && keywords.AMBIGUOUS.some(kw => nameLower === kw.toLowerCase())) {
                 logger.trace({ locationName }, 'Location is ambiguous "Remote", deferring to content');
                 return 'UNKNOWN';
            }
            // If it contains "remote" but isn't just the ambiguous term, assume global unless content rejects
             logger.trace({ locationName }, 'Location contains "Remote" but not specifically LATAM/Global/Ambiguous, tentatively Global');
             return 'UNKNOWN'; // Treat as UNKNOWN for now, let content check confirm/reject
        }

        // --- Rejection for non-remote ---
        // If it doesn't contain "remote" and wasn't explicitly accepted via keywords.
        logger.trace({ locationName }, 'Location rejected as non-remote or unspecified');
        return 'REJECT';
    }

    // Check content keywords (adapted from user example)
    private _checkContentKeywords(title: string | null | undefined, content: string | null | undefined, filterConfig: FilterConfig, logger: pino.Logger): 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN' {
        if (!content && !title) return 'UNKNOWN';

        // Decode and clean content slightly for keyword matching
        const cleanContent = this._processJobContent(content || ''); // Use the helper method
        const titleLower = title?.toLowerCase() || '';
        const contentLower = cleanContent?.toLowerCase() || '';
        const fullText = `${titleLower} ${contentLower}`; // Combine title and cleaned content
        const keywords = filterConfig.CONTENT_KEYWORDS; // Use loaded config

        // --- Strong Rejection First ---
        if (this._includesKeyword(fullText, keywords.STRONG_NEGATIVE_REGION) ||
            this._includesKeyword(fullText, keywords.STRONG_NEGATIVE_TIMEZONE)) {
            const reason = this._includesKeyword(fullText, keywords.STRONG_NEGATIVE_REGION)
                ? 'Content includes STRONG_NEGATIVE_REGION keyword'
                : 'Content includes STRONG_NEGATIVE_TIMEZONE keyword';
            const matchedKeyword = [...keywords.STRONG_NEGATIVE_REGION, ...keywords.STRONG_NEGATIVE_TIMEZONE].find(kw => fullText.includes(kw.toLowerCase()));
            logger.trace({ title, reason, matchedKeyword }, 'Content rejected');
            return 'REJECT';
        }

        // --- Strong Acceptance (Prioritize LATAM) ---
        if (this._includesKeyword(fullText, keywords.STRONG_POSITIVE_LATAM)) {
            logger.trace({ title }, 'Content accepted as LATAM');
            return 'ACCEPT_LATAM';
        }
        if (this._includesKeyword(fullText, keywords.STRONG_POSITIVE_GLOBAL)) {
            logger.trace({ title }, 'Content accepted as GLOBAL');
            return 'ACCEPT_GLOBAL';
        }

        // No strong indicators found in content
        logger.trace({ title }, 'Content check inconclusive (UNKNOWN)');
        return 'UNKNOWN';
    }

     // Main relevance check function (adapted from user example)
    private _isJobRelevant(job: GreenhouseJob, filterConfig: FilterConfig, logger: pino.Logger): FilterResult {
        const title = job.title || '';
        const locationName = job.location?.name;
        const metadata = job.metadata;
        const content = job.content;
        const jobLogger = logger.child({ jobId: job.id, title }); // Create child logger for context

        // 1. Check Metadata First (often most structured)
        const metadataCheck = this._checkMetadataForRemoteness(metadata, filterConfig, jobLogger);
        if (metadataCheck === 'REJECT') {
             jobLogger.debug(`Job rejected by Metadata`);
             return { relevant: false, reason: 'Metadata indicates Restriction' };
        }
        // Don't accept yet, allow location/content to potentially reject

        // 2. Check Location Name (very common indicator)
        const locationCheck = this._checkLocationName(locationName, filterConfig, jobLogger);
        if (locationCheck === 'REJECT') {
            jobLogger.debug({ locationName }, `Job rejected by Location Name`);
            return { relevant: false, reason: `Location Name indicates Restriction or is non-remote: "${locationName}"` };
        }
         // Don't accept yet, allow content to potentially reject

        // 3. Check Content Keywords (last resort for acceptance, but important for rejection)
        const contentCheck = this._checkContentKeywords(title, content, filterConfig, jobLogger);
         if (contentCheck === 'REJECT') {
            jobLogger.debug(`Job rejected by Content Keywords`);
            return { relevant: false, reason: 'Content indicates Restriction (Region/Timezone/Citizenship)' };
        }

        // 4. Determine Acceptance based on priority if no rejection occurred
        // Prioritize LATAM
        if (metadataCheck === 'ACCEPT_LATAM' || locationCheck === 'ACCEPT_LATAM' || contentCheck === 'ACCEPT_LATAM') {
            const reason = metadataCheck === 'ACCEPT_LATAM' ? 'Metadata indicates LATAM' :
                           locationCheck === 'ACCEPT_LATAM' ? 'Location Name indicates LATAM' : 'Content indicates LATAM';
            jobLogger.debug(`Job accepted as LATAM (${reason})`);
            return { relevant: true, reason, type: 'latam' };
        }
        // Then Global
        if (metadataCheck === 'ACCEPT_GLOBAL' || locationCheck === 'ACCEPT_GLOBAL' || contentCheck === 'ACCEPT_GLOBAL') {
             const reason = metadataCheck === 'ACCEPT_GLOBAL' ? 'Metadata indicates Global' :
                            locationCheck === 'ACCEPT_GLOBAL' ? 'Location Name indicates Global' : 'Content indicates Global';
             jobLogger.debug(`Job accepted as GLOBAL (${reason})`);
             return { relevant: true, reason, type: 'global' };
        }


        // 5. Default Strict Case: If no explicit acceptance or rejection was found after all checks.
        jobLogger.debug({ metadataCheck, locationCheck, contentCheck }, 'Job considered irrelevant by default (strict rule - no clear accept signal)');
        return { relevant: false, reason: 'No clear Worldwide/LATAM indicator found after checking Metadata, Location, and Content.' };
    }

    private _extractSectionsFromContent(content: string): { requirements: string, responsibilities: string, benefits: string } {
        const sections = {
            requirements: '',
            responsibilities: '',
            benefits: '',
        };
        if (!content) return sections;

        // Basic extraction based on common headings (case-insensitive)
        // This needs refinement for robustness
        const reqMatch = content.match(/<(?:h[1-6]|strong|b)>\s*(requirements|qualifications|needed|experience|you have|you need|necess[aá]rio|requisitos)[^<]*<\/(?:h[1-6]|strong|b)>([\s\S]*?)(?:<(?:h[1-6]|strong|b)>|$)/i);
        if (reqMatch && reqMatch[2]) {
            sections.requirements = this._cleanExtractedSection(reqMatch[2]);
        }

        const respMatch = content.match(/<(?:h[1-6]|strong|b)>\s*(responsibilities|role|duties|you will do|what you['']ll do|suas fun[cç][oõ]es|atividades)[^<]*<\/(?:h[1-6]|strong|b)>([\s\S]*?)(?:<(?:h[1-6]|strong|b)>|$)/i);
        if (respMatch && respMatch[2]) {
            sections.responsibilities = this._cleanExtractedSection(respMatch[2]);
        }

        const benMatch = content.match(/<(?:h[1-6]|strong|b)>\s*(benefits|perks|what we offer|oferecemos|benef[ií]cios)[^<]*<\/(?:h[1-6]|strong|b)>([\s\S]*?)(?:<(?:h[1-6]|strong|b)>|$)/i);
        if (benMatch && benMatch[2]) {
            sections.benefits = this._cleanExtractedSection(benMatch[2]);
        }

        // Fallback if specific sections aren't found (less ideal)
        if (!sections.requirements && !sections.responsibilities && !sections.benefits) {
            // Could try splitting content or just assign all to description?
        }

        return sections;
    }

    private _cleanExtractedSection(htmlContent: string): string {
        // Remove leading/trailing whitespace and potentially unwanted tags
        let cleaned = htmlContent.trim();
        // Example: Remove potential leading/trailing list tags if they are the immediate wrappers
        cleaned = cleaned.replace(/^\s*<\/?(?:ul|ol)[^>]*>/i, '').replace(/<\/?(?:ul|ol)[^>]*>\s*$/i, '');
        return cleaned.trim();
    }
} 