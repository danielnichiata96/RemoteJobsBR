import axios, { AxiosError } from 'axios';
import { decode } from 'html-entities';
import { PrismaClient, JobSource, JobStatus, JobType, ExperienceLevel, HiringRegion } from '@prisma/client';
import pMap from 'p-map';
import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';
import { JobProcessingAdapter } from '../adapters/JobProcessingAdapter';
import { FilterConfig, FilterMetadataConfig, getGreenhouseConfig, JobSourceConfig, GreenhouseConfig } from '../../types/JobSource';
import { StandardizedJob } from '../../types/StandardizedJob'; // Adjust path
import { extractSkills, detectJobType, detectExperienceLevel } from '../utils/jobUtils';
import { stripHtml } from '../utils/textUtils'; // Correct import
import { JobFetcher, SourceStats, FetcherResult, GreenhouseJob, GreenhouseMetadata, GreenhouseOffice, FilterResult } from './types';
import { detectRestrictivePattern, containsInclusiveSignal } from '../utils/filterUtils'; // Import the new utilities
import { JobAssessmentStatus } from '../../types/StandardizedJob'; // Import the new enum

export class GreenhouseFetcher implements JobFetcher {
    private prisma: PrismaClient;
    private jobProcessor: JobProcessingAdapter;
    private logger: pino.Logger; // Added class logger

    constructor(prismaClient: PrismaClient, jobProcessingAdapter: JobProcessingAdapter) {
        this.prisma = prismaClient;
        this.jobProcessor = jobProcessingAdapter;
        // Initialize logger in constructor
        this.logger = pino({ name: 'GreenhouseFetcher', level: process.env.LOG_LEVEL || 'info' });
    }

