import axios, { AxiosError } from 'axios';
import { PrismaClient, JobSource } from '@prisma/client';
import pMap from 'p-map';
import pino from 'pino';
import { JobProcessingAdapter } from '../adapters/JobProcessingAdapter';
import { getAshbyConfig } from '../../types/JobSource';
import { JobFetcher, SourceStats, FetcherResult } from './types';

// Define a interface que representa o formato dos jobs retornados pela API Ashby
interface AshbyApiJob {
    title: string;
    location?: string;
    secondaryLocations?: { location?: string; address?: { 
        addressLocality?: string;
        addressRegion?: string;
        addressCountry?: string;
    } }[];
    department?: string;
    team?: string;
    isRemote?: boolean;
    descriptionHtml?: string;
    descriptionPlain?: string;
    publishedAt?: string; // ISO DateTime string
    employmentType?: "FullTime" | "PartTime" | "Intern" | "Contract" | "Temporary";
    address?: { postalAddress?: {
        addressLocality?: string;
        addressRegion?: string;
        addressCountry?: string;
    } };
    jobUrl?: string;
    applyUrl?: string;
    isListed?: boolean;
}

// Define a interface para a resposta da API Ashby
interface AshbyApiResponse {
    jobs: AshbyApiJob[];
}

/**
 * Fetcher implementation for Ashby job board API.
 * API docs: https://app.ashbyhq.com/docs/api/job-board-api
 */
export class AshbyFetcher implements JobFetcher {
    private prisma: PrismaClient;
    private jobProcessor: JobProcessingAdapter;

    constructor(prismaClient: PrismaClient, jobProcessingAdapter: JobProcessingAdapter) {
        this.prisma = prismaClient;
        this.jobProcessor = jobProcessingAdapter;
    }

    async processSource(source: JobSource, parentLogger: pino.Logger): Promise<FetcherResult> {
        const sourceLogger = parentLogger.child({ 
            fetcher: 'Ashby', 
            sourceName: source.name, 
            sourceId: source.id 
        });
        
        const stats: SourceStats = { 
            found: 0, 
            relevant: 0, 
            processed: 0, 
            deactivated: 0, 
            errors: 0 
        };
        
        const foundSourceIds = new Set<string>();
        let jobBoardName: string | null = null;
        let apiUrl: string | null = null;

        try {
            // --- Load Configuration ---
            const ashbyConfig = getAshbyConfig(source.config);
            if (!ashbyConfig || !ashbyConfig.jobBoardName) {
                sourceLogger.error('❌ Missing or invalid jobBoardName in source config');
                stats.errors++;
                return { stats, foundSourceIds };
            }
            
            jobBoardName = String(ashbyConfig.jobBoardName);
            // Use the officially documented public API endpoint
            apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${jobBoardName}`;
            sourceLogger.info({ jobBoardName, apiUrl }, `-> Starting processing...`); // Log the full URL

            // --- Fetch Jobs ---
            sourceLogger.debug({ apiUrl }, 'Fetching jobs from Ashby API...');
            // Removed Accept header as it might not be needed for this public endpoint
            const response = await axios.get<AshbyApiResponse>(apiUrl, { 
                timeout: 45000
            });

            // Log the raw response data for debugging
            sourceLogger.trace({ rawResponseData: response.data }, 'Raw response received from Ashby API');

            if (!response.data || !Array.isArray(response.data.jobs)) {
                sourceLogger.error(
                    { responseStatus: response.status, responseData: response.data }, 
                    '❌ Invalid response structure from Ashby API'
                );
                stats.errors++;
                return { stats, foundSourceIds };
            }
            
            const apiJobs = response.data.jobs;
            stats.found = apiJobs.length;
            
            // Extract jobUrl as the unique sourceId
            apiJobs.forEach(job => {
                if (job.jobUrl) {
                    foundSourceIds.add(job.jobUrl);
                }
            });
            
            sourceLogger.info(`+ ${stats.found} jobs found in API response.`);

            if (apiJobs.length === 0) {
                sourceLogger.info('No jobs found for this source.');
                return { stats, foundSourceIds };
            }
            
            sourceLogger.trace(
                { sampleJobId: apiJobs[0]?.jobUrl, sampleJobTitle: apiJobs[0]?.title }, 
                'Sample job structure check'
            );

            // --- Process Jobs ---
            sourceLogger.debug(`Processing ${apiJobs.length} jobs...`);
            await pMap(apiJobs, async (job: AshbyApiJob) => {
                const jobLogger = sourceLogger.child({ 
                    jobId: job.jobUrl, 
                    jobTitle: job.title 
                });
                
                try {
                    // Pass the job to the processor adapter
                    const saved = await this.jobProcessor.processRawJob('ashby', job, source);

                    if (saved) {
                        stats.processed++;
                        stats.relevant++; // In Ashby fetcher, we count processed jobs as relevant
                        jobLogger.debug('Job processed/saved via adapter.');
                    } else {
                        jobLogger.warn('Adapter reported job not saved (processor failure, duplicate, irrelevant post-processing, or save issue).');
                    }
                } catch (jobError: any) {
                    stats.errors++;
                    const errorDetails = {
                        message: jobError?.message,
                        stack: jobError?.stack?.split('\n').slice(0, 5).join('\n'), // Limit stack trace
                        name: jobError?.name,
                    };
                    
                    jobLogger.error({ error: errorDetails }, 
                        '❌ Error processing individual job or calling adapter'
                    );
                }
            }, { concurrency: 5, stopOnError: false });

            sourceLogger.info(`✓ Processing completed.`);

        } catch (error) {
            stats.errors++;
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError;
                sourceLogger.error(
                    { 
                        status: axiosError.response?.status, 
                        code: axiosError.code, 
                        message: axiosError.message, 
                        url: apiUrl 
                    },
                    `❌ Axios error fetching jobs for source`
                );
            } else {
                const genericError = error as Error;
                sourceLogger.error({ 
                    error: { 
                        message: genericError.message, 
                        name: genericError.name, 
                        stack: genericError.stack?.split('\n').slice(0, 5).join('\n') 
                    }, 
                    jobBoardName, 
                    apiUrl 
                }, '❌ General error processing source');
            }
        }

        return { stats, foundSourceIds };
    }
} 