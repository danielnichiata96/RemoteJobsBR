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
import { stripHtml } from '../utils/textUtils'; // Correct import
import { JobFetcher, SourceStats, FetcherResult, GreenhouseJob, GreenhouseMetadata, GreenhouseOffice, FilterResult } from './types';
import { detectRestrictivePattern } from '../utils/filterUtils'; // Import the new utility

export class GreenhouseFetcher implements JobFetcher {
    private prisma: PrismaClient;
    private jobProcessor: JobProcessingAdapter;

    constructor(prismaClient: PrismaClient, jobProcessingAdapter: JobProcessingAdapter) {
        this.prisma = prismaClient;
        this.jobProcessor = jobProcessingAdapter;
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

            // --- Process Jobs ---
            sourceLogger.trace(`Processing ${apiJobs.length} jobs for relevance...`);
            // Store the first significant error encountered during job processing
            let firstJobProcessingError: string | undefined = undefined; 
            
            await pMap(apiJobs, async (job) => {
                 const jobLogger = sourceLogger.child({ jobId: job.id, jobTitle: job.title });
                try {
                    const relevanceResult = this._isJobRelevant(job, filterConfig!, jobLogger);
                    if (relevanceResult.relevant) {
                        stats.relevant++;
                        jobLogger.trace(
                            { reason: relevanceResult.reason, type: relevanceResult.type },
                            `➡️ Relevant job found`
                        );

                        const enhancedJob = {
                            ...job,
                            _determinedHiringRegionType: relevanceResult.type
                        };

                        const saved = await this.jobProcessor.processRawJob('greenhouse', enhancedJob, source);

                        if (saved) {
                            stats.processed++;
                            jobLogger.trace('Job processed/saved via adapter.');
                        } else {
                            // Note: Adapter failures (like duplicates) might not be counted as errors here
                            // but could be inferred later if processed < relevant.
                            jobLogger.trace('Adapter reported job not saved (processor failure, duplicate, irrelevant post-processing, or save issue).');
                        }
                    } else {
                        jobLogger.trace({ reason: relevanceResult.reason }, `Job skipped as irrelevant`);
                    }
                } catch (jobError: any) {
                    stats.errors++;
                    if (!firstJobProcessingError) { // Capture the first error
                        firstJobProcessingError = `Job ${job.id} (${job.title}): ${jobError?.message || 'Unknown processing error'}`;
                    }
                    const errorDetails = {
                        message: jobError?.message,
                        stack: jobError?.stack?.split('\n').slice(0, 5).join('\n'),
                        name: jobError?.name,
                    };
                     jobLogger.error({ error: errorDetails }, '❌ Error processing individual job or calling adapter');
                }
            }, { concurrency: 5, stopOnError: false });

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
                                         // Allowed value doesn't map to Global/LATAM - could be region-specific (e.g., 'europe')
                                         // Treat as potential implicit rejection unless overruled by other positive indicators
                                         logger.trace({ field: fieldNameLower, value: val, allowed: matchedAllowed }, 'Metadata: Allowed value match found, but not Global/LATAM. Potential restriction.');
                                    }
                                }
                            }

                            // 3. Check Positive values as fallback/confirmation
                            if (!allowedMatch && positiveValuesLower?.some(positive => val.includes(positive))) {
                                 hasGlobalIndicator = true; // Assume generic positive values map to global
                                 logger.trace({ field: fieldNameLower, value: val, positive: positiveValuesLower.find(p => val.includes(p)) }, 'Metadata: Positive value match -> Global (Fallback)');
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
    ): { decision: 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN', reason?: string } {
        logger.trace("Checking Location Name and Offices...");
        const combinedLocationText = ((locationName || '') + ' ' + (offices?.map(o => o.name || '').join(' ') || '')).toLowerCase();

        if (!combinedLocationText.trim()) {
            return { decision: 'UNKNOWN' };
        }

        // Combine ALL relevant negative keywords for this check
        const allNegativeKeywords = [
            ...(filterConfig.LOCATION_KEYWORDS?.STRONG_NEGATIVE_RESTRICTION || []),
            // Add content keywords here too if they should apply to location string analysis
            ...(filterConfig.CONTENT_KEYWORDS?.STRONG_NEGATIVE_REGION || []),
            ...(filterConfig.CONTENT_KEYWORDS?.STRONG_NEGATIVE_TIMEZONE || [])
        ];
        if (detectRestrictivePattern(combinedLocationText, allNegativeKeywords, logger)) {
            const reason = `Location/Office indicates Specific Restriction via keyword/pattern`;
            logger.debug({ location: combinedLocationText }, reason);
            return { decision: 'REJECT', reason };
        }

        const keywords = filterConfig.LOCATION_KEYWORDS;
        if (!keywords) {
            logger.warn("LOCATION_KEYWORDS missing in filter config.");
            return { decision: 'UNKNOWN' };
        }

        const proximityWindow = 30;
        const hasNearbyNegative = (text: string, index: number, keyword: string): { match: boolean, negativeKeyword: string | undefined } => {
            const start = Math.max(0, index - proximityWindow);
            const end = Math.min(text.length, index + keyword.length + proximityWindow);
            const context = text.substring(start, end);
            const negativeMatch = this._matchesKeywordRegex(context, keywords.STRONG_NEGATIVE_RESTRICTION);
            if (negativeMatch.match) {
                 logger.debug({ context, keyword, negativeKeyword: negativeMatch.keyword }, "Found negative keyword near ambiguous term.");
                 return { match: true, negativeKeyword: negativeMatch.keyword };
            }
            return { match: false, negativeKeyword: undefined };
        };

        // Check Negative FIRST
        const negativeMatch = this._matchesKeywordRegex(combinedLocationText, keywords.STRONG_NEGATIVE_RESTRICTION);
        if (negativeMatch.match) {
            const reason = `Location/Office indicates Restriction: \"${negativeMatch.keyword}\"`;
            logger.debug({ location: combinedLocationText, keyword: negativeMatch.keyword }, reason);
            return { decision: 'REJECT', reason };
        }

        // Check LATAM
        const latamMatch = this._matchesKeywordRegex(combinedLocationText, keywords.STRONG_POSITIVE_LATAM);
        if (latamMatch.match) {
            const reason = `Location/Office indicates LATAM: \"${latamMatch.keyword}\"`;
            logger.trace({ location: combinedLocationText, keyword: latamMatch.keyword }, reason);
            return { decision: 'ACCEPT_LATAM', reason };
        }

        // Check Global
        const globalMatch = this._matchesKeywordRegex(combinedLocationText, keywords.STRONG_POSITIVE_GLOBAL);
        if (globalMatch.match) {
            const reason = `Location/Office indicates Global: \"${globalMatch.keyword}\"`;
            logger.trace({ location: combinedLocationText, keyword: globalMatch.keyword }, reason);
            return { decision: 'ACCEPT_GLOBAL', reason };
        }

        // Check Ambiguous WITH Context Check
        if (keywords.AMBIGUOUS && keywords.AMBIGUOUS.length > 0) {
             const ambiguousPattern = new RegExp(`\\b(${keywords.AMBIGUOUS.map(kw =>
                kw.toLowerCase().replace(/[-\/\\^$*+?.()|[\\]{}]/g, '\\$&')
            ).join('|')})\\b`, 'gi'); 
            let match;
            while ((match = ambiguousPattern.exec(combinedLocationText)) !== null) {
                const ambiguousKeyword = match[1];
                const index = match.index;
                const nearbyNegative = hasNearbyNegative(combinedLocationText, index, ambiguousKeyword);
                if (nearbyNegative.match) {
                     const reason = `Ambiguous term '${ambiguousKeyword}' rejected due to nearby negative '${nearbyNegative.negativeKeyword}'.`;
                     logger.debug({ location: combinedLocationText, keyword: ambiguousKeyword, negativeKeyword: nearbyNegative.negativeKeyword }, reason);
                     return { decision: 'REJECT', reason }; 
                } else {
                    const reason = `Ambiguous keyword '${ambiguousKeyword}' confirmed as Global (no nearby negatives).`;
                     logger.trace({ location: combinedLocationText, keyword: ambiguousKeyword }, reason);
                    return { decision: 'ACCEPT_GLOBAL', reason }; 
                }
            }
        }

        // Check specific LATAM countries
        if (keywords.ACCEPT_EXACT_LATAM_COUNTRIES) {
            const countries = keywords.ACCEPT_EXACT_LATAM_COUNTRIES.map(c => c.toLowerCase());
            if (countries.some(country => combinedLocationText.includes(country))) {
                const foundCountry = countries.find(country => combinedLocationText.includes(country));
                const reason = `Location/Office indicates specific LATAM country: \"${foundCountry}\"`;
                 logger.trace({ location: combinedLocationText, country: foundCountry }, reason);
                return { decision: 'ACCEPT_LATAM', reason };
            }
        }

        logger.trace({ location: combinedLocationText }, "Location/Office analysis result: UNKNOWN");
        return { decision: 'UNKNOWN' };
    }

    // --- Refactored _checkContentKeywords --- 
    private _checkContentKeywords(title: string | null | undefined, content: string | null | undefined, filterConfig: FilterConfig, logger: pino.Logger): { decision: 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN', reason?: string } {
        logger.trace("Checking Content Keywords...");
        if (!content) return { decision: 'UNKNOWN' };

        const fullContentLower = ((title || '') + ' ' + (content || '')).toLowerCase();

        // Combine ALL relevant negative keywords for this check
        const allNegativeKeywords = [
             // Location keywords can also appear in content
            ...(filterConfig.LOCATION_KEYWORDS?.STRONG_NEGATIVE_RESTRICTION || []),
            ...(filterConfig.CONTENT_KEYWORDS?.STRONG_NEGATIVE_REGION || []),
            ...(filterConfig.CONTENT_KEYWORDS?.STRONG_NEGATIVE_TIMEZONE || [])
        ];
        if (detectRestrictivePattern(fullContentLower, allNegativeKeywords, logger)) {
             const reason = `Content indicates Specific Restriction via keyword/pattern`;
             logger.debug(reason);
            return { decision: 'REJECT', reason };
        }

        const keywords = filterConfig.CONTENT_KEYWORDS;
        if (!keywords) {
            logger.warn("CONTENT_KEYWORDS missing in filter config.");
            return { decision: 'UNKNOWN' };
        }

        const proximityWindow = 30;

        const hasNearbyNegative = (text: string, index: number, keyword: string): { match: boolean, negativeKeyword: string | undefined } => {
            const start = Math.max(0, index - proximityWindow);
            const end = Math.min(text.length, index + keyword.length + proximityWindow);
            const context = text.substring(start, end);
            const allNegativeKeywords = [...(keywords.STRONG_NEGATIVE_REGION || []), ...(keywords.STRONG_NEGATIVE_TIMEZONE || [])];
            const negativeMatch = this._matchesKeywordRegex(context, allNegativeKeywords);
             if (negativeMatch.match) {
                 logger.debug({ context, keyword, negativeKeyword: negativeMatch.keyword }, "Found negative keyword near term in content.");
                 return { match: true, negativeKeyword: negativeMatch.keyword };
            }
            return { match: false, negativeKeyword: undefined };
        };

        // Check Negative FIRST
        const negativeRegionMatch = this._matchesKeywordRegex(fullContentLower, keywords.STRONG_NEGATIVE_REGION);
        if (negativeRegionMatch.match) {
             const reason = `Content indicates Region Restriction: \"${negativeRegionMatch.keyword}\"`;
             logger.debug({ keyword: negativeRegionMatch.keyword }, reason);
            return { decision: 'REJECT', reason };
        }
        const negativeTimezoneMatch = this._matchesKeywordRegex(fullContentLower, keywords.STRONG_NEGATIVE_TIMEZONE);
        if (negativeTimezoneMatch.match) {
             const reason = `Content indicates Timezone Restriction: \"${negativeTimezoneMatch.keyword}\"`;
             logger.debug({ keyword: negativeTimezoneMatch.keyword }, reason);
            return { decision: 'REJECT', reason };
        }

        // Check LATAM 
        const latamMatch = this._includesSubstringKeyword(fullContentLower, keywords.STRONG_POSITIVE_LATAM);
        if (latamMatch.match) {
             const reason = `Content indicates LATAM: \"${latamMatch.keyword}\"`;
             logger.trace({ keyword: latamMatch.keyword }, reason);
            // Even if LATAM found, quickly check its context for immediate negatives
             const latamPattern = new RegExp(`\\b(${keywords.STRONG_POSITIVE_LATAM.map(kw => kw.toLowerCase().replace(/[-\/\\^$*+?.()|[\\]{}]/g, '\\$&')).join('|')})\\b`, 'gi');
             let latamIdxMatch;
             while((latamIdxMatch = latamPattern.exec(fullContentLower)) !== null){
                 const nearbyNegative = hasNearbyNegative(fullContentLower, latamIdxMatch.index, latamIdxMatch[1]);
                 if(nearbyNegative.match){
                     const rejectReason = `LATAM term '${latamIdxMatch[1]}' negated by nearby '${nearbyNegative.negativeKeyword}'.`;
                     logger.debug(rejectReason);
                     return { decision: 'REJECT', reason: rejectReason };
                 }
             }
            // If no nearby negatives found for any LATAM term, accept
            return { decision: 'ACCEPT_LATAM', reason };
        }

        // Check Global WITH Context Check
        if (keywords.STRONG_POSITIVE_GLOBAL && keywords.STRONG_POSITIVE_GLOBAL.length > 0) {
            const globalPattern = new RegExp(`\\b(${keywords.STRONG_POSITIVE_GLOBAL.map(kw =>
                kw.toLowerCase().replace(/[-\/\\^$*+?.()|[\\]{}]/g, '\\$&')
            ).join('|')})\\b`, 'gi');
            let match;
            while ((match = globalPattern.exec(fullContentLower)) !== null) {
                const globalKeyword = match[1];
                const index = match.index;
                const nearbyNegative = hasNearbyNegative(fullContentLower, index, globalKeyword);
                if (nearbyNegative.match) {
                     const reason = `Positive global term '${globalKeyword}' negated by nearby negative '${nearbyNegative.negativeKeyword}'.`;
                     logger.debug({ keyword: globalKeyword, negativeKeyword: nearbyNegative.negativeKeyword }, reason);
                     return { decision: 'REJECT', reason };
                } else {
                    const reason = `Positive global keyword '${globalKeyword}' confirmed (no nearby negatives).`;
                     logger.trace({ keyword: globalKeyword }, reason);
                     return { decision: 'ACCEPT_GLOBAL', reason }; // Found one clean global signal
                }
            }
        }

        logger.trace("Content keyword analysis result: UNKNOWN");
        return { decision: 'UNKNOWN' };
    }

    // --- Refactored _isJobRelevant using the updated checks ---
    private _isJobRelevant(job: GreenhouseJob, filterConfig: FilterConfig, logger: pino.Logger): FilterResult {
        const jobLogger = logger.child({ jobId: job.id, jobTitle: job.title, fn: '_isJobRelevant' });
        jobLogger.debug("--- Starting Relevance Check ---");

        // --- Check Order: Metadata -> Location -> Content --- 

        // 1. Metadata Check
        const metadataResult = this._checkMetadataForRemoteness(job.metadata || [], filterConfig, jobLogger);
        jobLogger.debug({ metadataResult }, "Metadata Check Result");
        if (metadataResult === 'REJECT') {
            return { relevant: false, reason: 'Metadata indicates Restriction' };
        }
        // Accept LATAM immediately if found in metadata
        if (metadataResult === 'ACCEPT_LATAM') {
            return { relevant: true, reason: 'Metadata(LATAM)', type: 'latam' };
        }

        // 2. Location Check
        const locationCheck = this._checkLocationName(job.location?.name, job.offices, filterConfig, jobLogger);
        jobLogger.debug({ decision: locationCheck.decision, reason: locationCheck.reason }, "Location Check Result");
        if (locationCheck.decision === 'REJECT') {
            return { relevant: false, reason: locationCheck.reason || 'Location/Office indicates Restriction' };
        }
        // Accept LATAM immediately if found in location
        if (locationCheck.decision === 'ACCEPT_LATAM') {
            return { relevant: true, reason: locationCheck.reason || 'Location/Office(LATAM)', type: 'latam' };
        }

        // 3. Content Check
        const contentCheck = this._checkContentKeywords(job.title, stripHtml(job.content || ''), filterConfig, jobLogger);
        jobLogger.debug({ decision: contentCheck.decision, reason: contentCheck.reason }, "Content Check Result");
        if (contentCheck.decision === 'REJECT') {
            return { relevant: false, reason: contentCheck.reason || 'Content indicates Restriction' };
        }
        // Accept LATAM immediately if found in content
        if (contentCheck.decision === 'ACCEPT_LATAM') {
            return { relevant: true, reason: contentCheck.reason || 'Content(LATAM)', type: 'latam' };
        }

        // --- Final Decision Logic (GLOBAL or UNKNOWN/REJECT) --- 
        // If we reach here, no stage has definitively REJECTED or ACCEPTED_LATAM.
        // We now check if any stage indicated GLOBAL acceptance.
        const isGlobalFromMetadata = metadataResult === 'ACCEPT_GLOBAL';
        const isGlobalFromLocation = locationCheck.decision === 'ACCEPT_GLOBAL';
        const isGlobalFromContent = contentCheck.decision === 'ACCEPT_GLOBAL';

        if (isGlobalFromMetadata || isGlobalFromLocation || isGlobalFromContent) {
             let globalReason = 'Unknown Global Signal';
             // Prioritize the reason from the first GLOBAL signal found
             if (isGlobalFromMetadata) globalReason = 'Metadata(Global)';
             else if (isGlobalFromLocation) globalReason = locationCheck.reason || 'Location/Office(Global)';
             else if (isGlobalFromContent) globalReason = contentCheck.reason || 'Content(Global)';
             
             jobLogger.info({ finalReason: globalReason }, "Final Decision: ACCEPT_GLOBAL based on combined checks.");
             return { relevant: true, reason: globalReason, type: 'global' };
        }

        // If no REJECT, no ACCEPT_LATAM, and no ACCEPT_GLOBAL signal was found, treat as irrelevant.
        jobLogger.debug("Final Decision: Job is not relevant (Ambiguous or No Remote Signal).");
        return { relevant: false, reason: 'Ambiguous or No Remote Signal' };
    }
}