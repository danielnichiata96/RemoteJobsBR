import axios, { AxiosError } from 'axios';
import { PrismaClient, JobSource, Prisma } from '@prisma/client';
import pMap from 'p-map';
import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';
import { JobProcessingAdapter } from '../adapters/JobProcessingAdapter';
import { JobSourceConfig, getAshbyConfig, FilterConfig } from '../../types/JobSource'; // Import FilterConfig
import { StandardizedJob } from '../../types/StandardizedJob';
import { JobFetcher, SourceStats, FetcherResult, FilterResult, AshbyApiJob } from './types'; // Use real AshbyApiJob
import { stripHtml } from '../utils/textUtils';
import { detectRestrictivePattern } from '../utils/filterUtils';

export class AshbyFetcher implements JobFetcher {
    private prisma: PrismaClient;
    private jobProcessor: JobProcessingAdapter;
    private filterConfig: FilterConfig | null = null; // Store loaded config

    constructor(prismaClient: PrismaClient, jobProcessingAdapter: JobProcessingAdapter) {
        this.prisma = prismaClient;
        this.jobProcessor = jobProcessingAdapter;
        this._loadFilterConfig(); // Load config on instantiation
    }

    // Helper to load filter config
    private _loadFilterConfig(logger?: pino.Logger): void {
        const log = logger || pino({ name: 'AshbyFetcherConfigLoad', level: 'info' });
        try {
            const configPath = path.resolve(__dirname, '../../../config/ashby-filter-config.json');
            log.trace({ configPath }, `AshbyFetcher: Attempting to load filter configuration...`);
            const configFile = fs.readFileSync(configPath, 'utf-8');
            this.filterConfig = JSON.parse(configFile) as FilterConfig;
            log.info({ configPath }, `AshbyFetcher: Successfully loaded filter configuration.`);
        } catch (error: any) {
            log.error({ err: error, configPath: path.resolve(__dirname, '../../../config/ashby-filter-config.json') }, `AshbyFetcher: ❌ Failed to load or parse filter configuration. Filtering keywords will not be applied.`);
            this.filterConfig = null; // Keep null assignment in case of error
        }
    }

