import { JobSource } from '@prisma/client';
import pino from 'pino';
import { JobFetcher, FetcherResult, SourceStats, LeverApiPosting, FilterResult } from './types';
import { JobProcessingAdapter } from '../adapters/JobProcessingAdapter';
import { PrismaClient } from '@prisma/client';
import { getLeverConfig, FilterConfig } from '../../types/JobSource';
import { detectRestrictivePattern, containsInclusiveSignal } from '../utils/filterUtils';
import * as fs from 'fs';
import * as path from 'path';
import { stripHtml } from '../utils/textUtils';
import { JobAssessmentStatus } from '../../types/StandardizedJob';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class LeverFetcher implements JobFetcher {
    private prisma: PrismaClient;
    private adapter: JobProcessingAdapter;
    private readonly API_BASE_URL = 'https://api.lever.co/v0/postings/';
    private filterConfig: FilterConfig | null = null;

    constructor(prismaClient: PrismaClient, adapter: JobProcessingAdapter) {
        this.prisma = prismaClient;
        this.adapter = adapter;
        this._loadFilterConfig();
    }

    private _loadFilterConfig(log?: pino.Logger): void {
        const localLogger = log || logger;
        let configPath = '';
        try {
            configPath = path.resolve(__dirname, '../../config/lever-filter-config.json');
            localLogger.trace({ configPath }, `LeverFetcher: Attempting to load filter configuration...`);
            const configFile = fs.readFileSync(configPath, 'utf-8');
            this.filterConfig = JSON.parse(configFile) as FilterConfig;
            localLogger.info({ configPath }, `LeverFetcher: Successfully loaded filter configuration.`);
        } catch (error: any) {
            localLogger.error({ err: error, configPath: configPath || 'src/config/lever-filter-config.json' }, `LeverFetcher: ❌ Failed to load or parse filter configuration. Filtering keywords will not be applied.`);
            this.filterConfig = null;
        }
    }

    async processSource(source: JobSource, parentLogger: pino.Logger): Promise<FetcherResult> {
        const sourceLogger = parentLogger.child({ fetcher: 'Lever', sourceName: source.name, sourceId: source.id });
        sourceLogger.info(`-> Starting processing...`);

        if (!this.filterConfig) {
            this._loadFilterConfig(sourceLogger);
        }

        const startTime = Date.now();
        const stats: SourceStats = { found: 0, relevant: 0, processed: 0, deactivated: 0, errors: 0 };
        const foundSourceIds = new Set<string>();
        let errorMessage: string | undefined = undefined;

        try {
            const leverConfig = getLeverConfig(source.config);
            if (!leverConfig?.companyIdentifier) {
                throw new Error('Missing or invalid companyIdentifier in JobSource config');
            }
            const companyIdentifier = leverConfig.companyIdentifier;
            const apiUrl = `${this.API_BASE_URL}${companyIdentifier}`;
            sourceLogger.info({ apiUrl }, `Fetching jobs from Lever API...`);

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
            } else {
                let firstJobProcessingError: string | undefined = undefined;
                for (const job of jobs) {
                    if (!job || !job.id) {
                        sourceLogger.warn({ job }, 'Skipping job due to missing ID.');
                        continue;
                    }
                    foundSourceIds.add(job.id);
                    const jobLogger = sourceLogger.child({ jobId: job.id, jobTitle: job.text?.substring(0, 50) });

                    try {
                        const assessmentStatus = this._isJobRelevant(job, jobLogger);

                        const enhancedJob = {
                            ...job,
                            _assessmentStatus: assessmentStatus,
                            _determinedHiringRegionType: (assessmentStatus === JobAssessmentStatus.RELEVANT || assessmentStatus === JobAssessmentStatus.NEEDS_REVIEW) ? 'global' : undefined
                        };

                        if (assessmentStatus === JobAssessmentStatus.RELEVANT || assessmentStatus === JobAssessmentStatus.NEEDS_REVIEW) {
                            if (assessmentStatus === JobAssessmentStatus.RELEVANT) {
                                stats.relevant++;
                                jobLogger.trace({ reason: 'Relevant job found' }, '➡️ Relevant job found');
                            } else {
                                jobLogger.trace({ reason: 'Job needs review' }, '⚠️ Job marked for review');
                            }
                            
                            const processedOk = await this.adapter.processRawJob('lever', enhancedJob, source);
                            if (processedOk) {
                                stats.processed++;
                                jobLogger.trace('Job processed/saved via adapter.');
                            } else {
                                stats.errors++; 
                                jobLogger.trace('Adapter reported job not saved.');
                            }
                        } else {
                            jobLogger.trace({ reason: 'Job skipped as irrelevant' }, 'Job skipped as irrelevant');
                        }
                    } catch (jobError: any) {
                        stats.errors++;
                        if (!firstJobProcessingError) {
                            firstJobProcessingError = `Job ${job.id} (${job.text}): ${jobError?.message || 'Unknown processing error'}`;
                        }
                        const errorDetails = {
                            message: jobError?.message,
                            stack: jobError?.stack?.split('\n').slice(0, 5).join('\n'),
                            name: jobError?.name,
                        };
                        jobLogger.error({ error: errorDetails }, '❌ Error processing individual job or calling adapter');
                    }
                }
                if (firstJobProcessingError) {
                    errorMessage = firstJobProcessingError;
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

    private _checkLocation(job: LeverApiPosting, config: FilterConfig | null, logger: pino.Logger): 
        { decision: 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN', reason?: string } 
    {
        logger.trace("Checking Location Keywords...");
        
        const locationText = job.categories?.location?.toLowerCase() || '';
        const commitmentText = job.categories?.commitment?.toLowerCase() || '';
        const combinedLocationText = `${locationText}; ${commitmentText}`.trim();

        logger.trace({ location: combinedLocationText }, "Combined Location Text for Analysis");

        if (!config?.LOCATION_KEYWORDS || !combinedLocationText) {
            logger.trace("No location keywords or text found.");
            return { decision: 'UNKNOWN' };
        }
        const keywords = config.LOCATION_KEYWORDS;

        const negativeCheck = detectRestrictivePattern(combinedLocationText, keywords.STRONG_NEGATIVE_RESTRICTION || [], logger);
        if (negativeCheck.isRestrictive) {
            const reason = `Location/Commitment indicates Restriction: \"${negativeCheck.matchedKeyword}\"`;
            logger.debug({ location: combinedLocationText, keyword: negativeCheck.matchedKeyword }, reason);
            return { decision: 'REJECT', reason };
        }

        const latamSignal = containsInclusiveSignal(combinedLocationText, keywords.STRONG_POSITIVE_LATAM || [], logger);
        if (latamSignal.isInclusive) {
            const reason = `Location/Commitment indicates LATAM: \"${latamSignal.matchedKeyword}\"`;
            logger.trace({ location: combinedLocationText, keyword: latamSignal.matchedKeyword }, reason);
            return { decision: 'ACCEPT_LATAM', reason };
        }

        const globalSignal = containsInclusiveSignal(combinedLocationText, keywords.STRONG_POSITIVE_GLOBAL || [], logger);
        if (globalSignal.isInclusive) {
            const reason = `Location/Commitment indicates Global: \"${globalSignal.matchedKeyword}\"`;
            logger.trace({ location: combinedLocationText, keyword: globalSignal.matchedKeyword }, reason);
            return { decision: 'ACCEPT_GLOBAL', reason };
        }

        const brazilSignal = containsInclusiveSignal(combinedLocationText, keywords.ACCEPT_EXACT_BRAZIL_TERMS || [], logger);
        if (brazilSignal.isInclusive) {
            const reason = `Location/Commitment indicates Brazil focus: \"${brazilSignal.matchedKeyword}\"`;
            logger.trace({ location: combinedLocationText, keyword: brazilSignal.matchedKeyword }, reason);
            return { decision: 'ACCEPT_LATAM', reason };
        }

        const latamCountriesSignal = containsInclusiveSignal(combinedLocationText, keywords.ACCEPT_EXACT_LATAM_COUNTRIES || [], logger);
        if (latamCountriesSignal.isInclusive && !brazilSignal.isInclusive) {
             const reason = `Location/Commitment indicates specific LATAM country: \"${latamCountriesSignal.matchedKeyword}\"`;
             logger.trace({ location: combinedLocationText, country: latamCountriesSignal.matchedKeyword }, reason);
             return { decision: 'ACCEPT_LATAM', reason };
        }

        logger.trace({ location: combinedLocationText }, "Location analysis result: UNKNOWN");
        return { decision: 'UNKNOWN' };
    }

    private _checkContent(job: LeverApiPosting, config: FilterConfig | null, logger: pino.Logger): 
        { decision: 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN', reason?: string } 
    {
        logger.trace("Checking Content Keywords...");

        const title = job.text || '';
        const description = stripHtml(job.descriptionPlain || job.description || ''); 
        
        if (!description && !title) {
            logger.trace("No content (description/plain) or title found.");
            return { decision: 'UNKNOWN' };
        }

        const fullContentLower = (title + ' ' + description).toLowerCase();
        logger.trace({ length: fullContentLower.length }, "Full content lower length for analysis.");

        if (!config || (!config.CONTENT_KEYWORDS && !config.LOCATION_KEYWORDS?.STRONG_NEGATIVE_RESTRICTION)) {
             logger.trace("No relevant content/negative keywords configured or config is null. Skipping content keyword checks.");
            return { decision: 'UNKNOWN' };
        }
        
        const allNegativeKeywords = [
            ...(config.LOCATION_KEYWORDS?.STRONG_NEGATIVE_RESTRICTION || []),
            ...(config.CONTENT_KEYWORDS?.STRONG_NEGATIVE_REGION || []),
            ...(config.CONTENT_KEYWORDS?.STRONG_NEGATIVE_TIMEZONE || [])
        ];

        if (allNegativeKeywords.length > 0) {
            const detectedNegative = detectRestrictivePattern(fullContentLower, allNegativeKeywords, logger);
            if (detectedNegative.isRestrictive) {
                 const reason = `Content indicates Specific Restriction: \"${detectedNegative.matchedKeyword}\"`;
                 logger.debug(reason);
                return { decision: 'REJECT', reason };
            }
        }

        if (!config.CONTENT_KEYWORDS) {
            logger.trace("No CONTENT_KEYWORDS in config. Skipping positive content checks.");
            return { decision: 'UNKNOWN' };
        }
        const keywords = config.CONTENT_KEYWORDS;

        const latamSignal = containsInclusiveSignal(fullContentLower, keywords.STRONG_POSITIVE_LATAM || [], logger);
        if (latamSignal.isInclusive) {
            const reason = `Content indicates LATAM: \"${latamSignal.matchedKeyword}\"`;
            logger.trace({ keyword: latamSignal.matchedKeyword }, reason);
            return { decision: 'ACCEPT_LATAM', reason };
        }

        const globalSignal = containsInclusiveSignal(fullContentLower, keywords.STRONG_POSITIVE_GLOBAL || [], logger);
        if (globalSignal.isInclusive) {
            const reason = `Content indicates Global: \"${globalSignal.matchedKeyword}\"`;
            logger.trace({ keyword: globalSignal.matchedKeyword }, reason);
            return { decision: 'ACCEPT_GLOBAL', reason };
        }

        const brazilSignal = containsInclusiveSignal(fullContentLower, keywords.ACCEPT_EXACT_BRAZIL_TERMS || [], logger);
        if (brazilSignal.isInclusive) {
            const reason = `Content indicates Brazil focus: \"${brazilSignal.matchedKeyword}\"`;
             logger.trace({ keyword: brazilSignal.matchedKeyword }, reason);
            return { decision: 'ACCEPT_LATAM', reason };
        }

        logger.trace({ content: fullContentLower.substring(0, 100) + '...' }, "Content analysis result: UNKNOWN");
        return { decision: 'UNKNOWN' };
    }

    private _isJobRelevant(job: LeverApiPosting, jobLogger: pino.Logger): JobAssessmentStatus {
        jobLogger.trace('--- Starting Relevance Check ---');

        const workplaceTypeLower = job.workplaceType?.toLowerCase();

        if (workplaceTypeLower === 'on-site') {
            jobLogger.trace({ workplaceType: job.workplaceType }, 'Workplace type is ON_SITE, marking as IRRELEVANT.');
            return JobAssessmentStatus.IRRELEVANT;
        }
        jobLogger.trace({ workplaceType: job.workplaceType }, 'Workplace type check passed (not ON_SITE).');

        const locationCheck = this._checkLocation(job, this.filterConfig, jobLogger);
        const contentCheck = this._checkContent(job, this.filterConfig, jobLogger);

        if (locationCheck.decision === 'REJECT') {
            jobLogger.trace({ reason: locationCheck.reason }, 'Location check indicates REJECT, marking as IRRELEVANT.');
            return JobAssessmentStatus.IRRELEVANT;
        }
        if (contentCheck.decision === 'REJECT') {
            jobLogger.trace({ reason: contentCheck.reason }, 'Content check indicates REJECT, marking as IRRELEVANT.');
            return JobAssessmentStatus.IRRELEVANT;
        }

        if (workplaceTypeLower === 'hybrid' || !workplaceTypeLower || workplaceTypeLower === 'unknown') {
            const hasPositiveSignal = locationCheck.decision === 'ACCEPT_LATAM' || locationCheck.decision === 'ACCEPT_GLOBAL' ||
                                    contentCheck.decision === 'ACCEPT_LATAM' || contentCheck.decision === 'ACCEPT_GLOBAL';
            
            if (!hasPositiveSignal) {
                jobLogger.trace({ workplaceType: job.workplaceType }, 'Workplace is HYBRID/UNKNOWN and no strong positive signals found, marking as NEEDS_REVIEW.');
                return JobAssessmentStatus.NEEDS_REVIEW;
            }
        }

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

        if (workplaceTypeLower === 'remote') {
            jobLogger.trace({ workplaceType: job.workplaceType }, 'Workplace is REMOTE, no reject/LATAM/Global signals, defaulting to RELEVANT.');
            return JobAssessmentStatus.RELEVANT;
        }

        jobLogger.trace('Reached end of relevance check without clear decision, defaulting to IRRELEVANT.');
        return JobAssessmentStatus.IRRELEVANT;
    }
} 