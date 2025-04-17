import { JobSource } from '@prisma/client';
import pino from 'pino';
import { JobFetcher, FetcherResult, SourceStats, LeverApiPosting } from './types';
import { JobProcessingAdapter } from '../adapters/JobProcessingAdapter';
import { PrismaClient } from '@prisma/client';
import { getLeverConfig } from '../../types/JobSource'; // Assuming this helper exists/will be created
import { detectRestrictivePattern } from '../utils/filterUtils'; // Import the filter utility
import leverFilterConfig from '../../config/lever-filter-config.json'; // Import the new config file

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class LeverFetcher implements JobFetcher {
    private prisma: PrismaClient;
    private adapter: JobProcessingAdapter;
    private readonly API_BASE_URL = 'https://api.lever.co/v0/postings/';

    constructor(prismaClient: PrismaClient, adapter: JobProcessingAdapter) {
        this.prisma = prismaClient;
        this.adapter = adapter;
    }

    async processSource(source: JobSource, parentLogger: pino.Logger): Promise<FetcherResult> {
        const sourceLogger = parentLogger.child({ fetcher: 'Lever', sourceName: source.name, sourceId: source.id });
        sourceLogger.info(`-> Starting processing...`);

        const startTime = Date.now();
        const stats: SourceStats = { found: 0, relevant: 0, processed: 0, deactivated: 0, errors: 0 };
        const foundSourceIds = new Set<string>();
        let errorMessage: string | undefined = undefined;

        try {
            // 1. Get companyIdentifier from source.config
            const leverConfig = getLeverConfig(source.config);
            if (!leverConfig?.companyIdentifier) {
                throw new Error('Missing or invalid companyIdentifier in JobSource config');
            }
            const companyIdentifier = leverConfig.companyIdentifier;
            const apiUrl = `${this.API_BASE_URL}${companyIdentifier}`;
            sourceLogger.info({ apiUrl }, `Fetching jobs from Lever API...`);

            // 2. Fetch jobs from Lever API
            const response = await fetch(apiUrl);

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Lever API request failed with status ${response.status}: ${errorBody}`);
            }

            const jobs: LeverApiPosting[] = await response.json();
            stats.found = jobs.length;
            sourceLogger.info(`+ ${stats.found} jobs found in API response.`);

            if (stats.found === 0) {
                sourceLogger.info('No jobs found for this source.');
                // No need to proceed further
            } else {
                // 3. Iterate through jobs (Processing logic will be added later)
                for (const job of jobs) {
                    foundSourceIds.add(job.id); // Track all found IDs for deactivation

                    // 4. Filter relevant jobs
                    const { relevant, reason } = this._isJobRelevant(job, sourceLogger);

                    if (relevant) {
                        stats.relevant++;
                        sourceLogger.trace({ jobId: job.id, reason }, 'Job marked as relevant');
                        try {
                            // 5. Process relevant jobs using adapter
                            const processedOk = await this.adapter.processRawJob('lever', job, source);
                            if (processedOk) {
                                stats.processed++;
                            } else {
                                // Adapter handles logging its own errors/warnings
                                stats.errors++; // Count as error if adapter fails
                            }
                        } catch (processingError: any) {
                            stats.errors++;
                            sourceLogger.error({ error: processingError, jobId: job.id }, 'Error processing relevant job');
                        }
                    } else {
                        sourceLogger.trace({ jobId: job.id, reason }, 'Job marked as irrelevant');
                    }
                }
            }
            sourceLogger.info('✓ Processing completed.');

        } catch (error: any) {
            errorMessage = error instanceof Error ? error.message : 'Unknown error during Lever fetching';
            stats.errors++;
            sourceLogger.error({ error }, `Error processing Lever source: ${errorMessage}`);
        }

        const durationMs = Date.now() - startTime;
        sourceLogger.info({ durationMs, stats }, 'Fetcher finished execution.');

        return {
            stats,
            foundSourceIds,
            durationMs,
            errorMessage,
        };
    }

    /**
     * Checks if a Lever job posting is relevant based on remote status and location restrictions.
     */
    private _isJobRelevant(job: LeverApiPosting, sourceLogger: pino.Logger): { relevant: boolean; reason: string } {
        const jobId = job.id;
        const title = job.text || '';
        const locationCategory = job.categories?.location?.toLowerCase() || '';
        const workplaceType = job.workplaceType?.toLowerCase();
        const description = (job.descriptionPlain || job.description || '').toLowerCase();
        const combinedText = `${title.toLowerCase()} ${locationCategory} ${description}`;

        // --- Check 1: Negative Keywords (using config) --- 
        // Read keywords from imported config
        if (detectRestrictivePattern(combinedText, leverFilterConfig.LOCATION_KEYWORDS.STRONG_NEGATIVE_RESTRICTION, sourceLogger)) { 
            sourceLogger.trace({ jobId, title }, 'Irrelevant: Detected negative/restrictive keyword from config.');
            return { relevant: false, reason: 'Restrictive keyword detected (config)' };
        }
        if (workplaceType === 'on-site' || workplaceType === 'hybrid') {
             sourceLogger.trace({ jobId, title, workplaceType }, 'Irrelevant: Workplace type is explicitly on-site or hybrid.');
            return { relevant: false, reason: 'Explicitly on-site/hybrid' };
        }

        // --- Check 2: Positive Remote Indicators (using config) --- 
        // Explicitly remote?
        if (workplaceType === 'remote') {
            sourceLogger.trace({ jobId, title }, 'Relevant: Workplace type is explicitly remote.');
            return { relevant: true, reason: 'Explicitly remote' };
        }

        // Check location category for remote keywords (using config)
        // Read keywords from imported config
        if (leverFilterConfig.LOCATION_KEYWORDS.STRONG_POSITIVE_GLOBAL.some(keyword => locationCategory.includes(keyword))) { 
             sourceLogger.trace({ jobId, title, locationCategory }, 'Relevant: Found positive remote keyword in location category (config).');
            return { relevant: true, reason: 'Remote keyword in location (config)' };
        }
        
        // --- Default: Assume Irrelevant if no strong signal --- 
        sourceLogger.trace({ jobId, title, locationCategory, workplaceType }, 'Irrelevant: No clear remote indicator found and passed negative checks.');
        return { relevant: false, reason: 'No clear remote indicator' };
    }
} 