    async processSource(source: JobSource, parentLogger: pino.Logger): Promise<FetcherResult> {
        const startTime = Date.now(); // Record start time
        let errorMessage: string | undefined = undefined;

        const sourceLogger = parentLogger.child({ fetcher: 'Greenhouse', sourceName: source.name, sourceId: source.id });
        const stats: SourceStats = { found: 0, relevant: 0, processed: 0, deactivated: 0, errors: 0 };
        const foundSourceIds = new Set<string>();
        let filterConfig: FilterConfig | null = null;
        let boardToken: string | null = null;
        let apiUrl: string | null = null;

        try {
            // --- Load Configuration ---
            sourceLogger.trace('Loading configuration...');
            const greenhouseConfig = getGreenhouseConfig(source.config);
            if (!greenhouseConfig || !greenhouseConfig.boardToken) {
                sourceLogger.error('❌ Missing or invalid boardToken in source config');
                stats.errors++;
                errorMessage = 'Invalid boardToken in source config';
                // Calculate duration before early return
                const durationMs = Date.now() - startTime;
                return { stats, foundSourceIds, durationMs, errorMessage };
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
                errorMessage = `Failed to load filter config: ${error?.message || 'Unknown error'}`;
                 // Calculate duration before early return
                const durationMs = Date.now() - startTime;
                return { stats, foundSourceIds, durationMs, errorMessage };
            }

            // --- Fetch Jobs ---
            sourceLogger.trace({ apiUrl }, 'Fetching jobs from Greenhouse API...');
            const response = await axios.get(apiUrl, { timeout: 45000 });

            if (!response.data || !Array.isArray(response.data.jobs)) {
                sourceLogger.error({ responseStatus: response.status, responseData: response.data }, '❌ Invalid response structure from Greenhouse API');
                stats.errors++;
                errorMessage = 'Invalid response structure from Greenhouse API';
                 // Calculate duration before early return
                const durationMs = Date.now() - startTime;
                return { stats, foundSourceIds, durationMs, errorMessage };
            }
            const apiJobs: GreenhouseJob[] = response.data.jobs;
            stats.found = apiJobs.length;
            apiJobs.forEach(job => foundSourceIds.add(String(job.id)));
            sourceLogger.info(`+ ${stats.found} jobs found in API response.`);

            if (apiJobs.length === 0) {
                 sourceLogger.info('No jobs found for this source.');
                  // Calculate duration before early return
                 const durationMs = Date.now() - startTime;
                 return { stats, foundSourceIds, durationMs, errorMessage }; // errorMessage is undefined here
            }
             sourceLogger.trace({ sampleJobId: apiJobs[0]?.id, sampleJobTitle: apiJobs[0]?.title }, 'Sample job structure check');

            // --- Process Jobs --- Refactored --- 
            sourceLogger.trace(`Filtering ${apiJobs.length} jobs for relevance...`);
            let firstJobProcessingError: string | undefined = undefined; 
            const relevantJobs: GreenhouseJob[] = []; // Array to hold jobs passing relevance check

            // --- Step 1: Determine Relevance and Filter --- 
            for (const job of apiJobs) {
                const jobLogger = sourceLogger.child({ jobId: job.id, jobTitle: job.title?.substring(0,50) });
                try {
                    // Now returns JobAssessmentStatus
                    const assessmentStatus = this._isJobRelevant(job, filterConfig!, jobLogger);
                    
                    // Add the assessment status to the job object before pushing
                    const enhancedJob = {
                        ...job,
                        _assessmentStatus: assessmentStatus,
                        _determinedHiringRegionType: assessmentStatus === JobAssessmentStatus.RELEVANT ? 'global' as const : undefined 
                    };

                    // Decide based on assessment status
                    if (assessmentStatus === JobAssessmentStatus.RELEVANT || assessmentStatus === JobAssessmentStatus.NEEDS_REVIEW) {
                        if (assessmentStatus === JobAssessmentStatus.RELEVANT) {
                           stats.relevant++; // Only count RELEVANT as truly relevant for stats
                           jobLogger.trace({ reason: 'Relevant job found' }, `➡️ Relevant job found`);
                        } else {
                           jobLogger.trace({ reason: 'Job needs review' }, `⚠️ Job marked for review`);
                        }
                        relevantJobs.push(enhancedJob); // Push RELEVANT and NEEDS_REVIEW jobs for processing
                    } else { // IRRELEVANT
                        jobLogger.trace({ reason: 'Job skipped as irrelevant' }, `➖ Job skipped as irrelevant`);
                    }
                } catch (relevanceError: any) {
                    // Error *during* the relevance check itself
                    stats.errors++;
                    if (!firstJobProcessingError) { // Capture the first error
                        firstJobProcessingError = `Job ${job.id} (${job.title}): Relevance check failed: ${relevanceError?.message || 'Unknown relevance error'}`;
                    }
                     const errorDetails = {
                        message: relevanceError?.message,
                        stack: relevanceError?.stack?.split('\n').slice(0, 5).join('\n'),
                        name: relevanceError?.name,
                    };
                    jobLogger.error({ error: errorDetails }, '❌ Error during relevance check for job');
                }
            }

            sourceLogger.trace(`Found ${relevantJobs.length} relevant or reviewable jobs. Proceeding to process via adapter...`);

            // --- Step 2: Process Relevant Jobs in Parallel --- 
            if (relevantJobs.length > 0) {
                await pMap(relevantJobs, async (relevantJob) => { // Iterate over relevantJobs (now includes NEEDS_REVIEW)
                    const jobLogger = sourceLogger.child({ jobId: relevantJob.id, jobTitle: relevantJob.title?.substring(0,50) });
                    try {
                        // Pass the enhanced job with _assessmentStatus
                        const saved = await this.jobProcessor.processRawJob('greenhouse', relevantJob, source);

                        if (saved) {
                            stats.processed++;
                            jobLogger.trace('Job processed/saved via adapter.');
                        } else {
                            jobLogger.trace('Adapter reported job not saved (processor failure, duplicate, irrelevant post-processing, or save issue).');
                        }
                    } catch (jobError: any) {
                        // Error during processing/saving - already counted as relevant
                        stats.errors++;
                        if (!firstJobProcessingError) { // Capture the first error
                            firstJobProcessingError = `Job ${relevantJob.id} (${relevantJob.title}): ${jobError?.message || 'Unknown processing error'}`;
                        }
                        const errorDetails = {
                            message: jobError?.message,
                            stack: jobError?.stack?.split('\n').slice(0, 5).join('\n'),
                            name: jobError?.name,
                        };
                        jobLogger.error({ error: errorDetails }, '❌ Error processing individual job or calling adapter');
                    }
                }, { concurrency: 5, stopOnError: false });
            }

            sourceLogger.info(`✓ Processing completed.`);
            // Assign the first job processing error if one occurred
            if (firstJobProcessingError) {
                errorMessage = firstJobProcessingError;
            }

        } catch (error) {
            stats.errors++;
            const errorMsg = error instanceof Error ? error.message : String(error);
            errorMessage = `General processing error: ${errorMsg}`;
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError;
                sourceLogger.error(
                    { status: axiosError.response?.status, code: axiosError.code, message: axiosError.message, url: apiUrl },
                    `❌ Axios error fetching jobs for source`
                );
                errorMessage = `Axios error (${axiosError.code || 'N/A'}): ${axiosError.message}`;
            } else {
                 const genericError = error as Error;
                 sourceLogger.error({ 
                     error: { message: genericError.message, name: genericError.name, stack: genericError.stack?.split('\n').slice(0, 5).join('\n') }, 
                     boardToken, 
                     apiUrl 
                 }, '❌ General error processing source');
                  errorMessage = `General error: ${genericError.message}`;
            }
        }
        
