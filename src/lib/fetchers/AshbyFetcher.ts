import axios, { AxiosError } from 'axios';
import { PrismaClient, JobSource, JobStatus, JobType, ExperienceLevel } from '@prisma/client';
import pMap from 'p-map';
import pino from 'pino';
import { JobProcessingAdapter } from '../adapters/JobProcessingAdapter';
import { getAshbyConfig, FilterConfig as GreenhouseFilterConfig } from '../../types/JobSource';
import { 
    JobFetcher, SourceStats, FetcherResult, 
    AshbyApiJob, AshbyLocation, FilterResult, 
    AshbyPositiveFilterConfig, NegativeFilterConfig 
} from './types';
import sanitizeHtml from 'sanitize-html';
import { decode } from 'html-entities';
import * as fs from 'fs';
import * as path from 'path';
import { detectJobType, detectExperienceLevel } from '../utils/jobUtils';
import { detectRestrictivePattern } from '../utils/filterUtils';


// Global logger instance (assuming pino is configured elsewhere or use a default)
const baseLogger = pino({
  // Use basic pino config for tests, avoid pino-pretty issues
  // transport: {
  //   target: 'pino-pretty',
  //   options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' }
  // },
  level: process.env.NODE_ENV === 'test' ? 'silent' : process.env.LOG_LEVEL || 'info',
});

export class AshbyFetcher implements JobFetcher {
    private prisma: PrismaClient;
    private jobProcessor: JobProcessingAdapter;
    private ashbyPositiveConfig: AshbyPositiveFilterConfig | null = null;
    private negativeConfig: NegativeFilterConfig | null = null;

    constructor(prismaClient: PrismaClient, jobProcessingAdapter: JobProcessingAdapter) {
        this.prisma = prismaClient;
        this.jobProcessor = jobProcessingAdapter;
        this._loadFilterConfigs();
    }

    private _loadFilterConfigs(): void {
        const logger = baseLogger.child({ service: 'AshbyFetcherConfigLoader' });
        try {
            const baseConfigPath = path.resolve(__dirname, '../../config'); // Base config directory

            // Load Greenhouse config to extract ALL necessary parts
            const greenhouseConfigPath = path.join(baseConfigPath, 'greenhouse-filter-config.json');
             if (fs.existsSync(greenhouseConfigPath)) {
                const greenhouseConfigFile = fs.readFileSync(greenhouseConfigPath, 'utf-8');
                const greenhouseConfig = JSON.parse(greenhouseConfigFile) as GreenhouseFilterConfig;

                // Extract relevant keywords for Ashby positive config
                this.ashbyPositiveConfig = {
                    remoteKeywords: greenhouseConfig.LOCATION_KEYWORDS?.STRONG_POSITIVE_GLOBAL || [],
                    latamKeywords: greenhouseConfig.LOCATION_KEYWORDS?.STRONG_POSITIVE_LATAM || [],
                    brazilKeywords: greenhouseConfig.LOCATION_KEYWORDS?.ACCEPT_EXACT_LATAM_COUNTRIES || [],
                    // Add content keywords
                    contentLatamKeywords: greenhouseConfig.CONTENT_KEYWORDS?.STRONG_POSITIVE_LATAM || [],
                    contentGlobalKeywords: greenhouseConfig.CONTENT_KEYWORDS?.STRONG_POSITIVE_GLOBAL || [],
                };
                 logger.info({ path: greenhouseConfigPath }, `Successfully derived Ashby positive filter config from Greenhouse config`);

                 // Extract relevant keywords for Negative config (reusing Greenhouse lists)
                 // Combine location and content negative keywords for a comprehensive list
                 const locationNegative = greenhouseConfig.LOCATION_KEYWORDS?.STRONG_NEGATIVE_RESTRICTION || [];
                 const contentNegativeRegion = greenhouseConfig.CONTENT_KEYWORDS?.STRONG_NEGATIVE_REGION || [];
                 const contentNegativeTimezone = greenhouseConfig.CONTENT_KEYWORDS?.STRONG_NEGATIVE_TIMEZONE || [];
                 // Combine and deduplicate all negative keywords
                 this.negativeConfig = {
                    keywords: [...new Set([...locationNegative, ...contentNegativeRegion, ...contentNegativeTimezone])]
                 };
                 logger.info({ count: this.negativeConfig.keywords.length }, `Successfully derived Ashby negative filter config from Greenhouse config`);

             } else {
                 logger.error({ path: greenhouseConfigPath }, `❌ Greenhouse filter configuration file not found. Cannot derive Ashby configs.`);
                 // Handle error appropriately, maybe set configs to null or throw
                 this.ashbyPositiveConfig = null;
                 this.negativeConfig = null;
             }

        } catch (error: any) {
            logger.error({ err: error }, `❌ Failed to load or parse filter configurations.`);
            this.ashbyPositiveConfig = null;
            this.negativeConfig = null;
        }
    }

