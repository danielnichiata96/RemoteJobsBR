import axios, { AxiosError } from 'axios';
import { PrismaClient, JobSource, JobStatus, JobType, ExperienceLevel } from '@prisma/client'; // Added missing imports
import pMap from 'p-map';
import pino from 'pino';
import { JobProcessingAdapter } from '../adapters/JobProcessingAdapter';
import { getAshbyConfig, FilterConfig as GreenhouseFilterConfig } from '../../types/JobSource'; // Combined imports
import { JobFetcher, SourceStats, FetcherResult } from './types';
import sanitizeHtml from 'sanitize-html';
import { decode } from 'html-entities';
import * as fs from 'fs';
import * as path from 'path';
// Assuming jobUtils are in the correct relative path
import { detectJobType, detectExperienceLevel } from '../utils/jobUtils';


// --- Interfaces ---

// Updated AshbyApiJob interface based on official schema + potential secondaryLocations
interface AshbyApiJob {
    id: string;
    title: string;
    locations: AshbyLocation[]; // Primary locations array
    secondaryLocations?: AshbyLocation[]; // Optional secondary locations array <<< CORRECTED: ADDED THIS
    department?: { id: string; name: string; } | null;
    team?: { id: string; name: string; } | null;
    isRemote: boolean | null; // Allow null based on user feedback
    descriptionHtml?: string | null;
    descriptionPlain?: string | null;
    publishedAt: string;
    updatedAt: string;
    employmentType?: "FullTime" | "PartTime" | "Intern" | "Contract" | "Temporary" | null;
    compensationTier?: { id: string; name: string; } | null;
    compensationRange?: string | null;
    isListed: boolean;
    jobUrl: string;
    applyUrl: string;
    // Adding _determinedHiringRegionType for passing filter result
    _determinedHiringRegionType?: 'global' | 'latam';
}

// Based on: https://api.ashbyhq.com/posting-api-schema#Location
interface AshbyLocation {
  id: string;
  name: string;
  type: string; // Using string for flexibility as exact enum might vary
  address?: {
    rawAddress: string | null;
    streetAddress1: string | null;
    streetAddress2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
    countryCode: string | null; // Example: "US", "BR"
  } | null;
  isRemote: boolean; // Location specific remote flag
}


interface AshbyApiResponse {
    jobs: AshbyApiJob[];
}

interface FilterResult {
    relevant: boolean;
    reason: string;
    type?: 'global' | 'latam';
}

interface AshbyPositiveFilterConfig {
    remoteKeywords: string[];
    latamKeywords: string[];
    brazilKeywords: string[];
}

interface NegativeFilterConfig {
    keywords: string[];
}