        const durationMs = Date.now() - startTime; // Calculate final duration
        sourceLogger.info({ durationMs, stats }, 'Fetcher finished execution.');
        return { stats, foundSourceIds, durationMs, errorMessage }; // Return updated result object
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
            kw.toLowerCase().replace(/[-\/\\^$*+?.()|[\\]{}]/g, '\\$&') // Escape regex chars
        ).join('|')})\\b`, 'i'); // Added 'i' flag for case-insensitivity
        const match = pattern.exec(lowerText);
        return { match: !!match, keyword: match ? match[1] : undefined }; // Return the matched keyword
    }
    
    private _checkMetadataForRemoteness(metadata: GreenhouseMetadata[], filterConfig: FilterConfig, logger: pino.Logger): 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN' {
        if (!metadata || metadata.length === 0 || !filterConfig.REMOTE_METADATA_FIELDS) return 'UNKNOWN';
    
        let hasLatamIndicator = false;
        let hasGlobalIndicator = false;
        let hasRejectionIndicator = false;
        let rejectionReason = ''; // Keep track of why rejected
    
        const metadataFieldsConfig = filterConfig.REMOTE_METADATA_FIELDS;
    
        // Add explicit check if metadataFieldsConfig is defined
        if (!metadataFieldsConfig) {
            logger.trace('No REMOTE_METADATA_FIELDS configured. Skipping metadata check.');
            return 'UNKNOWN';
        }
    
        for (const item of metadata) {
            const fieldNameLower = item.name?.toLowerCase() || '';
            // Use case-insensitive lookup for the config key
            // Also, ensure metadataFieldsConfig is not undefined before accessing keys
            const configKey = metadataFieldsConfig ? Object.keys(metadataFieldsConfig).find(key => key.toLowerCase() === fieldNameLower) : undefined;
            // Explicitly cast metadataFieldsConfig before indexing, after confirming it exists
            const config = configKey ? (metadataFieldsConfig as any)[configKey] as FilterMetadataConfig : undefined;
    
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
                            const disallowedValuesLower = config.disallowedValues?.map((dv: string) => dv.toLowerCase());
                            const allowedValuesLower = config.allowedValues?.map((av: string) => av.toLowerCase());
                            const positiveValuesLower = config.positiveValues?.map((pv: string) => pv.toLowerCase());

                            // 1. Check Disallowed first
                            if (disallowedValuesLower?.some((disallowed: string) => val.includes(disallowed))) {
                                const matchedDisallowed = disallowedValuesLower.find((disallowed: string) => val.includes(disallowed));
                                hasRejectionIndicator = true;
                                rejectionReason = `Metadata field '${fieldNameLower}' includes disallowed value '${matchedDisallowed}' (from '${val}')`;
                                logger.trace({ field: fieldNameLower, value: val, disallowed: matchedDisallowed }, 'Metadata: Disallowed value match -> Reject');
                                break; // Stop checking this value
                            }

                            // 2. Check Allowed for specific regions
                            let allowedMatch = false;
                            if (allowedValuesLower?.some((allowed: string) => val.includes(allowed))) {
                                const matchedAllowed = allowedValuesLower.find((allowed: string) => val.includes(allowed));
                                if (matchedAllowed) {
                                    allowedMatch = true;
                                    if (['latam', 'americas', 'brazil', 'brasil'].includes(matchedAllowed)) {
                                        hasLatamIndicator = true;
                                        logger.trace({ field: fieldNameLower, value: val, allowed: matchedAllowed }, 'Metadata: Allowed value match -> LATAM');
                                    } else if (['worldwide', 'global', 'anywhere'].includes(matchedAllowed)) {
                                        hasGlobalIndicator = true;
                                         logger.trace({ field: fieldNameLower, value: val, allowed: matchedAllowed }, 'Metadata: Allowed value match -> Global');
                                    } else {
                                         // Allowed value doesn't map to Global/LATAM - could be region-specific (e.g., 'europe')
                                         // Treat as potential implicit rejection unless overruled by other positive indicators
                                         logger.trace({ field: fieldNameLower, value: val, allowed: matchedAllowed }, 'Metadata: Allowed value match found, but not Global/LATAM. Potential restriction.');
                                    }
                                }
                            }

                            // 3. Check Positive values as fallback/confirmation
                            if (!allowedMatch && positiveValuesLower?.some((positive: string) => val.includes(positive))) {
                                 hasGlobalIndicator = true; // Assume generic positive values map to global
                                 logger.trace({ field: fieldNameLower, value: val, positive: positiveValuesLower.find((p: string) => val.includes(p)) }, 'Metadata: Positive value match -> Global (Fallback)');
                            }
                            break;
                    }
                }
            } else {
                 logger.trace({ field: item.name, value: item.value }, 'Metadata field not found in config or has no actionable rules.');
            }
        }
    
        if (hasRejectionIndicator) return 'REJECT';
        if (hasLatamIndicator) return 'ACCEPT_LATAM';
        if (hasGlobalIndicator) return 'ACCEPT_GLOBAL';
    
        return 'UNKNOWN';
    }

    // --- Refactored _checkLocationName --- 
    private _checkLocationName(
        locationName: string | null | undefined,
        offices: GreenhouseOffice[] | null | undefined,
        filterConfig: FilterConfig,
        logger: pino.Logger
    ): { decision: 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN', reason?: string, region?: HiringRegion | null } {
        logger.trace("Checking Location Name and Offices...");
        const locationStr = (locationName || '').toLowerCase();
        const officeNamesStr = (offices || []).map(o => o.name?.toLowerCase()).filter(Boolean).join(' ; ');
        const combinedLocationText = `${locationStr} ; ${officeNamesStr}`.trim();

        // --- Access keywords correctly ---
        if (!filterConfig.LOCATION_KEYWORDS) {
            logger.warn("LOCATION_KEYWORDS missing in filter config.");
            return { decision: 'UNKNOWN' };
        }
        const keywords = filterConfig.LOCATION_KEYWORDS; // Use the correct variable

        // Combine ALL relevant negative keywords for initial check
        // Includes CLT/PJ which were added to the config
        const allNegativeKeywords = keywords.STRONG_NEGATIVE_RESTRICTION || [];

        // 1. Initial check for restrictive patterns
        const restrictiveCheck = detectRestrictivePattern(combinedLocationText, allNegativeKeywords, logger);
        if (restrictiveCheck.isRestrictive) {
            const reason = `Location/Office indicates Specific Restriction via keyword/pattern: ${restrictiveCheck.matchedKeyword}`;
            logger.trace({ location: combinedLocationText, keyword: restrictiveCheck.matchedKeyword }, reason);
            return { decision: 'REJECT', reason }; 
        }

        // --- Positive/Ambiguous Checks --- 

        // Priority 1: Positive LATAM Keywords (using new utility)
        const latamSignal = containsInclusiveSignal(combinedLocationText, keywords.STRONG_POSITIVE_LATAM || [], logger);
        if (latamSignal.isInclusive) {
            const reason = `Location/Office indicates LATAM: "${latamSignal.matchedKeyword}"`;
            logger.trace({ location: combinedLocationText, keyword: latamSignal.matchedKeyword }, reason);
            return { decision: 'ACCEPT_LATAM', reason, region: HiringRegion.LATAM };
        }

        // Priority 2: Positive Global Keywords (using new utility)
        const globalSignal = containsInclusiveSignal(combinedLocationText, keywords.STRONG_POSITIVE_GLOBAL || [], logger);
        if (globalSignal.isInclusive) {
            const reason = `Location/Office indicates Global: "${globalSignal.matchedKeyword}"`;
            logger.trace({ location: combinedLocationText, keyword: globalSignal.matchedKeyword }, reason);
            return { decision: 'ACCEPT_GLOBAL', reason, region: HiringRegion.WORLDWIDE };
        }

        // Priority 3: Specific Brazil Terms (using new utility)
        const brazilSignal = containsInclusiveSignal(combinedLocationText, keywords.ACCEPT_EXACT_BRAZIL_TERMS || [], logger);
        if (brazilSignal.isInclusive) {
            // Found a Brazil term, treat as LATAM for now, but log specifically
            const reason = `Location/Office indicates Brazil focus: "${brazilSignal.matchedKeyword}"`;
            logger.trace({ location: combinedLocationText, keyword: brazilSignal.matchedKeyword }, reason);
            return { decision: 'ACCEPT_LATAM', reason, region: HiringRegion.LATAM };
        }
        
        // Priority 4: Specific LATAM Countries (kept for broader LATAM check beyond Brazil)
        // Note: ACCEPT_EXACT_LATAM_COUNTRIES in config currently only has brazil/brasil which is covered above.
        // If other countries are added, this check becomes relevant again.
        if (keywords.ACCEPT_EXACT_LATAM_COUNTRIES) {
            const latamCountriesSignal = containsInclusiveSignal(combinedLocationText, keywords.ACCEPT_EXACT_LATAM_COUNTRIES, logger);
             if (latamCountriesSignal.isInclusive && !brazilSignal.isInclusive) { // Avoid double-counting Brazil
                 const reason = `Location/Office indicates specific LATAM country: "${latamCountriesSignal.matchedKeyword}"`;
                 logger.trace({ location: combinedLocationText, country: latamCountriesSignal.matchedKeyword }, reason);
                 return { decision: 'ACCEPT_LATAM', reason, region: HiringRegion.LATAM };
             }
        }

        // Priority 5: Ambiguous Keywords (only if no positive signal found)
        const proximityWindow = 30;
        const hasNearbyNegative = (text: string, index: number, keyword: string): { match: boolean, negativeKeyword: string | undefined } => {
            const start = Math.max(0, index - proximityWindow);
            const end = Math.min(text.length, index + keyword.length + proximityWindow);
            const context = text.substring(start, end);
            // Use the same combined negative keywords list for context check
            const negativeMatch = detectRestrictivePattern(context, allNegativeKeywords, logger); 
            if (negativeMatch.isRestrictive) {
                 logger.debug({ context, keyword, negativeKeyword: negativeMatch.matchedKeyword }, "Found negative keyword near ambiguous term in location.");
                 return { match: true, negativeKeyword: negativeMatch.matchedKeyword };
            }
            return { match: false, negativeKeyword: undefined };
        };

        if (keywords.AMBIGUOUS && keywords.AMBIGUOUS.length > 0) {
             // Use containsInclusiveSignal to find the first ambiguous match
             const ambiguousSignal = containsInclusiveSignal(combinedLocationText, keywords.AMBIGUOUS, logger);
             if(ambiguousSignal.isInclusive && ambiguousSignal.matchedKeyword) {
                // Need to find the index of this match to check context
                const lowerText = combinedLocationText.toLowerCase();
                const lowerKeyword = ambiguousSignal.matchedKeyword.toLowerCase();
                let startIndex = 0;
                let matchIndex = -1;
                while ((matchIndex = lowerText.indexOf(lowerKeyword, startIndex)) !== -1) {
                    // Basic check: ensure it's a whole word match (or close enough for context check)
                    const prevChar = matchIndex === 0 ? ' ' : lowerText[matchIndex - 1];
                    const nextChar = matchIndex + lowerKeyword.length >= lowerText.length ? ' ' : lowerText[matchIndex + lowerKeyword.length];
                    const isWordBoundary = !(/\w/.test(prevChar)) && !(/\w/.test(nextChar));
                    
                    if (isWordBoundary) {
                        const nearbyNegative = hasNearbyNegative(combinedLocationText, matchIndex, ambiguousSignal.matchedKeyword);
                        if (!nearbyNegative.match) { 
                            const reason = `Ambiguous location keyword '${ambiguousSignal.matchedKeyword}' confirmed as Global (no nearby negatives).`;
                            logger.trace({ location: combinedLocationText }, reason);
                            return { decision: 'ACCEPT_GLOBAL', reason, region: HiringRegion.WORLDWIDE };
                        } else {
                            // If negative found nearby, this ambiguous term is rejected, but others might exist.
                            // Continue checking other occurrences or let it fall through to UNKNOWN.
                            // For simplicity, let's stop searching if a negated ambiguous term is found.
                            // If *all* ambiguous terms are negated, it falls through to UNKNOWN.
                            logger.trace({ keyword: ambiguousSignal.matchedKeyword, negative: nearbyNegative.negativeKeyword }, "Ambiguous term negated by context.");
                            // Break or decide how to handle multiple ambiguous terms with mixed context
                            break; 
                        }
                    }
                    startIndex = matchIndex + 1; // Move past this occurrence
                }
             }
        }

        logger.trace({ location: combinedLocationText }, "Location/Office analysis result: UNKNOWN (no definitive signal found)");
        return { decision: 'UNKNOWN' };
    }

    // --- Refactored _checkContentKeywords --- 
    private _checkContentKeywords(title: string | null | undefined, content: string | null | undefined, filterConfig: FilterConfig, logger: pino.Logger): { decision: 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN', reason?: string, region?: HiringRegion | null } {
        logger.trace("Checking Content Keywords...");
        if (!content) return { decision: 'UNKNOWN' };

        const cleanedContent = stripHtml(content);
        const fullContentLower = ((title || '') + ' ' + cleanedContent).toLowerCase();

        // --- Access keywords correctly ---
        if (!filterConfig.CONTENT_KEYWORDS) {
             logger.warn("CONTENT_KEYWORDS missing in filter config.");
             return { decision: 'UNKNOWN' };
        }
        const keywords = filterConfig.CONTENT_KEYWORDS; // Use the correct variable

        // Normalize and combine all negative keywords from various sections
        // Includes CLT/PJ added to the config
        const allNegativeKeywords = [
            ...(keywords.STRONG_NEGATIVE_REGION || []),
            ...(keywords.STRONG_NEGATIVE_TIMEZONE || [])
        ].map((k: string) => k.toLowerCase()).filter(Boolean);

        // --- 1. Strong REJECT checks --- 
        const restrictiveResult = detectRestrictivePattern(fullContentLower, allNegativeKeywords, logger);
        if (restrictiveResult.isRestrictive) {
            const reason = `Content indicates Specific Restriction via keyword/pattern: ${restrictiveResult.matchedKeyword}`;
            logger.debug({ contentSnippet: fullContentLower.substring(0, 100), keyword: restrictiveResult.matchedKeyword }, reason);
            return { decision: 'REJECT', reason };
        }

        // Priority 2: Check Positive LATAM (using new utility)
        const latamSignal = containsInclusiveSignal(fullContentLower, keywords.STRONG_POSITIVE_LATAM || [], logger);
        if (latamSignal.isInclusive) {
            const reason = `Content indicates LATAM: "${latamSignal.matchedKeyword}"`;
             logger.trace({ keyword: latamSignal.matchedKeyword }, reason);
            // TODO: Optionally add context check for negatives near LATAM signal in content?
            return { decision: 'ACCEPT_LATAM', reason, region: HiringRegion.LATAM };
        }

        // Priority 3: Check Positive Global (using new utility)
        const globalSignal = containsInclusiveSignal(fullContentLower, keywords.STRONG_POSITIVE_GLOBAL || [], logger);
        if (globalSignal.isInclusive) {
            const reason = `Content indicates Global: "${globalSignal.matchedKeyword}"`;
             logger.trace({ keyword: globalSignal.matchedKeyword }, reason);
             // TODO: Optionally add context check for negatives near GLOBAL signal in content?
            return { decision: 'ACCEPT_GLOBAL', reason, region: HiringRegion.WORLDWIDE };
        }

        // Priority 4: Check Specific Brazil Terms (using new utility)
        const brazilSignal = containsInclusiveSignal(fullContentLower, keywords.ACCEPT_EXACT_BRAZIL_TERMS || [], logger);
        if (brazilSignal.isInclusive) {
            const reason = `Content indicates Brazil focus: "${brazilSignal.matchedKeyword}"`;
             logger.trace({ keyword: brazilSignal.matchedKeyword }, reason);
            // Treat as LATAM for now
            return { decision: 'ACCEPT_LATAM', reason, region: HiringRegion.LATAM };
        }

        logger.trace({ contentSnippet: fullContentLower.substring(0, 100) }, "Content keyword analysis result: UNKNOWN (no definitive signal found)");
        return { decision: 'UNKNOWN' };
    }

    // Updated return type from FilterResult to JobAssessmentStatus
    private _isJobRelevant(job: GreenhouseJob, filterConfig: FilterConfig, logger: pino.Logger): JobAssessmentStatus {
        const { id: jobId, title, content, location, metadata, offices } = job;
        const jobLogger = logger.child({ jobId, jobTitle: title?.substring(0, 50) });

        jobLogger.trace('--- Starting Relevance Check ---');

        // 0. Initial Content Check (If no content, likely irrelevant)
        if (!content) {
            jobLogger.trace('Job has no content, marking as IRRELEVANT.');
            return JobAssessmentStatus.IRRELEVANT; // Changed from FilterResult
        }
        const cleanContent = stripHtml(content).toLowerCase();

        // 1. Explicit Rejection Keywords (High Priority)
        const rejectionKeywords = (filterConfig as GreenhouseConfig)?.filterConfig?.LOCATION_KEYWORDS?.STRONG_NEGATIVE_RESTRICTION || [];
        const { match: rejectMatch, keyword: rejectKeyword } = this._matchesKeywordRegex(
            `${title || ''} ${location?.name || ''} ${cleanContent}`,
            rejectionKeywords // Use the correctly accessed keywords
        );
        if (rejectMatch) {
            jobLogger.trace({ rejectKeyword }, 'Explicit rejection keyword found, marking as IRRELEVANT.');
            return JobAssessmentStatus.IRRELEVANT; // Changed from FilterResult
        }

        // 2. Restrictive Patterns (e.g., "Remote (US Only)")
        const restrictivePattern = detectRestrictivePattern(
            `${title || ''} ${location?.name || ''}`, 
            rejectionKeywords // Use the same correctly accessed keywords
        );
        if (restrictivePattern.isRestrictive) {
            jobLogger.trace({ matchedKeyword: restrictivePattern.matchedKeyword }, 'Restrictive pattern found, marking as IRRELEVANT.');
            return JobAssessmentStatus.IRRELEVANT; // Changed from FilterResult
        }

        // 3. Check Metadata (e.g., "Location Type: Remote - LATAM")
        const metadataDecision = this._checkMetadataForRemoteness(metadata, filterConfig, jobLogger);
        if (metadataDecision === 'REJECT') {
            jobLogger.trace('Metadata indicates rejection, marking as IRRELEVANT.');
            return JobAssessmentStatus.IRRELEVANT; // Changed from FilterResult
        } else if (metadataDecision === 'ACCEPT_GLOBAL' || metadataDecision === 'ACCEPT_LATAM') {
            jobLogger.trace({ metadataDecision }, 'Metadata indicates relevance, marking as RELEVANT.');
            return JobAssessmentStatus.RELEVANT; // Changed from FilterResult
            // Future: Could differentiate GLOBAL/LATAM here if needed
        }
        jobLogger.trace({ metadataDecision }, 'Metadata check result (did not determine relevance).');

        // 4. Check Location Name & Offices
        const locationDecision = this._checkLocationName(location?.name, offices, filterConfig, jobLogger);
        if (locationDecision.decision === 'REJECT') {
            jobLogger.trace({ reason: locationDecision.reason }, 'Location name indicates rejection, marking as IRRELEVANT.');
            return JobAssessmentStatus.IRRELEVANT; // Changed from FilterResult
        } else if (locationDecision.decision === 'ACCEPT_GLOBAL' || locationDecision.decision === 'ACCEPT_LATAM') {
            jobLogger.trace({ reason: locationDecision.reason, decision: locationDecision.decision }, 'Location name indicates relevance, marking as RELEVANT.');
            return JobAssessmentStatus.RELEVANT; // Changed from FilterResult
        }
        jobLogger.trace({ decision: locationDecision.decision, reason: locationDecision.reason }, 'Location name check result (did not determine relevance).');

        // 5. Check Content Keywords (Title + Description)
        const contentDecision = this._checkContentKeywords(title, cleanContent, filterConfig, jobLogger);
        if (contentDecision.decision === 'REJECT') {
            jobLogger.trace({ reason: contentDecision.reason }, 'Content keywords indicate rejection, marking as IRRELEVANT.');
            return JobAssessmentStatus.IRRELEVANT; // Changed from FilterResult
        } else if (contentDecision.decision === 'ACCEPT_GLOBAL' || contentDecision.decision === 'ACCEPT_LATAM') {
            jobLogger.trace({ reason: contentDecision.reason, decision: contentDecision.decision }, 'Content keywords indicate relevance, marking as RELEVANT.');
            return JobAssessmentStatus.RELEVANT; // Changed from FilterResult
        }
        jobLogger.trace({ decision: contentDecision.decision, reason: contentDecision.reason }, 'Content keyword check result (did not determine relevance).');

        // *** NEW: NEEDS_REVIEW Check (Add this before the final fallback) ***
        // Placeholder: This needs the actual WorkplaceType to be determined first.
        // We might need to fetch this earlier or pass it in if available at the fetcher stage.
        // For now, we'll skip this specific check in the fetcher and assume it happens
        // later in the processor or service based on standardized data.

        // 6. Final Fallback (Default Decision if no clear signal)
        // Previously: Defaulted to relevant if passes initial checks. Now needs careful consideration.
        // If we reach here, no strong accept/reject signal was found.
        // Let's default to IRRELEVANT for now, assuming ambiguity should not pass.
        // This might be refined later, potentially moving to NEEDS_REVIEW if other checks pass
        // but location/content checks were inconclusive.
        jobLogger.trace('No definitive signal found after all checks, defaulting to IRRELEVANT.');
        return JobAssessmentStatus.IRRELEVANT; // Changed from FilterResult
    }
}