    async processSource(source: JobSource, parentLogger: pino.Logger): Promise<FetcherResult> {
        const startTime = Date.now();
        let errorMessage: string | undefined = undefined;

        const sourceLogger = parentLogger.child({ fetcher: 'Ashby', sourceName: source.name, sourceId: source.id });
        const stats: SourceStats = { found: 0, relevant: 0, processed: 0, deactivated: 0, errors: 0 };
        const foundSourceIds = new Set<string>();
        let jobBoardName: string | null = null;
        let apiUrl: string | null = null;

        // Load config if not already loaded (though it's currently set to null)
        if (!this.filterConfig) {
            this._loadFilterConfig(sourceLogger); 
            // No longer throwing an error if config is null
        }

        try {
            // --- Load Configuration ---
            sourceLogger.trace('Loading source-specific configuration...');
            const ashbyConfig = getAshbyConfig(source.config);
            if (!ashbyConfig || !ashbyConfig.jobBoardName) {
                sourceLogger.error('❌ Missing or invalid jobBoardName in source config');
                stats.errors++;
                errorMessage = 'Invalid jobBoardName in source config';
                const durationMs = Date.now() - startTime;
                return { stats, foundSourceIds, durationMs, errorMessage };
            }
            jobBoardName = String(ashbyConfig.jobBoardName);
            apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${jobBoardName}`;
            sourceLogger.info({ jobBoardName, apiUrl }, `-> Starting processing...`);

            // --- Fetch Jobs ---
            sourceLogger.trace({ apiUrl }, 'Fetching jobs from Ashby API...');
            // Ashby API requires an Accept header
            const response = await axios.get(apiUrl, {
                timeout: 45000,
                headers: { 'Accept': 'application/json' }
            });

            // Check if the response is valid JSON and has the jobs array
            if (!response.data || !Array.isArray(response.data.jobs)) {
                sourceLogger.error({ responseStatus: response.status, responseData: response.data }, '❌ Invalid response structure from Ashby API');
                stats.errors++;
                errorMessage = 'Invalid response structure from Ashby API';
                const durationMs = Date.now() - startTime;
                return { stats, foundSourceIds, durationMs, errorMessage };
            }
            const apiJobs: AshbyApiJob[] = response.data.jobs;
            stats.found = apiJobs.length;
            apiJobs.forEach(job => {
                if (job && job.id) {
                    foundSourceIds.add(String(job.id));
                } else {
                    sourceLogger.warn({ job }, 'Found job without a valid ID in API response');
                }
            }); 
            sourceLogger.info(`+ ${stats.found} jobs found in API response.`);

            if (apiJobs.length === 0) {
                sourceLogger.info('No jobs found for this source.');
                const durationMs = Date.now() - startTime;
                return { stats, foundSourceIds, durationMs, errorMessage };
            }
            sourceLogger.trace({ sampleJobId: apiJobs[0]?.id, sampleJobTitle: apiJobs[0]?.title }, 'Sample job structure check');

            // --- Process Jobs ---
            sourceLogger.trace(`Processing ${apiJobs.length} jobs for relevance...`);
            let firstJobProcessingError: string | undefined = undefined;

            await pMap(apiJobs.filter(job => job && job.id), async (job) => {
                const jobLogger = sourceLogger.child({ jobId: job.id, jobTitle: job.title });
                try {
                    // Use the implemented _isJobRelevant
                    const relevanceResult = this._isJobRelevant(job, jobLogger);
                    if (relevanceResult.relevant) {
                        stats.relevant++;
                        jobLogger.trace(
                            { reason: relevanceResult.reason, type: relevanceResult.type },
                            `➡️ Relevant job found`
                        );
                        
                        // Pass the determined type to the processor if needed
                        const enhancedJob = {
                            ...job,
                            _determinedHiringRegionType: relevanceResult.type
                        };
                        
                        const saved = await this.jobProcessor.processRawJob('ashby', enhancedJob, source);

                        if (saved) {
                            stats.processed++;
                            jobLogger.trace('Job processed/saved via adapter.');
                        } else {
                            jobLogger.trace('Adapter reported job not saved (processor failure, duplicate, irrelevant post-processing, or save issue).');
                        }
                    } else {
                        jobLogger.trace({ reason: relevanceResult.reason }, `Job skipped as irrelevant`);
                    }
                } catch (jobError: any) {
                    stats.errors++;
                    if (!firstJobProcessingError) {
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
                    { status: axiosError.response?.status, code: axiosError.code, message: axiosError.message, url: apiUrl, responseData: axiosError.response?.data },
                    `❌ Axios error fetching jobs for source`
                );
                errorMessage = `Axios error (${axiosError.code || 'N/A'} - status ${axiosError.response?.status || 'N/A'}): ${axiosError.message}`;
            } else {
                const genericError = error as Error;
                sourceLogger.error({
                    error: { message: genericError.message, name: genericError.name, stack: genericError.stack?.split('\n').slice(0, 5).join('\n') }, 
                    msg: '❌ General error processing source' 
                });
            }
        }

        const durationMs = Date.now() - startTime;
        return { stats, foundSourceIds, durationMs, errorMessage };
    }

    // --- Filtering Logic Implementation ---

    // --- Helper methods adapted from GreenhouseFetcher --- 
    // (Made private to this class for encapsulation)
    private _includesSubstringKeyword(text: string | null | undefined, keywords: string[]): { match: boolean, keyword: string | undefined } {
        if (!text || !keywords || keywords.length === 0) return { match: false, keyword: undefined };
        const lowerText = text.toLowerCase().trim();
        // Handle multi-word keywords and potential extra spacing
        for (const keyword of keywords) {
            const lowerKeyword = keyword.toLowerCase();
            // Check for exact phrase match, potentially with variations in spacing
            if (lowerText.includes(lowerKeyword)) {
                 // Basic check passed, ensure it's not part of a larger word unexpectedly (optional refinement)
                 // Example: Check word boundaries if needed, but simple includes is often sufficient
                return { match: true, keyword: keyword };
            }
        }
        return { match: false, keyword: undefined };
    }

    // Simplified: Use includes check like _includesSubstringKeyword for consistency
    private _matchesKeywordRegex(text: string | null | undefined, keywords: string[]): { match: boolean, keyword: string | undefined } {
         // Delegate to the potentially more robust includes check
         return this._includesSubstringKeyword(text, keywords);
    }

    // --- Ashby Specific Filtering Checks ---

    private _checkLocation(job: AshbyApiJob, config: FilterConfig | null, logger: pino.Logger): { decision: 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN', reason?: string } {
        logger.trace("Checking Location Keywords...");

        // If no config, cannot perform keyword checks
        if (!config?.LOCATION_KEYWORDS) {
            logger.trace("No location keywords configured or config is null. Skipping location keyword checks.");
            return { decision: 'UNKNOWN' };
        }

        // Include primary and secondary address details in the text to check
        const addressDetails = [
            job.address?.postalAddress?.addressLocality,
            job.address?.postalAddress?.addressRegion,
            job.address?.postalAddress?.addressCountry,
            ...(job.secondaryLocations || []).flatMap(loc => [
                loc.address?.addressLocality,
                loc.address?.addressRegion,
                loc.address?.addressCountry
            ])
        ].filter(Boolean).join('; ');

        const combinedLocationText = [
            job.location,
            ...(job.secondaryLocations || []).map((l: { location?: string }) => l.location),
            addressDetails // Add the structured address details
        ].filter(Boolean).join('; ').toLowerCase();

        logger.trace({ location: combinedLocationText }, "Combined Location Text for Analysis (including address details)");

        // Check for empty location text only if NOT explicitly remote
        if (!combinedLocationText && job.isRemote !== true) {
             logger.trace("No location text and job is not marked remote.");
            return { decision: 'UNKNOWN' }; 
        }
        
        // If the job has no location text AND is explicitly marked remote,
        // we can potentially accept it as global *unless* content check rejects.
        // Return UNKNOWN here to let content check run.
        // Adjusted for type safety: explicitly check for true
        if (!combinedLocationText && job.isRemote === true) { 
             logger.trace("Job is remote with no location text.");
             return { decision: 'UNKNOWN', reason: 'Remote job with no location text' };
        }

        // 1. Check for STRONG_NEGATIVE keywords (RUN THIS REGARDLESS OF isRemote)
        const negativeMatch = this._matchesKeywordRegex(combinedLocationText, config.LOCATION_KEYWORDS?.STRONG_NEGATIVE_RESTRICTION || []);
        if (negativeMatch.match) {
            const reason = `Location indicates Restriction: "${negativeMatch.keyword}"`;
            logger.debug({ location: combinedLocationText, keyword: negativeMatch.keyword }, reason);
            return { decision: 'REJECT', reason };
        }

        // 2. Check for STRONG_POSITIVE_LATAM keywords
        const latamKeywords = config.LOCATION_KEYWORDS?.STRONG_POSITIVE_LATAM || [];
        if (latamKeywords.length > 0) {
            const latamMatch = this._matchesKeywordRegex(combinedLocationText, latamKeywords);
            if (latamMatch.match) {
                const reason = `Location indicates LATAM: "${latamMatch.keyword}"`;
                logger.trace({ location: combinedLocationText, keyword: latamMatch.keyword }, reason);
                return { decision: 'ACCEPT_LATAM', reason };
            }
        }

        // 3. Check for STRONG_POSITIVE_GLOBAL keywords
        const globalKeywords = config.LOCATION_KEYWORDS?.STRONG_POSITIVE_GLOBAL || [];
        if (globalKeywords.length > 0) {
            const globalMatch = this._matchesKeywordRegex(combinedLocationText, globalKeywords);
            if (globalMatch.match) {
                const reason = `Location indicates Global: "${globalMatch.keyword}"`;
                logger.trace({ location: combinedLocationText, keyword: globalMatch.keyword }, reason);
                return { decision: 'ACCEPT_GLOBAL', reason };
            }
        }
        
        // 4. Check for exact LATAM countries if config exists
        if (config.LOCATION_KEYWORDS?.ACCEPT_EXACT_LATAM_COUNTRIES) {
            const countries = config.LOCATION_KEYWORDS.ACCEPT_EXACT_LATAM_COUNTRIES.map(c => c.toLowerCase());
            if (countries.some(country => combinedLocationText.includes(country))) {
                const foundCountry = countries.find(country => combinedLocationText.includes(country));
                const reason = `Location indicates specific LATAM country: "${foundCountry}"`;
                 logger.trace({ location: combinedLocationText, country: foundCountry }, reason);
                return { decision: 'ACCEPT_LATAM', reason };
            }
        }

        // 5. Handle ambiguous 'remote' only if explicitly present in location string(s)
        // This differs slightly from Greenhouse as Ashby has `isRemote` flag.
        // We only consider 'remote' keyword if isRemote flag wasn't explicitly true.
        if (!job.isRemote && combinedLocationText.includes('remote')) {
             const ambiguousKeywords = config.LOCATION_KEYWORDS?.AMBIGUOUS || [];
             const ambiguousPattern = new RegExp(`\b(${ambiguousKeywords.map(kw => kw.toLowerCase().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\b`, 'gi');
             let match;
             const proximityWindow = 30;
             while ((match = ambiguousPattern.exec(combinedLocationText)) !== null) {
                 const ambiguousKeyword = match[1];
                 const index = match.index;
                 // Check nearby context for negative keywords
                 const start = Math.max(0, index - proximityWindow);
                 const end = Math.min(combinedLocationText.length, index + ambiguousKeyword.length + proximityWindow);
                 const context = combinedLocationText.substring(start, end);
                 const negativeNearbyMatch = this._matchesKeywordRegex(context, config.LOCATION_KEYWORDS?.STRONG_NEGATIVE_RESTRICTION || []);
                 if (negativeNearbyMatch.match) {
                     const reason = `Ambiguous term '${ambiguousKeyword}' rejected due to nearby negative '${negativeNearbyMatch.keyword}'.`;
                     logger.debug({ location: combinedLocationText, keyword: ambiguousKeyword, negativeKeyword: negativeNearbyMatch.keyword }, reason);
                     return { decision: 'REJECT', reason }; 
                 } else {
                      // If ambiguous 'remote' found and no nearby negatives, treat as Global (as isRemote=false was handled earlier)
                     const reason = `Ambiguous keyword '${ambiguousKeyword}' confirmed as Global (isRemote=false, no nearby negatives).`;
                     logger.trace({ location: combinedLocationText, keyword: ambiguousKeyword }, reason);
                     return { decision: 'ACCEPT_GLOBAL', reason }; 
                 }
             }
        }

        logger.trace({ location: combinedLocationText }, "Location analysis result: UNKNOWN");
        return { decision: 'UNKNOWN' };
    }

    private _checkContent(job: AshbyApiJob, config: FilterConfig | null, logger: pino.Logger): { decision: 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN', reason?: string } {
        logger.trace("Checking Content Keywords...");

        // If no config, cannot perform keyword checks
        if (!config?.CONTENT_KEYWORDS && !config?.LOCATION_KEYWORDS?.STRONG_NEGATIVE_RESTRICTION) {
             logger.trace("No content/negative location keywords configured or config is null. Skipping content keyword checks.");
            return { decision: 'UNKNOWN' };
        }

        const content = stripHtml(job.descriptionHtml || '');
        const title = job.title || '';
        if (!content && !title) return { decision: 'UNKNOWN' };

        const fullContentLower = (title + ' ' + content).toLowerCase();
        logger.trace({ length: fullContentLower.length }, "Full content lower length for analysis.");

        // 1. Check for STRONG_NEGATIVE keywords/patterns
        // Ensure keywords exist before proceeding
        const allNegativeKeywords = [
            ...(config?.LOCATION_KEYWORDS?.STRONG_NEGATIVE_RESTRICTION || []),
            ...(config?.CONTENT_KEYWORDS?.STRONG_NEGATIVE_REGION || []),
            ...(config?.CONTENT_KEYWORDS?.STRONG_NEGATIVE_TIMEZONE || [])
        ];

        if (allNegativeKeywords.length > 0) {
            const detectedNegative = detectRestrictivePattern(fullContentLower, allNegativeKeywords, logger);
            logger.trace({ detectedNegative }, "Result of detectRestrictivePattern in _checkContent.");
            if (detectedNegative) {
                 const reason = `Content indicates Specific Restriction via keyword/pattern`;
                 logger.debug(reason);
                return { decision: 'REJECT', reason };
            }
        } else {
            logger.trace("No negative keywords configured to check in content.");
        }

        // Only proceed if we have content keywords in the config
        if (!config?.CONTENT_KEYWORDS) {
            logger.trace("No content keywords configured. Skipping positive LATAM/Global content checks.");
            return { decision: 'UNKNOWN' };
        }

        // 2. Check for STRONG_POSITIVE_LATAM keywords
        const latamKeywords = config.CONTENT_KEYWORDS?.STRONG_POSITIVE_LATAM || [];
        if (latamKeywords.length > 0) {
            const latamMatch = this._includesSubstringKeyword(fullContentLower, latamKeywords);
            if (latamMatch.match) {
                const reason = `Content indicates LATAM: "${latamMatch.keyword}"`;
                logger.trace({ keyword: latamMatch.keyword }, reason);
                const latamPattern = new RegExp(`\b(${latamKeywords.map(kw => kw.toLowerCase().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\b`, 'gi');
                let latamIdxMatch;
                const proximityWindow = 30;
                // Check context around LATAM match for negatives
                while((latamIdxMatch = latamPattern.exec(fullContentLower)) !== null){
                    // Only check context if the keyword matches the initial simple match
                    if (latamIdxMatch[1].toLowerCase() !== latamMatch.keyword?.toLowerCase()) continue;

                    const index = latamIdxMatch.index;
                    const matchedLatamKw = latamIdxMatch[1];
                    const start = Math.max(0, index - proximityWindow);
                    const end = Math.min(fullContentLower.length, index + matchedLatamKw.length + proximityWindow);
                    const context = fullContentLower.substring(start, end);
                    // Use all negative keywords for context check
                    if (allNegativeKeywords.length > 0) {
                        const negativeNearbyMatch = this._includesSubstringKeyword(context, allNegativeKeywords);
                        if(negativeNearbyMatch.match){
                            const rejectReason = `LATAM term '${matchedLatamKw}' negated by nearby '${negativeNearbyMatch.keyword}'.`;
                            logger.debug(rejectReason);
                            return { decision: 'REJECT', reason: rejectReason };
                        }
                    }
                }
                // If LATAM match found and no negative context found, accept LATAM
                return { decision: 'ACCEPT_LATAM', reason };
            }
        } else {
             logger.trace("No positive LATAM keywords configured.");
        }

        // 3. Check for STRONG_POSITIVE_GLOBAL keywords (Simplified Logic)
        const globalKeywords = config.CONTENT_KEYWORDS?.STRONG_POSITIVE_GLOBAL || [];
        if (globalKeywords.length > 0) {
            const globalMatchSimple = this._includesSubstringKeyword(fullContentLower, globalKeywords);
            logger.trace({ globalMatchSimple }, "Result of simple global keyword check in _checkContent.");
            if(globalMatchSimple.match){
                const reason = `Content indicates Global: "${globalMatchSimple.keyword}"`;
                logger.trace({ keyword: globalMatchSimple.keyword }, reason);

                // Perform context check ONLY to potentially REJECT, not to confirm acceptance
                const globalPattern = new RegExp(`\b(${globalKeywords.map(kw => kw.toLowerCase().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\b`, 'gi');
                let globalIdxMatch;
                const proximityWindow = 30;
                while((globalIdxMatch = globalPattern.exec(fullContentLower)) !== null){
                    const index = globalIdxMatch.index;
                    const matchedGlobalKw = globalIdxMatch[1];
                    // Only check context if the matched keyword is the one from the simple check
                    if (matchedGlobalKw.toLowerCase() !== globalMatchSimple.keyword?.toLowerCase()) continue;

                    const start = Math.max(0, index - proximityWindow);
                    const end = Math.min(fullContentLower.length, index + matchedGlobalKw.length + proximityWindow);
                    const context = fullContentLower.substring(start, end);
                    // Use all negative keywords for context check
                    if (allNegativeKeywords.length > 0) {
                        const negativeNearbyMatch = this._includesSubstringKeyword(context, allNegativeKeywords);
                        if(negativeNearbyMatch.match){
                            const rejectReason = `Global term '${matchedGlobalKw}' negated by nearby '${negativeNearbyMatch.keyword}'.`;
                            logger.debug(rejectReason);
                            // Found negative context, so reject this specific global keyword match
                            return { decision: 'REJECT', reason: rejectReason };
                        }
                    }
                }
                // If simple match found and no negative context found for that keyword, accept.
                logger.trace("Accepting based on simple global keyword match and lack of negative context.");
                return { decision: 'ACCEPT_GLOBAL', reason };
            }
        } else {
             logger.trace("No positive Global keywords configured.");
        }

        logger.trace("Content keyword analysis result: UNKNOWN");
        return { decision: 'UNKNOWN' };
    }

    private _isJobRelevant(job: AshbyApiJob, jobLogger: pino.Logger): FilterResult {
        jobLogger.trace("--- Starting Ashby Relevance Check ---");

        // 1. Basic checks
        if (job?.isListed === false) {
            return { relevant: false, reason: 'Job not listed', type: undefined };
        }
        // Skip jobs updated before a specific date if configured (useful for migrations)
        // Convert job.updatedAt (ISO string) and threshold to Date objects for comparison
        if (this.filterConfig?.PROCESS_JOBS_UPDATED_AFTER_DATE) {
            try {
                if (job.updatedAt) { // Check if job.updatedAt is defined
                    const jobUpdatedAt = new Date(job.updatedAt);
                    const thresholdDate = new Date(this.filterConfig.PROCESS_JOBS_UPDATED_AFTER_DATE);
                    if (jobUpdatedAt < thresholdDate) {
                         jobLogger.info({ jobId: job.id, updatedAt: job.updatedAt, threshold: this.filterConfig.PROCESS_JOBS_UPDATED_AFTER_DATE }, "Skipping job: updated before threshold date.");
                        return { relevant: false, reason: `Job updated before ${this.filterConfig.PROCESS_JOBS_UPDATED_AFTER_DATE}`, type: undefined };
                    }
                }
            } catch (dateError) {
                 jobLogger.error({ dateString: job.updatedAt, error: dateError }, "Error parsing job updatedAt date");
                 // Decide how to handle parse errors - potentially skip or proceed cautiously
                 // For now, proceed as if the check passed
            }
        }

        // Config check is now handled inside _checkLocation and _checkContent
        // We pass this.filterConfig (which might be null) to the helper functions.

        // 2. Location Check
        // Pass filterConfig, which could be null
        const locationCheck = this._checkLocation(job, this.filterConfig, jobLogger);
        jobLogger.debug({ decision: locationCheck.decision, reason: locationCheck.reason }, "Location Check Result");

        // --- Prioritize Location Decision ---
        if (locationCheck.decision === 'REJECT') {
            return { relevant: false, reason: locationCheck.reason || 'Location indicates Restriction' };
        }
        // If location gives a clear LATAM signal, accept immediately
        if (locationCheck.decision === 'ACCEPT_LATAM') {
             jobLogger.debug("Accepting based on strong LATAM signal from location.");
            return { relevant: true, reason: locationCheck.reason || 'Location(LATAM)', type: 'latam' };
        }

        // --- If Location is not decisive (UNKNOWN or ACCEPT_GLOBAL), check content ---
        // 3. Content Check
        // Pass filterConfig, which could be null
        const contentCheck = this._checkContent(job, this.filterConfig, jobLogger);
        jobLogger.debug({ decision: contentCheck.decision, reason: contentCheck.reason }, "Content Check Result");
        if (contentCheck.decision === 'REJECT') {
             // Content rejection overrides location UNKNOWN or ACCEPT_GLOBAL
            return { relevant: false, reason: contentCheck.reason || 'Content indicates Restriction' };
        }

        // --- Final Decision Logic (If neither location nor content rejected) ---

        // Prioritize Content LATAM signal if present and location wasn't ACCEPT_LATAM
         if (contentCheck.decision === 'ACCEPT_LATAM') {
            jobLogger.debug("Accepting based on strong LATAM signal from content.");
            return { relevant: true, reason: contentCheck.reason || 'Content(LATAM)', type: 'latam' };
        }

        // Check for GLOBAL signals (from either location or content)
        const isGlobalFromLocation = locationCheck.decision === 'ACCEPT_GLOBAL';
        const isGlobalFromContent = contentCheck.decision === 'ACCEPT_GLOBAL';

        // Handle explicit 'isRemote' flag
        if (job.isRemote === true) {
            jobLogger.debug("Job marked as remote and passed restriction checks.");
             let globalReason = 'Marked as remote';
            // Give preference to more specific GLOBAL reasons if found
            if (isGlobalFromLocation) globalReason = locationCheck.reason || 'Location(Global)';
            else if (isGlobalFromContent) globalReason = contentCheck.reason || 'Content(Global)';
            // If no config was loaded, the decisions would be UNKNOWN, use default reason
            else if (locationCheck.decision === 'UNKNOWN' && contentCheck.decision === 'UNKNOWN' && !this.filterConfig) {
                 globalReason = 'Marked as remote (no filter config)';
            }
            return { relevant: true, reason: globalReason, type: 'global' };
        }

        // If not explicitly remote, but location/content checks found a GLOBAL signal
        if (isGlobalFromLocation || isGlobalFromContent) {
            let globalReason = 'Unknown Global Signal';
             if (isGlobalFromLocation) globalReason = locationCheck.reason || 'Location(Global)';
             else if (isGlobalFromContent) globalReason = contentCheck.reason || 'Content(Global)';
             jobLogger.info({ finalReason: globalReason }, "Final Decision: ACCEPT_GLOBAL based on location/content signals (isRemote=false/null).");
             return { relevant: true, reason: globalReason, type: 'global' };
        }

        // --- Final Fallback ---
        // If we reached here:
        // - No REJECT decisions were made.
        // - No ACCEPT_LATAM decisions were made.
        // - No ACCEPT_GLOBAL decisions were made (either via config keywords or explicit isRemote flag).
        // - Checks might have returned UNKNOWN (e.g., no config, or ambiguous results).

        // If config was null and checks were UNKNOWN, the job is only relevant if isRemote was true (handled above).
        if (!this.filterConfig && locationCheck.decision === 'UNKNOWN' && contentCheck.decision === 'UNKNOWN') {
             jobLogger.debug("Final Decision: Job is not relevant (Not explicitly remote and no filter config loaded).");
             return { relevant: false, reason: 'Not remote (no filter config)', type: undefined };
        }

        // If config *was* loaded, but we still ended up here, it means the job is ambiguous or doesn't meet criteria.
        jobLogger.debug("Final Decision: Job is not relevant (Ambiguous or No Positive Signal).");
        return { relevant: false, reason: 'Ambiguous or No Positive Signal', type: undefined };
    }
} 