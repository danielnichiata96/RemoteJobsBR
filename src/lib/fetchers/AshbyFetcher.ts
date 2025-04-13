import axios, { AxiosError } from 'axios';
import { PrismaClient, JobSource, HiringRegion } from '@prisma/client';
import pMap from 'p-map';
import pino from 'pino';
import { JobProcessingAdapter } from '../adapters/JobProcessingAdapter';
import { getAshbyConfig } from '../../types/JobSource';
import { JobFetcher, SourceStats, FetcherResult } from './types';
import sanitizeHtml from 'sanitize-html';
import { decode } from 'html-entities';
import * as fs from 'fs';
import * as path from 'path';
import { FilterConfig as GreenhouseFilterConfig } from '../../types/JobSource'; // For negative keywords

// --- Interfaces ---

// Define a interface que representa o formato dos jobs retornados pela API Ashby
// Based on: https://api.ashbyhq.com/posting-api-schema#JobPosting
interface AshbyApiJob {
    id: string; // The internal ID of the Job Posting
    title: string;
    // Deprecated: Prefer locations field
    // location?: string; 
    locations: AshbyLocation[]; // NEW: Use this array
    department?: { id: string; name: string; } | null;
    team?: { id: string; name: string; } | null;
    isRemote: boolean; // If true, candidates can work remotely for this job.
    descriptionHtml?: string | null;
    descriptionPlain?: string | null;
    publishedAt: string; // ISO DateTime string when listed
    updatedAt: string; // ISO DateTime string of last update
    employmentType?: "FullTime" | "PartTime" | "Intern" | "Contract" | "Temporary" | null;
    compensationTier?: { id: string; name: string; } | null;
    compensationRange?: string | null; // Example: "$100,000 - $150,000"
    isListed: boolean; // If false, this JobPosting should not be displayed.
    jobUrl: string; // The URL to the Job Posting page on the Ashby Job Board.
    applyUrl: string; // The URL to the application form for the Job Posting.
    // Potentially useful fields not strictly needed for filtering/mapping yet:
    // customFields?: Record<string, any>[];
    // isArchived: boolean;
    // openingIds?: string[];
}

// Based on: https://api.ashbyhq.com/posting-api-schema#Location
interface AshbyLocation {
  id: string;
  name: string; // Example: "San Francisco", "Remote", "Remote - United States"
  type: 'country' | 'administrativeAreaLevel1' | 'administrativeAreaLevel2' | 'locality' | 'sublocality' | 'neighborhood' | 'postalCode' | 'pointOfInterest' | 'route' | 'streetAddress' | 'premise' | 'subpremise' | 'naturalFeature' | 'airport' | 'park' | 'transitStation' | 'intersection' | 'floor' | 'room' | 'other';
  address?: {
    rawAddress: string | null;
    streetAddress1: string | null;
    streetAddress2: string | null;
    city: string | null;
    state: string | null; // Administrative area level 1
    postalCode: string | null;
    country: string | null; // Example: "United States", "Brazil"
    countryCode: string | null; // Example: "US", "BR"
  } | null;
  isRemote: boolean;
}


// Define a interface para a resposta da API Ashby
interface AshbyApiResponse {
    jobs: AshbyApiJob[]; // CORRECTED: The API uses "jobs" field
    // Potentially has pagination fields if API supports it
}

// Interface for the result of the relevance filtering
interface FilterResult {
    relevant: boolean;
    reason: string;
    type?: 'global' | 'latam'; // The determined hiring region type
}

// Specific filter config for Ashby positive keywords
interface AshbyPositiveFilterConfig {
    remoteKeywords: string[];
    latamKeywords: string[];
    brazilKeywords: string[];
}

// Combined negative keywords (from Greenhouse config)
interface NegativeFilterConfig {
    keywords: string[];
}

// Global logger instance
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    }
  },
  level: process.env.LOG_LEVEL || 'info', // Use environment variable or default to 'info'
});

/**
 * Fetcher implementation for Ashby job board API.
 * API docs: https://app.ashbyhq.com/docs/api/job-board-api
 * Uses the official posting-api endpoint.
 */
export class AshbyFetcher implements JobFetcher {
    private prisma: PrismaClient;
    private jobProcessor: JobProcessingAdapter;
    private ashbyPositiveConfig: AshbyPositiveFilterConfig | null = null;
    private negativeConfig: NegativeFilterConfig | null = null;