// Global logger instance (assuming pino is configured elsewhere or use a default)
const baseLogger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' }
  },
  level: process.env.LOG_LEVEL || 'info',
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
        const currentLogger = baseLogger.child({ class: 'AshbyFetcher', method: '_loadFilterConfigs' });
        try {
            const positiveConfigPath = path.resolve(__dirname, '../../config/ashby-filter-config.json');
            const positiveConfigFile = fs.readFileSync(positiveConfigPath, 'utf-8');
            this.ashbyPositiveConfig = JSON.parse(positiveConfigFile) as AshbyPositiveFilterConfig;
            currentLogger.info({ configPath: positiveConfigPath }, `Successfully loaded Ashby positive filter configuration`);

        } catch (error: any) {
            currentLogger.error({ err: error, configPath: path.resolve(__dirname, '../../config/ashby-filter-config.json') }, `❌ Failed to load or parse Ashby positive filter configuration.`);
            this.ashbyPositiveConfig = null;
        }

        try {
            const greenhouseConfigPath = path.resolve(__dirname, '../../config/greenhouse-filter-config.json');
            const greenhouseConfigFile = fs.readFileSync(greenhouseConfigPath, 'utf-8');
            const greenhouseConfig = JSON.parse(greenhouseConfigFile) as GreenhouseFilterConfig;

            const combinedNegative = [
                ...(greenhouseConfig.LOCATION_KEYWORDS?.STRONG_NEGATIVE_RESTRICTION || []),
                ...(greenhouseConfig.CONTENT_KEYWORDS?.STRONG_NEGATIVE_REGION || [])
            ];
            this.negativeConfig = { keywords: [...new Set(combinedNegative.map(k => k.toLowerCase()))] };
            currentLogger.info({ configPath: greenhouseConfigPath, count: this.negativeConfig.keywords.length }, `Successfully loaded and combined negative filter keywords from Greenhouse config`);

        } catch (error: any) {
            currentLogger.error({ err: error, configPath: path.resolve(__dirname, '../../config/greenhouse-filter-config.json') }, `❌ Failed to load or parse Greenhouse filter configuration for negative keywords.`);
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

        // --- Step 0: Check isRemote (Handle null/undefined properly) ---
        let isExplicitlyRemote = job.isRemote === true;
        let isExplicitlyNotRemote = job.isRemote === false;

        if (isExplicitlyNotRemote) {
            jobLogger.debug("Rejecting: isRemote flag is explicitly false.");
            return { relevant: false, reason: "Marked as non-remote in ATS (isRemote: false)" };
        }
        if (!isExplicitlyRemote) {
            jobLogger.warn({ isRemoteValue: job.isRemote }, "job.isRemote is not explicitly true from API. Relying on location/content checks.");
            // Continue analysis even if null/undefined
        } else {
             jobLogger.trace("isRemote flag is true."); // Log if explicitly true
        }

        // --- Step 1: Data Extraction (Corrected) ---
        const titleLower = job.title?.toLowerCase() || '';
        const allLocationNames: string[] = [];
        const allCountryCodes: string[] = [];
        const allCountries: string[] = [];
        const latamCountryCodes = ['br', 'ar', 'cl', 'co', 'mx', 'pe', 'uy', 'ec', 'bo', 'py', 've'];

        // <<< Combine primary and secondary locations BEFORE iterating >>>
        const combinedLocations = [...(job.locations || []), ...(job.secondaryLocations || [])];

        jobLogger.trace({ locationCount: combinedLocations.length }, "Processing combined locations array.");

        combinedLocations.forEach((loc, index) => {
            if (!loc) return;
            jobLogger.trace({ index, locationEntry: loc }, "Extracting details from location entry."); // Log each entry being processed

            // Extract details safely
            const name = loc.name?.toLowerCase();
            const countryCode = loc.address?.countryCode?.toLowerCase();
            const country = loc.address?.country?.toLowerCase();
            const city = loc.address?.city?.toLowerCase();
            const state = loc.address?.state?.toLowerCase();
            const rawAddress = loc.address?.rawAddress?.toLowerCase();

            if (name) allLocationNames.push(name);
            if (countryCode) allCountryCodes.push(countryCode);
            if (country) allCountries.push(country);
            if (city) allLocationNames.push(city); // Add city to names for keyword check
            if (state) allLocationNames.push(state); // Add state to names for keyword check
            if (rawAddress) allLocationNames.push(rawAddress); // Add raw address if available
        });

        // Include title in the list of identifiers to check
        const uniqueLocationIdentifiers = [...new Set([...allLocationNames, ...allCountries, ...allCountryCodes, titleLower])];
        jobLogger.debug({ uniqueLocationIdentifiers }, "DEBUG: Final unique location identifiers BEFORE analysis."); 

        const negativeKeywords = negativeConfig.keywords;
        const latamPositiveKeywords = [...positiveConfig.latamKeywords, ...positiveConfig.brazilKeywords];
        const globalPositiveKeywords = positiveConfig.remoteKeywords;
        let locationDecision = 'unknown';
        let negativeLocationKeyword: string | undefined = undefined;
        let hasLatamLocationSignal = false;
        let hasAmericasLocationSignal = false;
        let hasGlobalLocationSignal = false;
        let hasNegativeLocationSignal = false;

        for (const identifier of uniqueLocationIdentifiers) {
            // Check LATAM
            if (!hasLatamLocationSignal) {
                if (latamCountryCodes.includes(identifier) || this._includesSubstringKeyword(identifier, latamPositiveKeywords).match) {
                    hasLatamLocationSignal = true;
                    jobLogger.trace({ identifier }, "Found LATAM signal in location/title.");
                }
            }
            // Check Americas
            if (!hasAmericasLocationSignal && identifier.includes('americas')) {
                hasAmericasLocationSignal = true;
                jobLogger.trace({ identifier }, "Found Americas signal in location/title.");
            }
            // Check Global (if not already LATAM/Americas)
            if (!hasLatamLocationSignal && !hasAmericasLocationSignal && !hasGlobalLocationSignal) {
                if (this._includesSubstringKeyword(identifier, globalPositiveKeywords).match) {
                    hasGlobalLocationSignal = true;
                    jobLogger.trace({ identifier }, "Found Global signal in location/title.");
                }
            }
            // Check Negative
            if (!hasNegativeLocationSignal) {
                const match = this._matchesKeywordRegex(identifier, negativeKeywords);
                if (match.match && match.keyword !== 'americas') {
                    hasNegativeLocationSignal = true;
                    negativeLocationKeyword = match.keyword;
                    jobLogger.trace({ identifier, keyword: match.keyword }, "Found Negative signal in location/title.");
                }
            }
        }

        // **PRIORITY MÁXIMA: LATAM EXPLÍCITO**
        if (hasLatamLocationSignal) {
            jobLogger.info("Accepting LATAM (Priority 1): Explicit LATAM signal found in location/title. OVERRIDING other signals.");
            return { relevant: true, reason: "Location/Title(LATAM Signal)", type: 'latam' };
        }
        // **PRIORIDADE 2: AMERICAS (sem outras negativas fortes)**
        if (hasAmericasLocationSignal && !hasNegativeLocationSignal) {
            jobLogger.info("Accepting LATAM (Priority 2): Americas signal found without other negative restrictions.");
            return { relevant: true, reason: "Location/Title(Americas Signal)", type: 'latam' };
        }
        // **PRIORIDADE 3: GLOBAL (sem negativas fortes)**
        if (hasGlobalLocationSignal && !hasNegativeLocationSignal) {
            jobLogger.trace("Location indicates Global without negatives. Proceeding to content check.");
            locationDecision = 'global';
        }
        // **PRIORIDADE 4: NEGATIVA (sem sinais positivos fortes para sobrepor)**
        else if (hasNegativeLocationSignal) {
            jobLogger.debug({ keyword: negativeLocationKeyword }, "Rejecting: Negative signal found in location/title without strong positive override.");
            return { relevant: false, reason: `Location/Title Restriction: ${negativeLocationKeyword}` };
        }
        // **SENÃO (Ambíguo/Sem Sinal):**
        else {
            jobLogger.trace("No clear or conflicting location/title signal. Proceeding to content check.");
            locationDecision = 'unknown';
        }

        // --- Step 4: Content Check & Final Decision --- 
        if (locationDecision === 'global' || locationDecision === 'unknown') {
             jobLogger.trace("Performing content check...");
             const jobContentText = this._processJobContent(job);
             jobLogger.debug({ jobContentTextPreview: jobContentText.substring(0, 500) + '...' }, 'DEBUG: Job content text being analyzed');

             // --- Check Content Keywords (Positive and Negative using FULL list) ---
             const contentMatchNegative = this._matchesKeywordRegex(jobContentText, negativeKeywords);
             jobLogger.trace({ contentMatchNegative }, "Content negative keyword check (using FULL list).");

             const contentMatchLatam = this._includesSubstringKeyword(jobContentText, latamPositiveKeywords);
             jobLogger.trace({ contentMatchLatam }, "Content LATAM check.");

             const contentMatchGlobal = this._includesSubstringKeyword(jobContentText, globalPositiveKeywords);
             jobLogger.trace({ contentMatchGlobal }, "Content Global check.");

             // --- Make decision based on content signals ---

             // **PRIORITY: Positive LATAM content signal overrides negative content signal**
             if (contentMatchLatam.match) {
                 jobLogger.info({ matchedKeyword: contentMatchLatam.keyword }, 'Accepting LATAM (Content): Positive LATAM keyword found in content.');
                 return { relevant: true, reason: `Content(LATAM Keyword: ${contentMatchLatam.keyword})`, type: 'latam' };
             }

             // **Negative content signal (from FULL list) blocks Global acceptance** 
             if (contentMatchNegative.match /* && contentMatchNegative.keyword !== 'americas' */) {
                 jobLogger.debug({ matchedKeyword: contentMatchNegative.keyword }, 'Rejecting (Content): Negative keyword (from FULL list) found in content, and no overriding LATAM signal.');
                 return { relevant: false, reason: `Content restriction keyword: ${contentMatchNegative.keyword}` };
             }

             // **Positive Global content signal (only if no negative content signal was found)**
             if (contentMatchGlobal.match) {
                 jobLogger.info({ matchedKeyword: contentMatchGlobal.keyword }, 'Accepting GLOBAL (Content): Positive Global keyword found and no negative content keyword (from FULL list).');
                 return { relevant: true, reason: `Content(Global Keyword: ${contentMatchGlobal.keyword})`, type: 'global' };
             }
             
             // **Handle case where location check indicated Global, but content check was inconclusive**
             if (locationDecision === 'global') {
                  jobLogger.info('Accepting GLOBAL (Location Confirmation): Location indicated Global and content checks were inconclusive/non-blocking.');
                  return { relevant: true, reason: 'Location(Global Signal) + Content Inconclusive', type: 'global' };
             }
        }

        // --- Final Fallback Decision --- (if no signals found anywhere)
        jobLogger.debug("Rejecting (Final): Inconclusive - No clear signal found after all location and content checks.");
        return { relevant: false, reason: "Inconclusive: No LATAM/Global signal found" };
    }


    // --- Main Fetcher Method ---
    async processSource(source: JobSource, parentLogger: pino.Logger): Promise<FetcherResult> {
        const sourceLogger = parentLogger.child({ fetcher: 'Ashby', sourceName: source.name, sourceId: source.id });
        const stats: SourceStats = { found: 0, relevant: 0, processed: 0, errors: 0, deactivated: 0 };
        const foundSourceIds = new Set<string>();
        let boardName: string | undefined;
        let listedJobCount = 0; // Initialize counter for listed jobs

        if (!this.ashbyPositiveConfig || !this.negativeConfig) {
            sourceLogger.error("Filter configurations not loaded during constructor. Aborting processing.");
            stats.errors++;
            return { stats, foundSourceIds };
        }

        try {
            const config = getAshbyConfig(source.config);
            if (!config || !config.jobBoardName) {
                sourceLogger.error('❌ Missing or invalid jobBoardName in source config');
                stats.errors++;
                return { stats, foundSourceIds };
            }
            boardName = config.jobBoardName;
            const apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${boardName}`;
            sourceLogger.info({ jobBoardName: boardName, apiUrl }, `-> Starting processing...`);

            let apiJobs: AshbyApiJob[] = [];
            try {
                sourceLogger.debug("Attempting to fetch jobs from API...");
                const response = await axios.get<AshbyApiResponse>(apiUrl, {
                    headers: { 'Accept': 'application/json' },
                    timeout: 45000 // Increased timeout slightly
                });
                sourceLogger.info({ status: response.status }, "Received response from API.");

                if (response.status !== 200) {
                     sourceLogger.error({ status: response.status, statusText: response.statusText }, "API request failed with non-200 status.");
                    stats.errors++;
                 } else if (!response.data || !Array.isArray(response.data.jobs)) {
                      sourceLogger.warn({ responseDataPreview: JSON.stringify(response.data)?.substring(0, 100) + '...' }, "API response data is missing 'jobs' array or is not an array.");
                      apiJobs = [];
                  } else {
                      apiJobs = response.data.jobs;
                      sourceLogger.info({ jobCount: apiJobs.length }, `+ ${apiJobs.length} total jobs found in API response.`);
                  }

            } catch (error) {
                stats.errors++;
                 if (axios.isAxiosError(error)) {
                     sourceLogger.error(
                         { status: error.response?.status, code: error.code, message: error.message, url: apiUrl, data: error.response?.data },
                         `❌ Axios error fetching jobs`
                     );
                      if (error.response?.status === 404) {
                           sourceLogger.error(`Received 404. Check if jobBoardName '${boardName}' is correct for ${source.name}.`);
                      } else if (error.response?.status === 401 || error.response?.status === 403) {
                           sourceLogger.error(`Received ${error.response.status}. API endpoint might require different access or format changed.`);
                      }
                 } else {
                     const genericError = error as Error;
                     sourceLogger.error({ error: { message: genericError.message, name: genericError.name } }, '❌ General error fetching jobs');
                 }
                return { stats, foundSourceIds }; // Abort on fetch error
            }

            stats.found = apiJobs.length; // Found = Total jobs returned by API

            apiJobs.forEach(job => {
                if (job.jobUrl) { // Use jobUrl as the primary unique ID from the source
                    foundSourceIds.add(job.jobUrl);
                } else {
                     sourceLogger.warn({ internalId: job.id, title: job.title }, "Job missing jobUrl, using internal ID as fallback for tracking.");
                     foundSourceIds.add(job.id); // Less reliable fallback
                }
            });

            const listedJobs = apiJobs.filter(job => job.isListed === true);
            listedJobCount = listedJobs.length; // Correctly assign listed job count
            sourceLogger.info(`Processing ${listedJobCount} listed jobs for relevance (Total found: ${stats.found})...`);

            if (listedJobCount > 0) {
                 sourceLogger.trace({ sampleListedJob: listedJobs[0] }, "Sample listed job data.");
            }

            await pMap(listedJobs, async (job) => {
                 if (!job.jobUrl && !job.id) { // Need at least one ID
                     sourceLogger.error({ jobTitle: job.title }, "Job missing both jobUrl and internal ID. Cannot process.");
                     stats.errors++;
                     return;
                 }
                 // Use jobUrl if available, otherwise fallback to internal ID for logging context
                 const jobContextId = job.jobUrl || `internalId:${job.id}`;
                 const jobLogger = sourceLogger.child({ jobId: jobContextId, jobTitle: job.title });

                 try {
                     jobLogger.trace("Starting relevance check for listed job.");
                     const relevanceResult = this._isJobRelevant(job, this.ashbyPositiveConfig, this.negativeConfig, jobLogger);

                     if (relevanceResult.relevant) {
                         stats.relevant++;

                         const enhancedJob = { ...job, _determinedHiringRegionType: relevanceResult.type };

                         const saved = await this.jobProcessor.processRawJob('ashby', enhancedJob, source);

                         if (saved) {
                             stats.processed++;
                             jobLogger.trace('Job processed/saved via adapter.');
                         } else {
                             jobLogger.warn('Adapter reported job not saved (processor failure, duplicate, or save issue).');
                         }
                     } else {
                         jobLogger.trace({ reason: relevanceResult.reason }, `Job skipped as irrelevant`);
                     }
                 } catch (jobError: any) {
                     stats.errors++;
                      const errorDetails = { message: jobError?.message, stack: jobError?.stack?.split('\n').slice(0, 3).join('\n') };
                     jobLogger.error({ error: errorDetails }, '❌ Error during relevance check or adapter call for job');
                 }
            }, { concurrency: 5, stopOnError: false });

            sourceLogger.info(`✓ Processing completed.`);

        } catch (error) {
            stats.errors++;
            const genericError = error as Error;
            sourceLogger.error({ error: { message: genericError.message, name: genericError.name } }, '❌ Fatal error during processSource execution');
        }

        sourceLogger.info(
             { found: stats.found, listed: listedJobCount, relevant: stats.relevant, processed: stats.processed, errors: stats.errors },
             'Finished processing source.'
        );
        return { stats, foundSourceIds };
    }
}