    // --- Filtering Helper Functions --- (Keep these as before)
    private _stripHtml(html: string | undefined | null): string {
        // ... (implementation remains the same using sanitizeHtml)
        if (!html) return '';
        try {
            const sanitized = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
            return decode(sanitized).replace(/\s+/g, ' ').trim();
        } catch (e) { baseLogger.warn({ error: e }, "Error stripping HTML."); return ''; }
    }
    private _includesSubstringKeyword(text: string | undefined | null, keywords: string[] | undefined): { match: boolean, keyword: string | undefined } {
         // ... (implementation remains the same)
         if (!text || !keywords || keywords.length === 0) return { match: false, keyword: undefined };
         const lowerText = text.toLowerCase();
         const foundKeyword = keywords.find(keyword => lowerText.includes(keyword.toLowerCase()));
         return { match: !!foundKeyword, keyword: foundKeyword };
    }
    private _matchesKeywordRegex(text: string | undefined | null, keywords: string[] | undefined): { match: boolean, keyword: string | undefined } {
         // ... (implementation remains the same)
         if (!text || !keywords || keywords.length === 0) return { match: false, keyword: undefined };
         const lowerText = text.toLowerCase();
         try {
             const pattern = new RegExp(`\\b(${keywords.map(kw => kw.toLowerCase().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b`, 'i');
             const match = pattern.exec(lowerText);
             return { match: !!match, keyword: match ? match[1] : undefined };
         } catch (e) { baseLogger.error({ error: e, keywordsUsed: keywords.slice(0, 10) }, "Error compiling/executing keyword regex"); return { match: false, keyword: undefined }; }
    }
    private _processJobContent(job: AshbyApiJob): string {
         // ... (implementation remains the same)
         const title = job.title || '';
         let description = job.descriptionPlain || this._stripHtml(job.descriptionHtml) || '';
         const fullText = `${title.toLowerCase()}\n${description.toLowerCase()}`;
         return fullText.replace(/\s+/g, ' ').trim();
    }
    // --- End Helper Functions ---