    constructor(prismaClient: PrismaClient, jobProcessingAdapter: JobProcessingAdapter) {
        this.prisma = prismaClient;
        this.jobProcessor = jobProcessingAdapter;
        this._loadFilterConfigs(); // Load configs on instantiation
    }

    // --- Configuration Loading ---
    private _loadFilterConfigs(): void {
        try {
            const positiveConfigPath = path.resolve(__dirname, '../../config/ashby-filter-config.json');
            const positiveConfigFile = fs.readFileSync(positiveConfigPath, 'utf-8');
            this.ashbyPositiveConfig = JSON.parse(positiveConfigFile) as AshbyPositiveFilterConfig;
            logger.info({ configPath: positiveConfigPath }, `Successfully loaded Ashby positive filter configuration`);
        } catch (error: any) {
            logger.error({ err: error, configPath: path.resolve(__dirname, '../../config/ashby-filter-config.json') }, `❌ Failed to load or parse Ashby positive filter configuration.`);
            this.ashbyPositiveConfig = null; // Ensure it's null if loading fails
        }

        try {
            const greenhouseConfigPath = path.resolve(__dirname, '../../config/greenhouse-filter-config.json');
            const greenhouseConfigFile = fs.readFileSync(greenhouseConfigPath, 'utf-8');
            const greenhouseConfig = JSON.parse(greenhouseConfigFile) as GreenhouseFilterConfig;

            // Combine negative keywords from Greenhouse config
            const combinedNegative = [
                ...(greenhouseConfig.LOCATION_KEYWORDS?.STRONG_NEGATIVE_RESTRICTION || []),
                ...(greenhouseConfig.CONTENT_KEYWORDS?.STRONG_NEGATIVE_REGION || [])
            ];
            this.negativeConfig = { keywords: [...new Set(combinedNegative.map(k => k.toLowerCase()))] }; // Deduplicate and lower-case
            logger.info({ configPath: greenhouseConfigPath, count: this.negativeConfig.keywords.length }, `Successfully loaded and combined negative filter keywords from Greenhouse config`);

        } catch (error: any) {
            logger.error({ err: error, configPath: path.resolve(__dirname, '../../config/greenhouse-filter-config.json') }, `❌ Failed to load or parse Greenhouse filter configuration for negative keywords.`);
            this.negativeConfig = null; // Ensure it's null if loading fails
        }
    }

    // --- Filtering Helper Functions ---

    private _stripHtml(html: string | undefined | null): string {
        if (!html) return '';
        try {
            // Use sanitize-html for safety and basic tag removal
            const sanitized = sanitizeHtml(html, {
                allowedTags: [], // Remove all tags
                allowedAttributes: {}, // Remove all attributes
            });
            // Decode entities and normalize whitespace
            return decode(sanitized)
                .replace(/\s+/g, ' ')
                .trim();
        } catch (e) {
             logger.warn({ error: e }, "Error stripping HTML, returning empty string.");
             return '';
        }
    }

    private _includesSubstringKeyword(text: string | undefined | null, keywords: string[] | undefined): { match: boolean, keyword: string | undefined } {
        if (!text || !keywords || keywords.length === 0) return { match: false, keyword: undefined };
        const lowerText = text.toLowerCase();
        const foundKeyword = keywords.find(keyword => lowerText.includes(keyword.toLowerCase()));
        return { match: !!foundKeyword, keyword: foundKeyword };
    }

    private _matchesKeywordRegex(text: string | undefined | null, keywords: string[] | undefined): { match: boolean, keyword: string | undefined } {
        if (!text || !keywords || keywords.length === 0) return { match: false, keyword: undefined };
        const lowerText = text.toLowerCase();
        try {
            // Escape special regex characters in keywords and join with '|'
            // Use word boundaries (\b) to match whole words
            const pattern = new RegExp(`\\b(${keywords.map(kw =>
                kw.toLowerCase().replace(/[-\\/\\^$*+?.()|[\\]{}]/g, '\\$&') // Escape regex chars
            ).join('|')})\\b`, 'i');
            const match = pattern.exec(lowerText);
            return { match: !!match, keyword: match ? match[1] : undefined }; // Return the matched keyword part
        } catch (e) {
            logger.error({ error: e, keywordsUsed: keywords.slice(0, 10) }, "Error compiling or executing keyword regex");
            return { match: false, keyword: undefined };
        }
    }

