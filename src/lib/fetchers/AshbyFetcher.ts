import axios, { AxiosError } from 'axios';
import { PrismaClient, JobSource, Prisma } from '@prisma/client';
import pMap from 'p-map';
import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';
import { JobProcessingAdapter } from '../adapters/JobProcessingAdapter';
import { JobSourceConfig, getAshbyConfig, FilterConfig } from '../../types/JobSource'; // Import FilterConfig
import { StandardizedJob, JobAssessmentStatus } from '../../types/StandardizedJob';
import { JobFetcher, SourceStats, FetcherResult, FilterResult, AshbyApiJob } from './types'; // Use real AshbyApiJob
import { stripHtml } from '../utils/textUtils';
import { detectRestrictivePattern, containsInclusiveSignal } from '../utils/filterUtils';

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
        let configPath = ''; // Define outside try block for logging
        try {
            // Revert path to point back to src/config based on tool error
            configPath = path.resolve(__dirname, '../../config/ashby-filter-config.json'); // Revert __dirname level
            log.trace({ configPath }, `AshbyFetcher: Attempting to load filter configuration...`);
            const configFile = fs.readFileSync(configPath, 'utf-8');
            this.filterConfig = JSON.parse(configFile) as FilterConfig;
            log.info({ configPath }, `AshbyFetcher: Successfully loaded filter configuration.`);
        } catch (error: any) {
            // Ensure the logged path reflects the attempted path
            log.error({ err: error, configPath: configPath || path.resolve(__dirname, '../../config/ashby-filter-config.json') }, `AshbyFetcher: ❌ Failed to load or parse filter configuration. Filtering keywords will not be applied.`);
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
                    // Use the implemented _isJobRelevant, returns JobAssessmentStatus
                    const assessmentStatus = this._isJobRelevant(job, jobLogger);
                    
                    // Add assessment status to the job object
                    const enhancedJob = {
                        ...job,
                        _assessmentStatus: assessmentStatus,
                        // Assume RELEVANT/NEEDS_REVIEW map to global for now
                        _determinedHiringRegionType: (assessmentStatus === JobAssessmentStatus.RELEVANT || assessmentStatus === JobAssessmentStatus.NEEDS_REVIEW) ? 'global' : undefined
                    };

                    // Process if RELEVANT or NEEDS_REVIEW
                    if (assessmentStatus === JobAssessmentStatus.RELEVANT || assessmentStatus === JobAssessmentStatus.NEEDS_REVIEW) {
                        if (assessmentStatus === JobAssessmentStatus.RELEVANT) {
                            stats.relevant++;
                            jobLogger.trace({ reason: 'Relevant job found' }, `➡️ Relevant job found`);
                        } else {
                             jobLogger.trace({ reason: 'Job needs review' }, `⚠️ Job marked for review`);
                        }
                        
                        const saved = await this.jobProcessor.processRawJob('ashby', enhancedJob, source);

                        if (saved) {
                            stats.processed++;
                            jobLogger.trace('Job processed/saved via adapter.');
                        } else {
                            jobLogger.trace('Adapter reported job not saved (processor failure, duplicate, irrelevant post-processing, or save issue).');
                        }
                    } else { // IRRELEVANT
                        jobLogger.trace({ reason: 'Job skipped as irrelevant' }, `Job skipped as irrelevant`);
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
    // Note: _includesSubstringKeyword and _matchesKeywordRegex are removed as filterUtils handles it now

    // --- Ashby Specific Filtering Checks (using filterUtils) ---

    private _checkLocation(job: AshbyApiJob, config: FilterConfig | null, logger: pino.Logger): 
        { decision: 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN', reason?: string } 
    {
        logger.trace("Checking Location Keywords...");

        // Combine ALL location text fields for checking
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
            addressDetails 
        ].filter(Boolean).join('; ').toLowerCase();

        logger.trace({ location: combinedLocationText }, "Combined Location Text for Analysis");

        // If no config or no text, decision is UNKNOWN unless explicitly remote (handled later)
        if (!config?.LOCATION_KEYWORDS || !combinedLocationText) {
            logger.trace("No location keywords or text found.");
            return { decision: 'UNKNOWN' };
        }

        const keywords = config.LOCATION_KEYWORDS;

        // 1. Check for STRONG_NEGATIVE keywords first
        const negativeCheck = detectRestrictivePattern(combinedLocationText, keywords.STRONG_NEGATIVE_RESTRICTION || [], logger);
        if (negativeCheck.isRestrictive) {
            const reason = `Location indicates Restriction: \"${negativeCheck.matchedKeyword}\"`;
            logger.debug({ location: combinedLocationText, keyword: negativeCheck.matchedKeyword }, reason);
            return { decision: 'REJECT', reason };
        }

        // 2. Check for STRONG_POSITIVE_LATAM keywords
        const latamSignal = containsInclusiveSignal(combinedLocationText, keywords.STRONG_POSITIVE_LATAM || [], logger);
        if (latamSignal.isInclusive) {
            const reason = `Location indicates LATAM: \"${latamSignal.matchedKeyword}\"`;
            logger.trace({ location: combinedLocationText, keyword: latamSignal.matchedKeyword }, reason);
            return { decision: 'ACCEPT_LATAM', reason };
        }

        // 3. Check for STRONG_POSITIVE_GLOBAL keywords
        const globalSignal = containsInclusiveSignal(combinedLocationText, keywords.STRONG_POSITIVE_GLOBAL || [], logger);
        if (globalSignal.isInclusive) {
            const reason = `Location indicates Global: \"${globalSignal.matchedKeyword}\"`;
            logger.trace({ location: combinedLocationText, keyword: globalSignal.matchedKeyword }, reason);
            return { decision: 'ACCEPT_GLOBAL', reason };
        }

        // 4. Check for exact BRAZIL terms 
        const brazilSignal = containsInclusiveSignal(combinedLocationText, keywords.ACCEPT_EXACT_BRAZIL_TERMS || [], logger);
        if (brazilSignal.isInclusive) {
            const reason = `Location indicates Brazil focus: \"${brazilSignal.matchedKeyword}\"`;
            logger.trace({ location: combinedLocationText, keyword: brazilSignal.matchedKeyword }, reason);
            return { decision: 'ACCEPT_LATAM', reason }; // Treat Brazil as LATAM
        }
        
        // 5. Check for exact LATAM countries (optional, might overlap with STRONG_POSITIVE_LATAM)
        const latamCountriesSignal = containsInclusiveSignal(combinedLocationText, keywords.ACCEPT_EXACT_LATAM_COUNTRIES || [], logger);
        if (latamCountriesSignal.isInclusive && !brazilSignal.isInclusive) { // Avoid double counting Brazil
             const reason = `Location indicates specific LATAM country: \"${latamCountriesSignal.matchedKeyword}\"`;
             logger.trace({ location: combinedLocationText, country: latamCountriesSignal.matchedKeyword }, reason);
             return { decision: 'ACCEPT_LATAM', reason };
        }

        // 6. Handle ambiguous keywords (like 'remote')
        // We might only trust this if job.isRemote is NOT explicitly true, 
        // or use it as a weaker signal needing content confirmation.
        // For simplicity, let's treat ambiguous location terms as UNKNOWN for now.
        // const ambiguousSignal = containsInclusiveSignal(combinedLocationText, keywords.AMBIGUOUS || [], logger);
        // if (ambiguousSignal.isInclusive) {
        //    // Add context check logic if needed
        // }

        logger.trace({ location: combinedLocationText }, "Location analysis result: UNKNOWN");
        return { decision: 'UNKNOWN' };
    }

    private _checkContent(job: AshbyApiJob, config: FilterConfig | null, logger: pino.Logger): 
        { decision: 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN', reason?: string } 
    {
        logger.trace("Checking Content Keywords...");

        const content = stripHtml(job.descriptionHtml || '');
        const title = job.title || '';
        if (!content && !title) {
            logger.trace("No content or title found.");
            return { decision: 'UNKNOWN' };
        }

        const fullContentLower = (title + ' ' + content).toLowerCase();
        logger.trace({ length: fullContentLower.length }, "Full content lower length for analysis.");

        // Ensure config exists for keyword checks
        if (!config || (!config.CONTENT_KEYWORDS && !config.LOCATION_KEYWORDS?.STRONG_NEGATIVE_RESTRICTION)) {
             logger.trace("No relevant content/negative keywords configured or config is null. Skipping content keyword checks.");
            return { decision: 'UNKNOWN' };
        }

        // Combine all relevant negative keywords
        const allNegativeKeywords = [
            ...(config.LOCATION_KEYWORDS?.STRONG_NEGATIVE_RESTRICTION || []),
            ...(config.CONTENT_KEYWORDS?.STRONG_NEGATIVE_REGION || []),
            ...(config.CONTENT_KEYWORDS?.STRONG_NEGATIVE_TIMEZONE || [])
        ];

        // 1. Check for STRONG_NEGATIVE keywords/patterns
        if (allNegativeKeywords.length > 0) {
            const detectedNegative = detectRestrictivePattern(fullContentLower, allNegativeKeywords, logger);
            logger.trace({ detectedNegative }, "Result of detectRestrictivePattern in _checkContent.");
            if (detectedNegative.isRestrictive) {
                 const reason = `Content indicates Specific Restriction via keyword/pattern: ${detectedNegative.matchedKeyword}`;
                 logger.debug(reason);
                return { decision: 'REJECT', reason };
            }
        } else {
            logger.trace("No negative keywords configured to check in content.");
        }

        // Only proceed with positive checks if CONTENT_KEYWORDS config exists
        if (!config.CONTENT_KEYWORDS) {
            logger.trace("No CONTENT_KEYWORDS in config. Skipping positive content checks.");
            return { decision: 'UNKNOWN' };
        }
        const keywords = config.CONTENT_KEYWORDS;

        // 2. Check for STRONG_POSITIVE_LATAM keywords (with context check maybe later)
        const latamSignal = containsInclusiveSignal(fullContentLower, keywords.STRONG_POSITIVE_LATAM || [], logger);
        if (latamSignal.isInclusive) {
            const reason = `Content indicates LATAM: \"${latamSignal.matchedKeyword}\"`;
            logger.trace({ keyword: latamSignal.matchedKeyword }, reason);
            // TODO: Optional context check for negatives near LATAM signal?
            return { decision: 'ACCEPT_LATAM', reason };
        }

        // 3. Check for STRONG_POSITIVE_GLOBAL keywords (with context check maybe later)
        const globalSignal = containsInclusiveSignal(fullContentLower, keywords.STRONG_POSITIVE_GLOBAL || [], logger);
        if (globalSignal.isInclusive) {
            const reason = `Content indicates Global: \"${globalSignal.matchedKeyword}\"`;
            logger.trace({ keyword: globalSignal.matchedKeyword }, reason);
             // TODO: Optional context check for negatives near GLOBAL signal?
            return { decision: 'ACCEPT_GLOBAL', reason };
        }

        // 4. Check for exact Brazil terms
        const brazilSignal = containsInclusiveSignal(fullContentLower, keywords.ACCEPT_EXACT_BRAZIL_TERMS || [], logger);
        if (brazilSignal.isInclusive) {
            const reason = `Content indicates Brazil focus: \"${brazilSignal.matchedKeyword}\"`;
             logger.trace({ keyword: brazilSignal.matchedKeyword }, reason);
            return { decision: 'ACCEPT_LATAM', reason }; // Treat Brazil as LATAM
        }

        logger.trace("Content keyword analysis result: UNKNOWN");
        return { decision: 'UNKNOWN' };
    }

    private _isJobRelevant(job: AshbyApiJob, jobLogger: pino.Logger): JobAssessmentStatus {
        jobLogger.trace('--- Starting Relevance Check ---');

        // Basic Checks
        if (job.isListed === false) {
            jobLogger.trace('Job not listed, marking as IRRELEVANT.');
            return JobAssessmentStatus.IRRELEVANT;
        }
        if (job.isRemote !== true) {
            jobLogger.trace('Job not explicitly remote, marking as IRRELEVANT.');
            return JobAssessmentStatus.IRRELEVANT;
        }

        // --- Filter Config Check ---
        if (!this.filterConfig) {
            jobLogger.warn('Filter config not loaded. Assuming job is relevant based on basic checks.');
            // If no config, we can only rely on isRemote=true, default to RELEVANT
            return JobAssessmentStatus.RELEVANT;
        }

        // --- Run Location and Content Checks using loaded config ---
        const locationCheck = this._checkLocation(job, this.filterConfig, jobLogger);
        const contentCheck = this._checkContent(job, this.filterConfig, jobLogger);

        // --- Decision Logic (Prioritize REJECT, then LATAM, then GLOBAL) ---
        if (locationCheck.decision === 'REJECT') {
            jobLogger.trace({ reason: locationCheck.reason }, 'Location check indicates REJECT, marking as IRRELEVANT.');
            return JobAssessmentStatus.IRRELEVANT;
        }
        if (contentCheck.decision === 'REJECT') {
            jobLogger.trace({ reason: contentCheck.reason }, 'Content check indicates REJECT, marking as IRRELEVANT.');
            return JobAssessmentStatus.IRRELEVANT;
        }

        // --- No specific NEEDS_REVIEW check for Ashby based on workplace type ---
        // Ashby API provides a clearer isRemote boolean.
        // Ambiguity leading to NEEDS_REVIEW would need different criteria here.

        // --- Accept if LATAM or GLOBAL signal found ---
        if (locationCheck.decision === 'ACCEPT_LATAM' || contentCheck.decision === 'ACCEPT_LATAM') {
            jobLogger.trace({ 
                locationReason: locationCheck.decision === 'ACCEPT_LATAM' ? locationCheck.reason : 'N/A', 
                contentReason: contentCheck.decision === 'ACCEPT_LATAM' ? contentCheck.reason : 'N/A'
            }, 'LATAM signal found, marking as RELEVANT.');
            return JobAssessmentStatus.RELEVANT;
        }
        if (locationCheck.decision === 'ACCEPT_GLOBAL' || contentCheck.decision === 'ACCEPT_GLOBAL') {
            jobLogger.trace({ 
                locationReason: locationCheck.decision === 'ACCEPT_GLOBAL' ? locationCheck.reason : 'N/A', 
                contentReason: contentCheck.decision === 'ACCEPT_GLOBAL' ? contentCheck.reason : 'N/A'
            }, 'Global signal found, marking as RELEVANT.');
            return JobAssessmentStatus.RELEVANT;
        }

        // --- Final Fallback --- 
        // If we passed basic checks (listed, remote) and keyword checks didn't reject, 
        // and no strong positive signal was found, assume it's RELEVANT based on isRemote=true.
        // This differs slightly from Greenhouse/Lever where UNKNOWN/HYBRID exists.
        jobLogger.trace('Passed basic checks (listed, remote), no REJECT signals, defaulting to RELEVANT.');
        return JobAssessmentStatus.RELEVANT;
    }
} 