    /** Determines if a job is relevant based on loaded configs and job data */
    private _isJobRelevant(
        job: AshbyApiJob,
        positiveConfig: AshbyPositiveFilterConfig | null,
        negativeConfig: NegativeFilterConfig | null,
        logger: pino.Logger
    ): FilterResult {
        const jobLogger = logger.child({ fn: '_isJobRelevant' });

        if (!positiveConfig || !negativeConfig) {
            jobLogger.warn("Filter configurations not loaded.");
            return { relevant: false, reason: "Missing filter configurations" };
        }

        // --- Step 0: Check isRemote --- 
        let isExplicitlyRemote = job.isRemote === true;
        if (job.isRemote === false) {
            jobLogger.debug("Rejecting: isRemote flag is explicitly false.");
            return { relevant: false, reason: "Marked as non-remote in ATS (isRemote: false)" };
        }

        // --- Step 1 & 2: Location/Title Analysis --- 
        const titleLower = job.title?.toLowerCase() || '';
        const allLocationNames: string[] = [];
        const allCountryCodes: string[] = [];
        const allCountries: string[] = [];
        const latamCountryCodes = ['br', 'ar', 'cl', 'co', 'mx', 'pe', 'uy', 'ec', 'bo', 'py', 've'];

        const combinedLocations = [...(job.locations || []), ...(job.secondaryLocations || [])];
        combinedLocations.forEach(loc => {
            if (!loc) return;
            const name = loc.name?.toLowerCase();
            const countryCode = loc.address?.countryCode?.toLowerCase();
            const country = loc.address?.country?.toLowerCase();
            const city = loc.address?.city?.toLowerCase();
            const state = loc.address?.state?.toLowerCase();
            const rawAddress = loc.address?.rawAddress?.toLowerCase();
            if (name) allLocationNames.push(name);
            if (countryCode) allCountryCodes.push(countryCode);
            if (country) allCountries.push(country);
            if (city) allLocationNames.push(city);
            if (state) allLocationNames.push(state);
            if (rawAddress) allLocationNames.push(rawAddress);
        });

        const uniqueLocationIdentifiers = [...new Set([...allLocationNames, ...allCountries, ...allCountryCodes, titleLower])].filter(Boolean);
        jobLogger.debug({ uniqueLocationIdentifiers }, "DEBUG: Final unique location identifiers BEFORE analysis.");

        const negativeKeywords = negativeConfig.keywords;
        const latamPositiveKeywords = [...positiveConfig.latamKeywords, ...positiveConfig.brazilKeywords];
        const globalPositiveKeywords = positiveConfig.remoteKeywords;
        const proximityWindow = 30;

        let hasLatamLocationSignal = false;
        let hasAmericasLocationSignal = false;
        let hasGlobalLocationSignal = false;
        let hasNegativeLocationSignal = false;
        let negativeLocationKeyword: string | undefined = undefined;

        const hasNearbyNegative = (text: string, index: number, keyword: string): { match: boolean, negativeKeyword: string | undefined } => {
            const start = Math.max(0, index - proximityWindow);
            const end = Math.min(text.length, index + keyword.length + proximityWindow);
            const context = text.substring(start, end);
            jobLogger.trace({ text, index, keyword, proximityWindow, context }, "DEBUG: Checking context for nearby negative");
            const negativeMatchFn = this._matchesKeywordRegex(context, negativeKeywords);
            if (negativeMatchFn.match && negativeMatchFn.keyword !== 'americas') {
                jobLogger.trace({ context, keyword, negativeKeyword: negativeMatchFn.keyword }, "DEBUG: Found negative keyword near ambiguous term.");
                return { match: true, negativeKeyword: negativeMatchFn.keyword };
            }
            jobLogger.trace({ context, keyword }, "DEBUG: No relevant negative keyword found nearby.");
            return { match: false, negativeKeyword: undefined };
        };

        // Analyze ALL identifiers first
        for (const identifier of uniqueLocationIdentifiers) {
            // Check Negative FIRST 
            const negativeMatch = this._matchesKeywordRegex(identifier, negativeKeywords);
            if (negativeMatch.match && negativeMatch.keyword !== 'americas') {
                if (!hasNegativeLocationSignal) {
                    hasNegativeLocationSignal = true;
                    negativeLocationKeyword = negativeMatch.keyword;
                    jobLogger.trace({ identifier, keyword: negativeMatch.keyword }, "Found Negative signal in identifier.");
                }
            }

            // Check LATAM 
            if (latamCountryCodes.includes(identifier) || this._includesSubstringKeyword(identifier, latamPositiveKeywords).match) {
                hasLatamLocationSignal = true;
                jobLogger.trace({ identifier }, "Found LATAM signal in identifier.");
            }

            // Check Americas
            if (identifier.includes('americas')) {
                hasAmericasLocationSignal = true;
                jobLogger.trace({ identifier }, "Found Americas signal in identifier.");
            }

            // Check Global Keywords WITH Context Check 
            let foundCleanGlobalInThisIdentifier = false;
            if (globalPositiveKeywords && globalPositiveKeywords.length > 0) { // Check if keywords exist
                const globalPattern = new RegExp(`\\b(${globalPositiveKeywords.map(kw => kw.toLowerCase().replace(/[-\/\\^$*+?.()|[\\]{}]/g, '\\$&')).join('|')})\\b`, 'gi');
                // Use matchAll for safer iteration
                for (const match of identifier.matchAll(globalPattern)) {
                    if (match && match[1] !== undefined && match.index !== undefined) {
                        const globalKeyword = match[1];
                        const index = match.index;
                        jobLogger.trace({ identifier, globalKeyword, index }, "DEBUG: Checking global keyword in identifier");
                        const nearbyNegative = hasNearbyNegative(identifier, index, globalKeyword);
                        if (nearbyNegative.match) {
                            jobLogger.trace({ identifier, keyword: globalKeyword, negativeKeyword: nearbyNegative.negativeKeyword }, `Ambiguous global term '${globalKeyword}' in identifier ignored due to nearby negative '${nearbyNegative.negativeKeyword}'.`);
                            // Immediately mark as negative if not already marked
                            if (!hasNegativeLocationSignal) {
                                hasNegativeLocationSignal = true;
                                negativeLocationKeyword = nearbyNegative.negativeKeyword;
                                jobLogger.trace({ identifier, keyword: nearbyNegative.negativeKeyword }, "DEBUG: Marking hasNegativeLocationSignal=true due to identifier context check.");
                            }
                            // This specific global keyword instance is tainted, reset flag
                            foundCleanGlobalInThisIdentifier = false;
                            break; // Stop checking this identifier if a tainted global word is found
                        } else {
                            jobLogger.trace({ identifier, globalKeyword }, "DEBUG: Found clean global keyword instance in identifier.");
                            foundCleanGlobalInThisIdentifier = true; // Mark as clean *for now*
                        }
                    } else {
                        // Handle cases where match structure is unexpected (shouldn't happen with correct regex)
                        jobLogger.warn({ match }, "Unexpected match structure from globalPattern.matchAll");
                    }
                }
            }
            // Aggregate the global signal only if a clean one was found in this identifier *after checking all matches*
            if (foundCleanGlobalInThisIdentifier) {
                 hasGlobalLocationSignal = true; 
                 jobLogger.trace({ identifier }, "Found potential Global signal in identifier.");
            }
        }

        // **NEW**: Check combined identifiers for explicit restrictive patterns
        const combinedIdentifierText = uniqueLocationIdentifiers.join(' ; ');
        if (detectRestrictivePattern(combinedIdentifierText, negativeKeywords, jobLogger)) {
             jobLogger.debug({ identifiers: combinedIdentifierText }, "Rejecting: Explicit restrictive pattern or keyword found in combined location/title identifiers.");
             return { relevant: false, reason: `Location/Title Restriction Pattern/Keyword Detected` };
        }

        // TEMPORARY DEBUG LOG before decision logic
        jobLogger.trace({ hasLatamLocationSignal, hasNegativeLocationSignal, negativeLocationKeyword, hasAmericasLocationSignal, hasGlobalLocationSignal }, "DEBUG: Signals before Location Decision Logic");

        // --- Step 3: Location Decision Logic (Prioritized) ---
        if (hasLatamLocationSignal) {
            // LATAM has highest priority from location/title analysis.
            jobLogger.info("Accepting LATAM (Priority 1): Explicit LATAM signal found in location/title.");
            return { relevant: true, reason: "Location/Title(LATAM Signal)", type: 'latam' };
            // Note: We are ignoring hasNegativeLocationSignal here because LATAM is primary.
            // A strong negative in CONTENT will still reject later if necessary.
        }
        
        // If no LATAM signal, THEN check for negative signal.
        if (hasNegativeLocationSignal) {
             jobLogger.trace({ keyword: negativeLocationKeyword }, "DEBUG: Applying Negative signal from location/title.");
             jobLogger.debug({ keyword: negativeLocationKeyword }, "Rejecting: Negative signal found in location/title (and no LATAM signal).");
             return { relevant: false, reason: `Location/Title Restriction: ${negativeLocationKeyword}` };
        }
        
        // If no LATAM or Negative, check for Americas (as a type of LATAM/allowed).
        if (hasAmericasLocationSignal) {
             jobLogger.info("Accepting LATAM (Priority 2): Americas signal found in location/title.");
            return { relevant: true, reason: "Location/Title(Americas Signal)", type: 'latam' };
        }
        
        // If none of the above, determine if there was a potential global signal or if it's unknown.
        let locationDecision: 'global' | 'unknown' = 'unknown';
        if (hasGlobalLocationSignal) {
             jobLogger.trace("Location signal is potentially Global. Proceeding to content check.");
             locationDecision = 'global';
        } else {
             jobLogger.trace("No definitive location/title signal. Proceeding to content check.");
        }

        // --- Step 4: Content Check & Final Decision ---
        const jobContentText = this._processJobContent(job);
        jobLogger.trace({ jobContentTextPreview: jobContentText.substring(0, 500) + '...' }, 'Content text being analyzed');

         // **NEW**: Check content for explicit restrictive patterns first
         if (detectRestrictivePattern(jobContentText, negativeKeywords, jobLogger)) {
             jobLogger.debug("Rejecting: Explicit restrictive pattern or keyword found in job content.");
             return { relevant: false, reason: `Content Restriction Pattern/Keyword Detected` };
         }

         // Refactored Content Logic Order:
         
         // 1. Check Positive LATAM Keywords in Content
         // Use the correct content keywords list
         const contentMatchLatam = this._includesSubstringKeyword(jobContentText, positiveConfig.contentLatamKeywords);
         if (contentMatchLatam.match) {
              jobLogger.info({ keyword: contentMatchLatam.keyword }, "Accepting LATAM based on content keyword.");
             return { relevant: true, reason: `Content(LATAM: ${contentMatchLatam.keyword})`, type: 'latam' };
         }

        // 2. Check Positive Global Keywords in Content WITH Context Check
        let confirmedGlobalInContent = false; // Initialize here
        let rejectedDueToContext = false; // Added flag
        // Only run if there are keywords to check
        if (positiveConfig.contentGlobalKeywords && positiveConfig.contentGlobalKeywords.length > 0) {
            const globalContentPattern = new RegExp(`\\b(${positiveConfig.contentGlobalKeywords.map(kw => kw.toLowerCase().replace(/[-\/\\^$*+?.()|[\\]{}]/g, '\\$&')).join('|')})\\b`, 'gi');
            // Use matchAll for safer iteration
            for (const contentMatch of jobContentText.matchAll(globalContentPattern)) {
                if (contentMatch && contentMatch[1] !== undefined && contentMatch.index !== undefined) {
                     const globalKeyword = contentMatch[1];
                     const index = contentMatch.index;
                     jobLogger.trace({ jobContentTextPreview: jobContentText.substring(Math.max(0, index-10), index+globalKeyword.length+10), globalKeyword, index }, "DEBUG: Checking global keyword in content");
                     const nearbyNegative = hasNearbyNegative(jobContentText, index, globalKeyword);
                     if (nearbyNegative.match) {
                         jobLogger.debug({ keyword: globalKeyword, negativeKeyword: nearbyNegative.negativeKeyword }, `Positive global term '${globalKeyword}' in content ignored due to nearby negative '${nearbyNegative.negativeKeyword}'.`);
                         // REJECT immediately if a global term has negative context
                         jobLogger.debug({ keyword: nearbyNegative.negativeKeyword }, `Rejecting: Global term in content negated by nearby restriction.`);
                         // Set flag before returning
                         rejectedDueToContext = true;
                         // Ensure the reason includes (context) for this specific scenario
                         return { relevant: false, reason: `Content Restriction (context): ${nearbyNegative.negativeKeyword}` };
                     }
                     // If we reach here for any match without a nearby negative, it's a potentially clean global signal
                     confirmedGlobalInContent = true;
                } else {
                     // Handle cases where match structure is unexpected
                     jobLogger.warn({ contentMatch }, "Unexpected match structure from globalContentPattern.matchAll");
                }
            }
        }

        // 3. If a clean positive Global keyword was found in content (and context check didn't reject)
        if (confirmedGlobalInContent) {
            jobLogger.info("Accepting Global based on clean content keyword.");
            return { relevant: true, reason: `Content(Global Signal)`, type: 'global' };
        }

        // 4. ONLY if no positive signals were found AND not already rejected for context, check for general negative keywords in content
        if (!rejectedDueToContext) { // Check the flag
            const contentMatchNegative = this._matchesKeywordRegex(jobContentText, negativeKeywords);
            if (contentMatchNegative.match && contentMatchNegative.keyword !== 'americas') {
                jobLogger.debug({ keyword: contentMatchNegative.keyword }, `Content indicates Restriction: "${contentMatchNegative.keyword}"`);
                return { relevant: false, reason: `Content Restriction: ${contentMatchNegative.keyword}` };
            }
        }

        // --- Step 5: Final Fallback Decision --- 
        
        // If Location analysis determined Global AND content didn't reject/accept
        if (locationDecision === 'global') {
             jobLogger.info("Accepting Global (Fallback 1): Location/Title was Global, content had no strong signals/rejections.");
             return { relevant: true, reason: "Location/Title(Global Signal) - Content Neutral", type: 'global' };
        }
        
        // Fallback: If isRemote was true initially, and no other signal caused acceptance/rejection
        if (isExplicitlyRemote) {
            jobLogger.info("Accepting Global (Fallback 2): isRemote=true and no other signals determined relevance.");
            return { relevant: true, reason: "isRemote=true Fallback", type: 'global' };
        }

        // Default rejection if no positive signal was ever found
        jobLogger.debug("Rejecting: No positive remote signals found in location, title, or content.");
        return { relevant: false, reason: "Ambiguous or No Remote Signal" };
    }