    private _processJobContent(job: AshbyApiJob): string {
        const title = job.title || '';
        let description = '';

        if (job.descriptionPlain) {
            description = job.descriptionPlain;
        } else if (job.descriptionHtml) {
            description = this._stripHtml(job.descriptionHtml);
        }

        // Combine and normalize
        const fullText = `${title.toLowerCase()}\n${description.toLowerCase()}`;
        return fullText.replace(/\s+/g, ' ').trim();
    }

    // --- Main Filtering Logic (_isJobRelevant) ---
    /** Determines if a job is relevant based on loaded configs and job data */
    private _isJobRelevant(
        job: AshbyApiJob,
        positiveConfig: AshbyPositiveFilterConfig | null,
        negativeConfig: NegativeFilterConfig | null,
        logger: pino.Logger
    ): FilterResult {
        const jobLogger = logger.child({ fn: '_isJobRelevant' }); // Add function name to logger context

        // --- Pre-checks ---
        if (!positiveConfig || !negativeConfig) {
            jobLogger.warn("Filter configurations not loaded. Cannot determine relevance.");
            return { relevant: false, reason: "Missing filter configurations" };
        }
        jobLogger.trace({ isRemote: job.isRemote }, "Initial check: isRemote flag.");
        if (job.isRemote !== true) {
            jobLogger.debug("Rejecting: isRemote flag is not true.");
            return { relevant: false, reason: "Not marked as remote in ATS" };
        }

        // --- Data Extraction ---
        const titleLower = job.title?.toLowerCase() || '';
        const allLocationNames: string[] = [];
        const allCountryCodes: string[] = [];
        const allCountries: string[] = [];
        const latamCountryCodes = ['br', 'ar', 'cl', 'co', 'mx', 'pe', 'uy', 'ec', 'bo', 'py', 've', /* Add more common LATAM codes */ ];

        job.locations?.forEach(loc => {
            if (loc.name) allLocationNames.push(loc.name.toLowerCase());
            if (loc.address?.countryCode) allCountryCodes.push(loc.address.countryCode.toLowerCase());
            if (loc.address?.country) allCountries.push(loc.address.country.toLowerCase());
            if (loc.address?.city) allLocationNames.push(loc.address.city.toLowerCase());
            if (loc.address?.state) allLocationNames.push(loc.address.state.toLowerCase());
             if (loc.address?.rawAddress) allLocationNames.push(loc.address.rawAddress.toLowerCase());
        });
        const uniqueLocationNames = [...new Set(allLocationNames)];
        const uniqueCountries = [...new Set(allCountries)];
        const uniqueCountryCodes = [...new Set(allCountryCodes)];
        jobLogger.trace({ titleLower, uniqueLocationNames, uniqueCountries, uniqueCountryCodes }, "Extracted job identifiers.");

        const jobContentText = this._processJobContent(job); // Cleaned title + description
        jobLogger.trace({ contentPreview: jobContentText.substring(0, 200) + '...' }, "Processed job content.");

        const negativeKeywords = negativeConfig.keywords;
        const latamPositiveKeywords = [...positiveConfig.latamKeywords, ...positiveConfig.brazilKeywords];
        const globalPositiveKeywords = positiveConfig.remoteKeywords;

        // --- Step 1: Rejection Checks (Location & Title) ---
        jobLogger.trace("Starting Step 1: Rejection Checks (Location & Title)");
        // Check Title first
        const titleMatchNegative = this._matchesKeywordRegex(titleLower, negativeKeywords);
        jobLogger.trace({ titleMatchNegative }, "Title negative keyword check.");
        if (titleMatchNegative.match) {
            jobLogger.debug({ matchedKeyword: titleMatchNegative.keyword }, 'Rejecting (Step 1): Title contains negative keyword.');
            return { relevant: false, reason: `Title restriction: ${titleMatchNegative.keyword}` };
        }
        // Check all collected location names/countries/codes
        for (const locName of [...uniqueLocationNames, ...uniqueCountries, ...uniqueCountryCodes]) {
            const locMatchNegative = this._matchesKeywordRegex(locName, negativeKeywords);
            jobLogger.trace({ locationIdentifier: locName, locMatchNegative }, "Location negative keyword check.");
            if (locMatchNegative.match && !latamCountryCodes.includes(locMatchNegative.keyword || '')) { // Don't reject if negative match is a LATAM code itself
                jobLogger.debug({ locationIdentifier: locName, matchedKeyword: locMatchNegative.keyword }, 'Rejecting (Step 1): Location identifier contains negative keyword.');
                return { relevant: false, reason: `Location restriction: ${locMatchNegative.keyword} in ${locName}` };
            }
        }

        // --- Step 2: Acceptance Checks (LATAM Priority) ---
        jobLogger.trace("Starting Step 2: Acceptance Checks (LATAM Priority)");
        let potentialType: 'global' | 'latam' | 'unknown' = 'unknown';
        let acceptanceReason = '';

        // Check LATAM Country Codes
        const latamCodeMatch = uniqueCountryCodes.find(code => latamCountryCodes.includes(code));
        jobLogger.trace({ latamCodeMatch }, "LATAM country code check.");
        if (latamCodeMatch) {
            jobLogger.debug({ matchedCode: latamCodeMatch }, 'Accepting LATAM (Step 2): Country code is LATAM.');
            potentialType = 'latam';
            acceptanceReason = `Location(LATAM Country Code: ${latamCodeMatch})`;
        }
        // Check LATAM/Brazil Keywords in Location Names/Countries
        if (potentialType !== 'latam') {
            for (const locName of [...uniqueLocationNames, ...uniqueCountries]) {
                 const locMatchLatam = this._includesSubstringKeyword(locName, latamPositiveKeywords); // Use includes for broader match
                 jobLogger.trace({ locationIdentifier: locName, locMatchLatam }, "Location LATAM/Brazil keyword check.");
                 if (locMatchLatam.match) {
                      jobLogger.debug({ locationIdentifier: locName, matchedKeyword: locMatchLatam.keyword }, 'Accepting LATAM (Step 2): Location identifier contains positive LATAM/Brazil keyword.');
                      potentialType = 'latam';
                      acceptanceReason = `Location(LATAM Keyword: ${locMatchLatam.keyword} in ${locName})`;
                      break; // Found LATAM signal, stop checking locations
                 }
            }
        }
        // Check for "Americas" explicitly in locations (often includes LATAM)
         if (potentialType !== 'latam') {
             const includesAmericas = uniqueLocationNames.some(name => name.includes('americas'));
             jobLogger.trace({ includesAmericas }, "Location 'americas' keyword check.");
             if (includesAmericas) {
                 jobLogger.debug('Accepting LATAM (Step 2): Location name includes "Americas".');
                 potentialType = 'latam';
                 acceptanceReason = `Location(Keyword: americas)`;
             }
         }


        // --- Step 3: Acceptance Checks (Global) ---
        jobLogger.trace({ currentPotentialType: potentialType }, "Starting Step 3: Acceptance Checks (Global)");
        if (potentialType === 'unknown') {
            // Check Global Keywords in Location Names
            for (const locName of uniqueLocationNames) {
                 const locMatchGlobal = this._includesSubstringKeyword(locName, globalPositiveKeywords);
                 jobLogger.trace({ locationIdentifier: locName, locMatchGlobal }, "Location Global keyword check.");
                 if (locMatchGlobal.match) {
                      jobLogger.debug({ locationIdentifier: locName, matchedKeyword: locMatchGlobal.keyword }, 'Accepting GLOBAL (Step 3): Location name contains positive Global keyword.');
                      potentialType = 'global';
                      acceptanceReason = `Location(Global Keyword: ${locMatchGlobal.keyword} in ${locName})`;
                      break; // Found Global signal
                 }
            }
        }

        // --- Step 4: Content Check (Fallback / Confirmation) ---
        jobLogger.trace({ currentPotentialType: potentialType }, "Starting Step 4: Content Check");

        // Reject based on content if not already accepted
        if (potentialType === 'unknown') {
             const contentMatchNegative = this._matchesKeywordRegex(jobContentText, negativeKeywords);
             jobLogger.trace({ contentMatchNegative }, "Content negative keyword check.");
             if (contentMatchNegative.match) {
                  jobLogger.debug({ matchedKeyword: contentMatchNegative.keyword }, 'Rejecting (Step 4): Content contains negative keyword.');
                  return { relevant: false, reason: `Content restriction: ${contentMatchNegative.keyword}` };
             }
        }

        // Try to accept based on content if still unknown
        if (potentialType === 'unknown') {
             // Check LATAM in content
             const contentMatchLatam = this._includesSubstringKeyword(jobContentText, latamPositiveKeywords);
             jobLogger.trace({ contentMatchLatam }, "Content LATAM keyword check.");
             if (contentMatchLatam.match) {
                  jobLogger.debug({ matchedKeyword: contentMatchLatam.keyword }, 'Accepting LATAM (Step 4) based on content keyword.');
                  potentialType = 'latam';
                  acceptanceReason = `Content(LATAM Keyword: ${contentMatchLatam.keyword})`;
             } else {
                  // Check Global in content if not LATAM
                  const contentMatchGlobal = this._includesSubstringKeyword(jobContentText, globalPositiveKeywords);
                  jobLogger.trace({ contentMatchGlobal }, "Content Global keyword check.");
                  if (contentMatchGlobal.match) {
                       jobLogger.debug({ matchedKeyword: contentMatchGlobal.keyword }, 'Accepting GLOBAL (Step 4) based on content keyword.');
                       potentialType = 'global';
                       acceptanceReason = `Content(Global Keyword: ${contentMatchGlobal.keyword})`;
                  }
             }
        }

        // --- Step 5: Final Decision ---
        jobLogger.trace({ finalPotentialType: potentialType }, "Starting Step 5: Final Decision");
        if (potentialType === 'latam' || potentialType === 'global') {
            // Log acceptance at INFO level only here, after all checks passed
            jobLogger.info({ type: potentialType, reason: acceptanceReason }, '➡️ Relevant job found');
            return { relevant: true, reason: acceptanceReason, type: potentialType };
        } else {
            jobLogger.debug("Rejecting (Step 5): Inconclusive - No clear LATAM/Global signal found after all checks.");
            return { relevant: false, reason: "Inconclusive: No LATAM/Global signal found" };
        }
    }


