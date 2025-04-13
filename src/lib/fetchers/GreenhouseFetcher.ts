import axios, { AxiosError } from 'axios';
import { decode } from 'html-entities';
import { PrismaClient, JobSource, JobStatus, JobType, ExperienceLevel } from '@prisma/client';
import pMap from 'p-map';
import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';
import sanitizeHtml from 'sanitize-html';
import { JobProcessingAdapter } from '../adapters/JobProcessingAdapter';
import { FilterConfig, FilterMetadataConfig, getGreenhouseConfig } from '../../types/JobSource'; // Adjust path
import { StandardizedJob } from '../../types/StandardizedJob'; // Adjust path
import { extractSkills, detectJobType, detectExperienceLevel } from '../utils/jobUtils';
import { JobFetcher, SourceStats, FetcherResult } from './types';

// --- Greenhouse Specific Interfaces ---
interface GreenhouseOffice {
    id: number;
    name: string;
    location: string; // Sometimes contains useful detail
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
    _determinedHiringRegionType?: 'global' | 'latam';
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
        const stats: SourceStats = { found: 0, relevant: 0, processed: 0, deactivated: 0, errors: 0 };
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
                return { stats, foundSourceIds };
            }
            boardToken = String(greenhouseConfig.boardToken);
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
            const response = await axios.get(apiUrl, { timeout: 45000 }); // Increased timeout slightly

            if (!response.data || !Array.isArray(response.data.jobs)) {
                sourceLogger.error({ responseStatus: response.status, responseData: response.data }, '❌ Invalid response structure from Greenhouse API');
                stats.errors++;
                return { stats, foundSourceIds };
            }
            const apiJobs: GreenhouseJob[] = response.data.jobs;
            stats.found = apiJobs.length;
            apiJobs.forEach(job => foundSourceIds.add(String(job.id)));
            sourceLogger.info(`+ ${stats.found} jobs found in API response.`);

            if (apiJobs.length === 0) {
                 sourceLogger.info('No jobs found for this source.');
                 return { stats, foundSourceIds };
            }
             sourceLogger.trace({ sampleJobId: apiJobs[0]?.id, sampleJobTitle: apiJobs[0]?.title }, 'Sample job structure check');


            // --- Process Jobs ---
            sourceLogger.debug(`Processing ${apiJobs.length} jobs for relevance...`);
            await pMap(apiJobs, async (job) => {
                 const jobLogger = sourceLogger.child({ jobId: job.id, jobTitle: job.title }); // Create logger per job
                try {
                    const relevanceResult = this._isJobRelevant(job, filterConfig!, jobLogger); // Pass jobLogger
                    if (relevanceResult.relevant) {
                        stats.relevant++;
                        jobLogger.info( // Log with jobLogger
                            { reason: relevanceResult.reason, type: relevanceResult.type },
                            `➡️ Relevant job found`
                        );

                        const enhancedJob = {
                            ...job,
                            _determinedHiringRegionType: relevanceResult.type
                        };

                        // Pass the *enhanced* job object and the source details to the adapter
                        const saved = await this.jobProcessor.processRawJob('greenhouse', enhancedJob, source);

                        if (saved) {
                            stats.processed++;
                            jobLogger.debug('Job processed/saved via adapter.'); // Log with jobLogger
                        } else {
                            jobLogger.warn('Adapter reported job not saved (processor failure, duplicate, irrelevant post-processing, or save issue).'); // Log with jobLogger
                        }
                    } else {
                        jobLogger.debug({ reason: relevanceResult.reason }, `Job skipped as irrelevant`); // Debug level for irrelevant
                    }
                } catch (jobError: any) {
                    stats.errors++;
                    const errorDetails = {
                        message: jobError?.message,
                        stack: jobError?.stack?.split('\n').slice(0, 5).join('\n'), // Limit stack trace
                        name: jobError?.name,
                    };
                     jobLogger.error({ // Log with jobLogger
                        error: errorDetails
                    }, '❌ Error processing individual job or calling adapter');
                }
            }, { concurrency: 5, stopOnError: false });

            sourceLogger.info(`✓ Processing completed.`);

        } catch (error) {
            stats.errors++;
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError;
                sourceLogger.error(
                    { status: axiosError.response?.status, code: axiosError.code, message: axiosError.message, url: apiUrl },
                    `❌ Axios error fetching jobs for source`
                );
            } else {
                 const genericError = error as Error;
                 sourceLogger.error({ 
                     error: { message: genericError.message, name: genericError.name, stack: genericError.stack?.split('\n').slice(0, 5).join('\n') }, 
                     boardToken, 
                     apiUrl 
                 }, '❌ General error processing source');
            }
        }

        return { stats, foundSourceIds };
    }


    // --- Private Helper Methods ---

    private _includesSubstringKeyword(text: string | null | undefined, keywords: string[]): { match: boolean, keyword: string | undefined } {
        if (!text || !keywords || keywords.length === 0) return { match: false, keyword: undefined };
        const lowerText = text.toLowerCase();
        const foundKeyword = keywords.find(keyword => lowerText.includes(keyword.toLowerCase()));
        return { match: !!foundKeyword, keyword: foundKeyword };
    };

    private _matchesKeywordRegex(text: string | null | undefined, keywords: string[]): { match: boolean, keyword: string | undefined } {
        if (!text || !keywords || keywords.length === 0) return { match: false, keyword: undefined };
        const lowerText = text.toLowerCase();
        // Escape special regex characters in keywords and join with '|'
        const pattern = new RegExp(`\\b(${keywords.map(kw =>
            kw.toLowerCase().replace(/[-\\/\\^$*+?.()|[\\]{}]/g, '\\$&') // Escape regex chars
        ).join('|')})\\b`, 'i'); // Added 'i' flag for case-insensitivity
        const match = pattern.exec(lowerText);
        return { match: !!match, keyword: match ? match[1] : undefined }; // Return the matched keyword
    }

    private _processJobContent(content: string): string {
        if (!content) return '';
        try {
            let processedContent = decode(content); // Decode HTML entities first
            processedContent = sanitizeHtml(processedContent, {
                allowedTags: [], // Remove all tags
                allowedAttributes: {}, // Remove all attributes
                parseStyleAttributes: false,
                 nonTextTags: [ 'style', 'script', 'textarea', 'option' ],
                // Convert block tags to newlines for better readability/keyword separation
                transformTags: {
                    'p': '\n',
                    'br': '\n',
                    'div': '\n',
                    'li': '\n* ', // Add bullet point for list items
                }
            });
            processedContent = processedContent
                .replace(/(\r\n|\n|\r|\u2028|\u2029){2,}/g, '\n\n') // Collapse multiple newlines but keep double newlines
                .replace(/[ \t\u00A0]{2,}/g, ' ') // Collapse multiple spaces/tabs/nbsp
                .replace(/\n /g, '\n') // Remove space after newline
                .replace(/ \n/g, '\n') // Remove space before newline
                .trim();
            return processedContent;
        } catch (error) {
             console.error('Error processing job content with sanitize-html:', error); // Keep console error for this specific low-level issue
             // Fallback (same as before)
             let fallbackContent = decode(content);
             fallbackContent = fallbackContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gm, '');
             fallbackContent = fallbackContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gm, '');
             fallbackContent = fallbackContent.replace(/<[pP]\b[^>]*>/g, '\n'); // Try to preserve paragraphs
             fallbackContent = fallbackContent.replace(/<br\s*\/?>/gi, '\n'); // Try to preserve line breaks
             fallbackContent = fallbackContent.replace(/<li\b[^>]*>/gi, '\n* '); // Try to preserve list items
             fallbackContent = fallbackContent.replace(/<[^>]+>/g, ' ');
             fallbackContent = fallbackContent.replace(/(\r\n|\n|\r){2,}/g, '\n\n');
             fallbackContent = fallbackContent.replace(/\s+/g, ' ').trim();
             return fallbackContent;
        }
    }

    private _checkMetadataForRemoteness(metadata: GreenhouseMetadata[], filterConfig: FilterConfig, logger: pino.Logger): 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN' {
        if (!metadata || metadata.length === 0 || !filterConfig.REMOTE_METADATA_FIELDS) return 'UNKNOWN';
    
        let hasLatamIndicator = false;
        let hasGlobalIndicator = false;
        let hasRejectionIndicator = false;
        let rejectionReason = ''; // Keep track of why rejected
    
        const metadataFieldsConfig = filterConfig.REMOTE_METADATA_FIELDS;
    
        for (const item of metadata) {
            const fieldNameLower = item.name?.toLowerCase() || '';
            // Use case-insensitive lookup for the config key
            const configKey = Object.keys(metadataFieldsConfig).find(key => key.toLowerCase() === fieldNameLower);
            const config = configKey ? metadataFieldsConfig[configKey] : undefined;
    
            if (config) {
                const rawValue = item.value;
                const valuesToCheck: string[] = [];
    
                if (typeof rawValue === 'string') {
                    valuesToCheck.push(rawValue.toLowerCase());
                } else if (Array.isArray(rawValue)) {
                    rawValue.forEach(v => {
                        if (typeof v === 'string') {
                            valuesToCheck.push(v.toLowerCase());
                        }
                    });
                }
    
                if (valuesToCheck.length === 0) continue;
    
                for (const val of valuesToCheck) {
                    if (hasRejectionIndicator) break; // Stop checking this item if already rejected
    
                    switch (config.type) {
                        case 'boolean':
                             // Ensure positiveValue/negativeValue are checked case-insensitively if they exist
                             const positiveValLower = config.positiveValue?.toLowerCase();
                             // Add safe check for negativeValue property
                             const negativeValLower = ('negativeValue' in config && typeof config.negativeValue === 'string') 
                                ? config.negativeValue.toLowerCase() 
                                : undefined;
                             
                            if (positiveValLower && val === positiveValLower) {
                                hasGlobalIndicator = true; // Assume global unless specified otherwise by field context
                                logger.trace({ field: fieldNameLower, value: val }, 'Metadata: Boolean positive match -> Global');
                            } else if (negativeValLower && val === negativeValLower) {
                                hasRejectionIndicator = true;
                                rejectionReason = `Metadata boolean field '${fieldNameLower}' has negative value '${val}'`;
                                logger.trace({ field: fieldNameLower, value: val }, 'Metadata: Boolean negative match -> Reject');
                            } else {
                                // Non-matching boolean might imply rejection depending on field meaning
                                // Example: 'remote eligible' being false means reject
                                if (fieldNameLower === 'remote eligible' && !positiveValLower) { // Assume 'yes' is positive if not specified
                                      hasRejectionIndicator = true;
                                      rejectionReason = `Metadata boolean field '${fieldNameLower}' is not positive ('${val}')`;
                                      logger.trace({ field: fieldNameLower, value: val }, 'Metadata: Boolean non-positive match for "remote eligible" -> Reject');
                                }
                            }
                            break;
                        case 'string':
                            const disallowedValuesLower = config.disallowedValues?.map(dv => dv.toLowerCase());
                            const allowedValuesLower = config.allowedValues?.map(av => av.toLowerCase());
                            const positiveValuesLower = config.positiveValues?.map(pv => pv.toLowerCase());

                            // 1. Check Disallowed first
                            if (disallowedValuesLower?.some(disallowed => val.includes(disallowed))) {
                                const matchedDisallowed = disallowedValuesLower.find(disallowed => val.includes(disallowed));
                                hasRejectionIndicator = true;
                                rejectionReason = `Metadata field '${fieldNameLower}' includes disallowed value '${matchedDisallowed}' (from '${val}')`;
                                logger.trace({ field: fieldNameLower, value: val, disallowed: matchedDisallowed }, 'Metadata: Disallowed value match -> Reject');
                                break; // Stop checking this value
                            }

                            // 2. Check Allowed for specific regions
                            let allowedMatch = false;
                            if (allowedValuesLower?.some(allowed => val.includes(allowed))) {
                                const matchedAllowed = allowedValuesLower.find(allowed => val.includes(allowed));
                                if (matchedAllowed) {
                                    allowedMatch = true;
                                    if (['latam', 'americas', 'brazil', 'brasil'].includes(matchedAllowed)) {
                                        hasLatamIndicator = true;
                                        logger.trace({ field: fieldNameLower, value: val, allowed: matchedAllowed }, 'Metadata: Allowed value match -> LATAM');
                                    } else if (['worldwide', 'global', 'anywhere'].includes(matchedAllowed)) {
                                        hasGlobalIndicator = true;
                                         logger.trace({ field: fieldNameLower, value: val, allowed: matchedAllowed }, 'Metadata: Allowed value match -> Global');
                                    } else {
                                        // Allowed but not Global/LATAM (e.g., 'US Only' if it were in allowedValues) implies rejection for our purposes
                                        hasRejectionIndicator = true;
                                        rejectionReason = `Metadata field '${fieldNameLower}' has allowed value '${matchedAllowed}' which is not Global/LATAM`;
                                         logger.trace({ field: fieldNameLower, value: val, allowed: matchedAllowed }, 'Metadata: Allowed value match (non-Global/LATAM) -> Reject');
                                    }
                                }
                            }
                            
                            // 3. Check Positive only if not already accepted/rejected by allowed/disallowed
                            if (!allowedMatch && !hasRejectionIndicator && positiveValuesLower?.some(positive => val.includes(positive))) {
                                 const matchedPositive = positiveValuesLower.find(positive => val.includes(positive));
                                 if (matchedPositive) {
                                      if (['latam', 'americas', 'brazil', 'brasil'].includes(matchedPositive)) {
                                        hasLatamIndicator = true;
                                        logger.trace({ field: fieldNameLower, value: val, positive: matchedPositive }, 'Metadata: Positive value match -> LATAM');
                                    } else {
                                        // Assume other positive values (like 'remote', 'worldwide') mean global
                                        hasGlobalIndicator = true;
                                        logger.trace({ field: fieldNameLower, value: val, positive: matchedPositive }, 'Metadata: Positive value match -> Global');
                                    }
                                 }
                            }
                            break;
                    }
                }
            }
             // Early exit if rejected by this metadata item
             if (hasRejectionIndicator) break;
        }

        // Decision priority: Reject > LATAM > Global
        if (hasRejectionIndicator) {
             logger.debug({ reason: rejectionReason }, 'Metadata check resulted in REJECT');
             return 'REJECT';
        }
        if (hasLatamIndicator) return 'ACCEPT_LATAM';
        if (hasGlobalIndicator) return 'ACCEPT_GLOBAL';

        return 'UNKNOWN'; // No conclusive indicators found
    }

    private _checkLocationName(
        locationName: string | null | undefined,
        offices: GreenhouseOffice[] | null | undefined,
        filterConfig: FilterConfig,
        logger: pino.Logger
    ): 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN' {
        const nameRaw = locationName?.trim() ?? '';
        const nameLower = nameRaw.toLowerCase();
        const keywords = filterConfig.LOCATION_KEYWORDS;
        const officeNamesLower = (offices ?? [])
                                .flatMap(o => [o.name?.toLowerCase(), o.location?.toLowerCase()]) // Check both name and location fields of office
                                .filter((name): name is string => Boolean(name)); // Type guard for filter(Boolean)

        const acceptableLatamCountries = keywords.ACCEPT_EXACT_LATAM_COUNTRIES || [];
        const strongNegativeKeywords = keywords.STRONG_NEGATIVE_RESTRICTION || [];
        const strongGlobalKeywords = keywords.STRONG_POSITIVE_GLOBAL || [];
        const strongLatamKeywords = keywords.STRONG_POSITIVE_LATAM || [];
        const ambiguousKeywords = keywords.AMBIGUOUS || []; // e.g., ["remote"]

        // --- Extract individual words for more granular checking ---
        const words = nameLower.split(/[\s\-\(\)\/]+/).filter(w => w.length > 2); // Split on spaces, hyphens, parentheses, slashes

        // --- Pre-computation for clarity ---
        const nameContainsAmbiguous = this._includesSubstringKeyword(nameLower, ambiguousKeywords).match;
        const nameMatchNegative = this._matchesKeywordRegex(nameLower, strongNegativeKeywords);
        const nameMatchGlobal = this._includesSubstringKeyword(nameLower, strongGlobalKeywords); // Use includes for broader "Remote Worldwide"
        const nameMatchLatam = this._includesSubstringKeyword(nameLower, strongLatamKeywords); // Use includes for broader "Remote LATAM"
        const nameMatchExactLatamCountry = this._matchesKeywordRegex(nameLower, acceptableLatamCountries);

        // New checks for individual words that are strong indicators
        const hasWorldwideWord = words.includes('worldwide') || words.includes('global') || words.includes('anywhere');
        const hasAmericasWord = words.includes('americas') || words.includes('america');
        const hasLatamWord = words.includes('latam') || words.includes('latin');
        const hasHomeBasedWord = words.includes('home') && (words.includes('based') || words.includes('base'));
        const hasRemoteWord = words.includes('remote');

        // --- Step 1: Direct Rejection based on Location Name ---
        // If the location name *itself* contains a strong negative keyword (using regex for word boundaries)
        // This handles "London", "United States (Remote)", "Remote, EMEA", "Remote - USA", "Canada" etc.
        if (nameMatchNegative.match) {
            logger.debug({ locationName: nameRaw, matchedKeyword: nameMatchNegative.keyword }, 'Location rejected: Name contains strong negative keyword.');
            return 'REJECT';
        }

        // --- Step 2: Explicit Acceptance based on Location Name ---
        // Check for exact LATAM country match first (stricter)
         if (nameMatchExactLatamCountry.match) {
            logger.debug({ locationName: nameRaw, matchedKeyword: nameMatchExactLatamCountry.keyword }, 'Location accepted as LATAM: Exact country match in name.');
             return 'ACCEPT_LATAM';
         }
        // Then check for broader positive LATAM keywords
        if (nameMatchLatam.match) {
            logger.debug({ locationName: nameRaw, matchedKeyword: nameMatchLatam.keyword }, 'Location accepted as LATAM: Name contains positive LATAM keyword.');
            return 'ACCEPT_LATAM';
        }
        // Then check for broader positive Global keywords
        if (nameMatchGlobal.match) {
            logger.debug({ locationName: nameRaw, matchedKeyword: nameMatchGlobal.keyword }, 'Location accepted as GLOBAL: Name contains positive Global keyword.');
            return 'ACCEPT_GLOBAL';
        }

        // --- Step 2.5: NEW Check for key words that indicate worldwide/global/americas ---
        if (hasWorldwideWord) {
            logger.debug({ locationName: nameRaw, keyword: 'worldwide/global/anywhere' }, 'Location accepted as GLOBAL: Name contains explicit worldwide/global word.');
            return 'ACCEPT_GLOBAL';
        }
        
        if (hasLatamWord) {
            logger.debug({ locationName: nameRaw, keyword: 'latam/latin' }, 'Location accepted as LATAM: Name contains explicit latam word.');
            return 'ACCEPT_LATAM';
        }
        
        if (hasAmericasWord) {
            // "Americas" is ambiguous (could be North America or all Americas)
            // but likely includes LATAM, so mark as LATAM
            logger.debug({ locationName: nameRaw, keyword: 'americas' }, 'Location accepted as LATAM: Name contains "Americas" word (ambiguous but includes LATAM).');
            return 'ACCEPT_LATAM';
        }

        // --- Step 3: Analyze Offices if Location Name is Ambiguous or Generic ---
        // This applies if the name is *only* something like "Remote", "Distributed", or potentially empty,
        // AND it hasn't already been accepted/rejected.
        if (nameContainsAmbiguous || nameLower === '' || (hasHomeBasedWord && !hasWorldwideWord && !hasAmericasWord && !hasLatamWord)) {
            logger.trace({ locationName: nameRaw, officeNames: officeNamesLower }, 'Location name is ambiguous or empty, checking offices...');
            if (officeNamesLower.length > 0) {
                const officeMatchNegative = officeNamesLower.some(officeName => this._matchesKeywordRegex(officeName, strongNegativeKeywords).match);
                const officeMatchLatam = officeNamesLower.some(officeName =>
                    this._includesSubstringKeyword(officeName, strongLatamKeywords).match ||
                    this._matchesKeywordRegex(officeName, acceptableLatamCountries).match
                );
                const officeMatchGlobal = officeNamesLower.some(officeName => this._includesSubstringKeyword(officeName, strongGlobalKeywords).match);

                 // If *any* office is strongly negative, and *no* office is clearly LATAM/Global, reject.
                 // More nuanced: If ALL offices are negative, definitely reject.
                 const allOfficesAreNegative = officeNamesLower.every(officeName => this._matchesKeywordRegex(officeName, strongNegativeKeywords).match);
                 if (allOfficesAreNegative) {
                      logger.debug({ locationName: nameRaw, officeNames: officeNamesLower }, 'Location rejected: All offices listed are in negative locations.');
                      return 'REJECT';
                 }
                 // If there's a mix, prioritize LATAM > Global > Reject (if *any* negative exists without stronger signal)
                 if (officeMatchLatam) {
                      logger.debug({ locationName: nameRaw, officeNames: officeNamesLower }, 'Location accepted as LATAM based on office list.');
                      return 'ACCEPT_LATAM';
                 }
                 if (officeMatchGlobal) {
                      logger.debug({ locationName: nameRaw, officeNames: officeNamesLower }, 'Location accepted as GLOBAL based on office list.');
                      return 'ACCEPT_GLOBAL';
                 }
                 // If *some* offices are negative but others are unknown (and none are LATAM/Global), it's safer to reject.
                 if (officeMatchNegative) {
                    const negativeOffice = officeNamesLower.find(officeName => this._matchesKeywordRegex(officeName, strongNegativeKeywords).match);
                     logger.debug({ locationName: nameRaw, officeNames: officeNamesLower, firstNegativeOffice: negativeOffice }, 'Location rejected: Ambiguous name, and at least one office is in a negative location without overriding LATAM/Global signal.');
                     return 'REJECT';
                 }
                 // If offices exist but give no signal, remain UNKNOWN.
                  logger.trace({ locationName: nameRaw, officeNames: officeNamesLower }, 'Office check inconclusive (no clear signal).');
                 return 'UNKNOWN';

            } else {
                // Ambiguous name and no office data -> Defer to content check
                logger.trace({ locationName: nameRaw }, 'Location name ambiguous, no office data provided. Deferring check.');
                return 'UNKNOWN';
            }
        }

        // --- Step 4: Default case - Much less aggressive rejection ---
        // If "Home based" is in the name but we haven't classified it yet, it's likely remote
        // so defer to content check rather than reject
        if (hasHomeBasedWord || hasRemoteWord) {
            logger.debug({ locationName: nameRaw }, 'Location name contains "home based" or "remote" but could not be classified. Deferring to content check.');
            return 'UNKNOWN';
        }

        // If we reach here, the location is specific but not matched by any of our rules
        logger.debug({ locationName: nameRaw }, 'Location rejected: Name is specific but not recognized as Global/LATAM and not explicitly Negative.');
        return 'REJECT';
    }

    private _checkContentKeywords(title: string | null | undefined, content: string | null | undefined, filterConfig: FilterConfig, logger: pino.Logger): 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN' {
        const titleLower = title?.toLowerCase() || '';
        const cleanContent = this._processJobContent(content || '');
        const fullText = `${titleLower}\n${cleanContent}`.toLowerCase(); // Combine for easier searching

        const keywords = filterConfig.CONTENT_KEYWORDS;
        const negativeRegionKeywords = keywords.STRONG_NEGATIVE_REGION || []; // Use the unified list
        const positiveGlobalKeywords = keywords.STRONG_POSITIVE_GLOBAL || [];
        const positiveLatamKeywords = keywords.STRONG_POSITIVE_LATAM || [];

        // Location keywords from the other section, useful for contextual checks
        const negativeLocationKeywords = filterConfig.LOCATION_KEYWORDS?.STRONG_NEGATIVE_RESTRICTION || [];

        // --- Step 1: Check Title for Explicit Rejection ---
        // Titles like "Remote, EMEA" or "Senior Engineer (Canada)" are strong signals.
        const titleMatchNegative = this._matchesKeywordRegex(titleLower, negativeLocationKeywords); // Use stricter location list for title
        if (titleMatchNegative.match) {
             logger.debug({ title, matchedKeyword: titleMatchNegative.keyword }, 'Content rejected: Title contains strong negative location/region keyword.');
             return 'REJECT';
        }

        // --- Step 2: Check Full Content for Explicit Rejection Keywords ---
        // This includes location names, regions, citizenship requirements, specific timezones etc.
        const contentMatchNegative = this._matchesKeywordRegex(fullText, negativeRegionKeywords);
        if (contentMatchNegative.match) {
             // Avoid rejecting based *only* on timezone mention if LATAM/Global is also mentioned strongly.
             // Check if the matched keyword is *primarily* a timezone.
             const timezoneKeywords = filterConfig.LOCATION_KEYWORDS.STRONG_NEGATIVE_RESTRICTION.filter(k => 
                 ['est','et','cst','ct','mst','mt','pst','pt','bst','gmt','cet','cest','ist'].includes(k) || k.includes('time')
             );
             const matchedIsTimezone = timezoneKeywords.includes(contentMatchNegative.keyword || '');

             if (matchedIsTimezone) {
                 // If it's a timezone match, check if positive keywords *also* exist nearby or globally
                 const contentMatchGlobal = this._includesSubstringKeyword(fullText, positiveGlobalKeywords);
                 const contentMatchLatam = this._includesSubstringKeyword(fullText, positiveLatamKeywords);
                 if (contentMatchGlobal.match || contentMatchLatam.match) {
                      logger.trace({ title, matchedTimezone: contentMatchNegative.keyword, hasGlobal: contentMatchGlobal.match, hasLatam: contentMatchLatam.match }, 'Timezone restriction found, but also positive Global/LATAM signal found in content. Deferring rejection based *only* on timezone.');
                      // Don't reject *yet*, let acceptance checks run.
                 } else {
                    logger.debug({ title, matchedKeyword: contentMatchNegative.keyword }, 'Content rejected: Full text contains strong negative region/timezone keyword (and no overriding positive signal).');
                    return 'REJECT';
                 }
             } else {
                 // If it's *not* just a timezone, reject directly.
                 logger.debug({ title, matchedKeyword: contentMatchNegative.keyword }, 'Content rejected: Full text contains strong negative region/citizenship/restriction keyword.');
                 return 'REJECT';
             }
        }

        // --- Step 3: Check Content for Strong Acceptance ---
        // Prioritize LATAM
        const contentMatchLatam = this._includesSubstringKeyword(fullText, positiveLatamKeywords);
        if (contentMatchLatam.match) {
            logger.debug({ title, matchedKeyword: contentMatchLatam.keyword }, 'Content accepted as LATAM based on positive keyword.');
            return 'ACCEPT_LATAM';
        }
        // Then Global
        const contentMatchGlobal = this._includesSubstringKeyword(fullText, positiveGlobalKeywords);
        if (contentMatchGlobal.match) {
            logger.debug({ title, matchedKeyword: contentMatchGlobal.keyword }, 'Content accepted as GLOBAL based on positive keyword.');
            return 'ACCEPT_GLOBAL';
        }

        // --- Step 4: Contextual Phrase Rejection (Refined - Optional but can help) ---
        // This looks for "must be located in [Negative Location]" patterns.
        // Can be complex and prone to errors. Use cautiously or disable if Step 2 is sufficient.
        // Let's keep the original logic here but ensure it uses the *updated* negativeLocationKeywords
        const restrictionPhrases = [
            'must be located in', 'must reside in', 'eligible to work in', 'must be based in',
            'currently located in', 'currently residing in', 'position based in',
            'based in', 'located in', 'residing in', 'resident of', 'based out of',
            'authorized to work in', 'must possess work authorization for',
            'applicants must be residents of', 'open [only ]?to candidates in', // Optional space
            'position is based in', 'role is based in', 'this role is based in',
            'you must be located in', 'you must reside in', 'must work from',
            'requirement to live in', 'requirement to be based in',
            'local candidates only', 'domestic candidates only', 'restricted to residents of',
            'candidate must be in', 'hiring [only ]?in', 'we can [only ]?hire in',
            'will only consider applicants in', 'must be physically located in',
             'must be authorized to work permanently in', // Added variation
             'work authorization in' // Broader check
        ];
         if (negativeLocationKeywords.length > 0) {
            const escapedPhrases = restrictionPhrases.map(p => p.replace(/[-\\/\\^$*+?.()|[\\]{}]/g, '\\$&').replace(/\[only \]\?/g, '(?:only )?')); // Handle optional 'only '
            const escapedLocations = negativeLocationKeywords.map(l => l.replace(/[-\\/\\^$*+?.()|[\\]{}]/g, '\\$&'));
            // Pattern: (Phrase) [optional punctuation/space] (the )? (NegativeLocation)\b
             const pattern = new RegExp(
                 `(${escapedPhrases.join('|')})` +
                 `[\\s\\p{P}]{0,5}` + // Allow up to 5 spaces/punctuation chars between phrase and location
                 `(?:the\\s+)?` +
                 `(${escapedLocations.join('|')})\\b`, // Use word boundary for location
                 'iu' // Case-insensitive, Unicode
             );
             const match = pattern.exec(fullText);
             if (match) {
                 // Check if LATAM mentioned very close *after* the match, suggesting an exception like "...in US or LATAM"
                 const matchEndIndex = match.index + match[0].length;
                 const contextWindow = fullText.substring(matchEndIndex, matchEndIndex + 40); // Look ahead 40 chars
                 const mentionsLatamNearby = this._includesSubstringKeyword(contextWindow, positiveLatamKeywords).match;

                 if (!mentionsLatamNearby) {
                     logger.debug({ title, matchedPhrase: match[1], matchedLocation: match[2] }, 'Content rejected: Contextual phrase indicates restriction to a negative location.');
                     return 'REJECT';
                 } else {
                      logger.trace({ title, matchedPhrase: match[1], matchedLocation: match[2], contextWindow }, 'Potential rejection phrase found, but LATAM mentioned nearby. Ignoring this specific contextual rejection.');
                 }
             }
         }

        // --- Step 5: No strong indicators ---
        logger.trace({ title }, 'Content check inconclusive (UNKNOWN).');
        return 'UNKNOWN';
    }

    private _isJobRelevant(job: GreenhouseJob, filterConfig: FilterConfig, logger: pino.Logger): FilterResult {
        const title = job.title || '';
        const locationName = job.location?.name;
        const metadata = job.metadata;
        const content = job.content;
        const offices = job.offices;

        // --- Order of Checks ---
        // 1. Metadata Check (can provide early accept/reject)
        const metadataCheck = this._checkMetadataForRemoteness(metadata, filterConfig, logger);
        if (metadataCheck === 'REJECT') {
            logger.debug(`Rejecting based on Metadata`);
            return { relevant: false, reason: 'Metadata indicates Restriction' };
        }
        // Accept based on metadata only if it's LATAM (prioritize)
        if (metadataCheck === 'ACCEPT_LATAM') {
             logger.info(`Accepted as LATAM based on Metadata`);
             return { relevant: true, reason: 'Metadata(LATAM)', type: 'latam' };
        }
        // Global acceptance from metadata is possible but let location/content confirm/override


        // 2. Location Name / Offices Check (Very Strong Signal)
        const locationCheck = this._checkLocationName(locationName, offices, filterConfig, logger);
        if (locationCheck === 'REJECT') {
             logger.debug(`Rejecting based on Location Name / Office Analysis`);
             return { relevant: false, reason: `Location/Office indicates Restriction or is non-remote: "${locationName}" / Offices: ${offices?.map(o=>o.name).join(', ')}` };
        }
        if (locationCheck === 'ACCEPT_LATAM') {
             logger.debug(`Job accepted as LATAM (${locationName})`);
             return { relevant: true, reason: 'Location/Office(LATAM)', type: 'latam' };
        }
        if (locationCheck === 'ACCEPT_GLOBAL') {
             logger.debug(`Job accepted as GLOBAL (${locationName})`);
             return { relevant: true, reason: 'Location/Office(Global)', type: 'global' };
        }
        // If location is UNKNOWN, continue to content check.


        // 3. Content Check (Includes Title check early)
        const contentCheck = this._checkContentKeywords(title, content, filterConfig, logger);
        if (contentCheck === 'REJECT') {
            logger.debug(`Rejecting based on Content Keywords`);
            return { relevant: false, reason: 'Content indicates Restriction (Region/Timezone/Citizenship/Phrase)' };
        }
        if (contentCheck === 'ACCEPT_LATAM') {
            logger.debug(`Job accepted as LATAM based on Content`);
            return { relevant: true, reason: 'Content(LATAM)', type: 'latam' };
        }
        if (contentCheck === 'ACCEPT_GLOBAL') {
             logger.debug(`Job accepted as GLOBAL based on Content`);
             return { relevant: true, reason: 'Content(Global)', type: 'global' };
        }

        // 4. Final Decision if still UNKNOWN after Content
        // If metadata previously indicated Global, accept now.
        if (metadataCheck === 'ACCEPT_GLOBAL') {
             logger.debug(`Job accepted as GLOBAL based on prior Metadata signal (Location/Content were UNKNOWN)`);
             return { relevant: true, reason: 'Metadata(Global) - Confirmed by non-rejecting Location/Content', type: 'global' };
        }

        // If we reach here, none of the checks provided a definitive Accept/Reject signal.
        logger.debug(`Rejecting: No clear LATAM/Global signal found across Metadata, Location, and Content.`);
        return { relevant: false, reason: 'Inconclusive: No LATAM/Global signal found after all checks.' };
    }
}