    // --- Main Fetcher Method ---
    async processSource(source: JobSource, parentLogger: pino.Logger): Promise<FetcherResult> {
        const startTime = Date.now(); // Record start time
        let errorMessage: string | undefined = undefined;

        const sourceLogger = parentLogger.child({ fetcher: 'Ashby', sourceName: source.name, sourceId: source.id });
        const stats: SourceStats = { found: 0, relevant: 0, processed: 0, deactivated: 0, errors: 0 };
        const foundSourceIds = new Set<string>();
        let jobBoardName: string | null = null;
        let apiUrl: string | null = null;

        try {
            // Ensure configs are loaded
            if (!this.ashbyPositiveConfig || !this.negativeConfig) {
                errorMessage = "Filter configurations not loaded. Cannot process source.";
                sourceLogger.error(errorMessage);
                stats.errors++;
                const durationMs = Date.now() - startTime;
                return { stats, foundSourceIds, durationMs, errorMessage };
            }
            
            // --- Load Configuration from source.config ---
            sourceLogger.trace('Loading Ashby configuration from source...');
            const ashbyConfig = getAshbyConfig(source.config);
            if (!ashbyConfig || !ashbyConfig.jobBoardName) {
                errorMessage = 'Missing or invalid jobBoardName in source config';
                sourceLogger.error('❌ ' + errorMessage);
                stats.errors++;
                const durationMs = Date.now() - startTime;
                return { stats, foundSourceIds, durationMs, errorMessage };
            }
            jobBoardName = String(ashbyConfig.jobBoardName);
            // Construct the API URL (ensure leading/trailing slashes are handled)
            apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${jobBoardName.trim().replace(/^\/+|\/$/g, '')}`;
            sourceLogger.info({ jobBoardName }, `-> Starting processing...`);

            // --- Fetch Jobs ---
            sourceLogger.trace({ apiUrl }, 'Fetching jobs from Ashby API...');
            const response = await axios.get(apiUrl, { timeout: 45000 });

            if (!response.data || !Array.isArray(response.data.results)) {
                errorMessage = 'Invalid response structure from Ashby API (expected data.results array)';
                sourceLogger.error({ responseStatus: response.status, responseDataPreview: JSON.stringify(response.data)?.substring(0, 200) + '...' }, '❌ ' + errorMessage);
                stats.errors++;
                const durationMs = Date.now() - startTime;
                return { stats, foundSourceIds, durationMs, errorMessage };
            }

            const apiJobs: AshbyApiJob[] = response.data.results;
            stats.found = apiJobs.length;
            // Use jobUrl or id as the sourceId
            apiJobs.forEach(job => foundSourceIds.add(job.jobUrl || job.id));
            sourceLogger.info(`+ ${stats.found} jobs found in API response.`);

            if (apiJobs.length === 0) {
                 sourceLogger.info('No jobs found for this source.');
                 const durationMs = Date.now() - startTime;
                 return { stats, foundSourceIds, durationMs, errorMessage }; // errorMessage is undefined
            }
             sourceLogger.trace({ sampleJobId: apiJobs[0]?.id, sampleJobTitle: apiJobs[0]?.title }, 'Sample job structure check');

            // --- Process Jobs ---
            sourceLogger.trace(`Processing ${apiJobs.length} jobs for relevance...`);
            let firstJobProcessingError: string | undefined = undefined;
            
            await pMap(apiJobs, async (job) => {
                 const jobLogger = sourceLogger.child({ jobId: job.jobUrl || job.id, jobTitle: job.title });
                try {
                    // Determine hiring region type *before* calling processRawJob
                    const relevanceResult = this._isJobRelevant(job, this.ashbyPositiveConfig, this.negativeConfig, jobLogger);
                    
                    if (relevanceResult.relevant) {
                        stats.relevant++;
                        jobLogger.trace(
                            { reason: relevanceResult.reason, type: relevanceResult.type },
                            `➡️ Relevant job found`
                        );

                        // Add the determined type to the job object for the processor
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
                    { status: axiosError.response?.status, code: axiosError.code, message: axiosError.message, url: apiUrl },
                    `❌ Axios error fetching jobs for source`
                );
                 errorMessage = `Axios error (${axiosError.code || 'N/A'}): ${axiosError.message}`;
            } else {
                 const genericError = error as Error;
                 sourceLogger.error({ 
                     error: { message: genericError.message, name: genericError.name, stack: genericError.stack?.split('\n').slice(0, 5).join('\n') }, 
                     jobBoardName, 
                     apiUrl 
                 }, '❌ General error processing source');
                  errorMessage = `General error: ${genericError.message}`;
            }
        }

         const durationMs = Date.now() - startTime; // Calculate final duration
         sourceLogger.info({ durationMs, stats }, 'Fetcher finished execution.');
         return { stats, foundSourceIds, durationMs, errorMessage }; // Return updated result object
    }
}