    // --- Main Fetcher Method ---
    async processSource(source: JobSource, parentLogger: pino.Logger): Promise<FetcherResult> {
        const sourceLogger = parentLogger.child({ fetcher: 'Ashby', sourceName: source.name, sourceId: source.id });

        const stats: SourceStats = { found: 0, relevant: 0, processed: 0, errors: 0, deactivated: 0 }; // Initialize all required fields
        const foundSourceIds = new Set<string>(); // Collect jobUrl for ALL jobs
        let boardName: string | undefined;

        // --- Check Configs Loaded ---
        if (!this.ashbyPositiveConfig || !this.negativeConfig) {
            sourceLogger.error("Filter configurations not loaded. Aborting processing for this source.");
            stats.errors++;
            return { stats, foundSourceIds }; // Return empty set and error count
        }

        try {
            // --- Get Config & API URL ---
            const config = getAshbyConfig(source.config);
            if (!config || !config.jobBoardName) {
                sourceLogger.error('❌ Missing or invalid jobBoardName in source config');
                stats.errors++;
                return { stats, foundSourceIds };
            }
            boardName = config.jobBoardName;
            const apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${boardName}`; // CORRECT API Endpoint
            sourceLogger.info({ jobBoardName: boardName, apiUrl }, `-> Starting processing...`);


            // --- Fetch Data ---
            let apiJobs: AshbyApiJob[] = [];
            try {
                sourceLogger.debug("Attempting to fetch jobs from API...");
                const response = await axios.get<AshbyApiResponse>(apiUrl, {
                    headers: { 'Accept': 'application/json' },
                    timeout: 30000 // 30 seconds timeout
                });
                sourceLogger.info({ status: response.status }, "Received response from API.");

                if (response.status !== 200) {
                    sourceLogger.error({ status: response.status, statusText: response.statusText }, "API request failed with non-200 status.");
                    stats.errors++;
                    // Don't return yet, let finally block run if needed
                } else if (!response.data || !Array.isArray(response.data.jobs)) { // CORRECTED: Check 'jobs' field
                     sourceLogger.warn({ responseDataPreview: JSON.stringify(response.data)?.substring(0, 100) + '...' }, "API response data is missing 'jobs' array or is not an array.");
                     // Continue, maybe empty response is valid
                     apiJobs = [];
                 } else {
                     apiJobs = response.data.jobs; // CORRECTED: Use 'jobs' field
                     sourceLogger.info({ jobCount: apiJobs.length }, `+ ${apiJobs.length} total jobs found in API response.`);
                 }

            } catch (error) {
                stats.errors++;
                if (axios.isAxiosError(error)) {
                    sourceLogger.error(
                        { status: error.response?.status, code: error.code, message: error.message, url: apiUrl, data: error.response?.data },
                        `❌ Axios error fetching jobs`
                    );
                     // If 404, the board name might be wrong
                     if (error.response?.status === 404) {
                          sourceLogger.error(`Received 404. Check if jobBoardName '${boardName}' is correct for ${source.name}.`);
                     }
                } else {
                    const genericError = error as Error;
                    sourceLogger.error({ error: { message: genericError.message, name: genericError.name } }, '❌ General error fetching jobs');
                }
                // Abort processing for this source if fetch fails
                return { stats, foundSourceIds };
            }

            // --- Process Fetched Jobs ---
            stats.found = apiJobs.length;

            // Collect *all* jobUrls for deactivation check
            apiJobs.forEach(job => {
                if (job.jobUrl) {
                    foundSourceIds.add(job.jobUrl);
                } else {
                    // Fallback if jobUrl is missing - less ideal but necessary
                     sourceLogger.warn({ jobId: job.id, title: job.title }, "Job is missing jobUrl, using internal ID for potential deactivation tracking (less reliable).");
                     foundSourceIds.add(job.id); // Use internal ID as fallback
                }
            });

            const listedJobs = apiJobs.filter(job => job.isListed === true);
            const listedJobCount = listedJobs.length; // Calculate locally
            sourceLogger.info(`Processing ${listedJobCount} listed jobs for relevance...`);

            await pMap(listedJobs, async (job) => {
                // Ensure job has a URL before proceeding (should be guaranteed by collection logic, but double-check)
                 if (!job.jobUrl) {
                      sourceLogger.warn({ jobId: job.id, title: job.title }, "Skipping listed job because jobUrl is missing.");
                      stats.errors++; // Count as an error for processing stage
                      return;
                 }

                const jobLogger = sourceLogger.child({ jobId: job.jobUrl, jobTitle: job.title });
                try {
                    // Determine relevance
                    const relevanceResult = this._isJobRelevant(job, this.ashbyPositiveConfig, this.negativeConfig, jobLogger);

                    if (relevanceResult.relevant) {
                        stats.relevant++;

                        // Enhance job object with determined type for the processor
                        const enhancedJob = {
                            ...job,
                            _determinedHiringRegionType: relevanceResult.type
                        };

                        // Process via adapter
                        const saved = await this.jobProcessor.processRawJob('ashby', enhancedJob, source);

                        if (saved) {
                            stats.processed++;
                            jobLogger.trace('Job processed/saved via adapter.');
                        } else {
                            jobLogger.warn('Adapter reported job not saved (processor failure, duplicate, or save issue).');
                            // Should we count this as an error? Maybe not, adapter handles its own logging.
                        }
                    } else {
                        jobLogger.trace({ reason: relevanceResult.reason }, `Job skipped as irrelevant`);
                    }
                } catch (jobError: any) {
                    stats.errors++;
                     const errorDetails = { message: jobError?.message, stack: jobError?.stack?.split('\n').slice(0, 3).join('\n') };
                    jobLogger.error({ error: errorDetails }, '❌ Error during relevance check or adapter call for job');
                }
            }, { concurrency: 5, stopOnError: false }); // Process jobs concurrently

            sourceLogger.info(`✓ Processing completed.`);

        } catch (error) {
            // Catch errors during setup (e.g., config loading) or unexpected issues
            stats.errors++;
            const genericError = error as Error;
            sourceLogger.error({ error: { message: genericError.message, name: genericError.name } }, '❌ Fatal error during processSource execution');
        }

        // --- Return Final Result ---
        sourceLogger.info(
             // Log listed count here, but don't return it in stats
             { found: stats.found, /*listed: listedJobCount,*/ relevant: stats.relevant, processed: stats.processed, errors: stats.errors }, 
             'Finished processing source.'
        );
        return { stats, foundSourceIds };
    }

    // --- Remove the unused fetchJobs method ---
    // async *fetchJobs(source: JobSource): AsyncGenerator<any, void, undefined> { ... } // REMOVED
}