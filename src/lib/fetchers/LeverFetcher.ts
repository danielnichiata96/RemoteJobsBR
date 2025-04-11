import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import { PrismaClient, JobSource, JobStatus } from '@prisma/client';
import pMap from 'p-map';
import pino from 'pino';
import { JobProcessingAdapter } from '../adapters/JobProcessingAdapter';
import { getLeverConfig } from '../../types/JobSource'; 
import { StandardizedJob } from '../../types/StandardizedJob';
import { JobFetcher, SourceStats, FetcherResult } from './types';
import { detectJobType, detectExperienceLevel, extractSkills } from '../utils/jobUtils';

// Lever typically doesn't expose structured data like Greenhouse
// We will need to parse HTML using cheerio

export class LeverFetcher implements JobFetcher {
    private prisma: PrismaClient;
    private jobProcessor: JobProcessingAdapter;

    constructor(prismaClient: PrismaClient, jobProcessingAdapter: JobProcessingAdapter) {
        this.prisma = prismaClient;
        this.jobProcessor = jobProcessingAdapter;
    }

    async processSource(source: JobSource, parentLogger: pino.Logger): Promise<FetcherResult> {
        const sourceLogger = parentLogger.child({ fetcher: 'Lever', sourceName: source.name, sourceId: source.id });
        const stats: SourceStats = { found: 0, relevant: 0, processed: 0, deactivated: 0, errors: 0 }; 
        const foundSourceIds = new Set<string>();
        let leverCompanyId: string | null = null;
        let apiUrl: string | null = null;

        try {
            // --- Load Configuration --- 
            const leverConfig = getLeverConfig(source.config);
            if (!leverConfig || !leverConfig.companyIdentifier) {
                sourceLogger.error('❌ Missing or invalid companyIdentifier in source config');
                stats.errors++;
                return { stats, foundSourceIds }; // Return early
            }
            leverCompanyId = leverConfig.companyIdentifier;
            apiUrl = `https://jobs.lever.co/${leverCompanyId}`;
            sourceLogger.info({ leverCompanyId, apiUrl }, `-> Starting processing...`);

            // --- Fetch HTML Page --- 
            sourceLogger.debug({ apiUrl }, 'Fetching HTML from Lever job board...');
            const response = await axios.get(apiUrl, { 
                timeout: 45000,
                headers: { 
                    // Add headers to mimic a browser visit, which might help
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'Accept-Language': 'en-US,en;q=0.9',
                }
            });

            if (response.status !== 200 || !response.data) {
                sourceLogger.error({ responseStatus: response.status, url: apiUrl }, '❌ Failed to fetch HTML from Lever board');
                stats.errors++;
                return { stats, foundSourceIds };
            }

            // --- Parse HTML --- 
            const html = response.data;
            const $ = cheerio.load(html);

            // Identify job postings - Selector might need adjustment!
            // Lever commonly uses elements like `.posting` or similar list structures.
            // Let's start with a common selector and refine later.
            const jobPostingSelector = '.posting'; 
            const jobElements = $(jobPostingSelector);
            stats.found = jobElements.length;
            sourceLogger.info(`+ ${stats.found} potential job postings found via selector '${jobPostingSelector}'.`);

            if (stats.found === 0) {
                sourceLogger.warn(
                    { url: apiUrl, selector: jobPostingSelector }, 
                    `⚠️ No job postings found using the selector. The page structure might have changed or the selector is incorrect.`
                );
                // Optionally, log a snippet of the HTML for debugging if needed
                // sourceLogger.trace({ htmlSnippet: html.substring(0, 500) }, "HTML Snippet");
            }

            // --- Process Found Postings (Initial Draft) --- 
            sourceLogger.debug(`Processing ${stats.found} potential jobs...`);
            const jobsToProcess: any[] = []; // Temporarily hold extracted data

            jobElements.each((_index, element) => {
                try {
                    const jobElement = $(element);
                    
                    // Extract link (usually the main link of the posting)
                    const jobLinkElement = jobElement.find('a.posting-title').first(); // Common pattern
                    const relativeUrl = jobLinkElement.attr('href');
                    if (!relativeUrl) {
                        sourceLogger.warn('Skipping posting - could not find job link.');
                        return; // Continue to next element
                    }
                    const applicationUrl = new URL(relativeUrl, apiUrl).toString(); // Construct absolute URL
                    
                    // Extract title (often within the link)
                    const title = jobLinkElement.find('.posting-name').text().trim(); // Common pattern
                    
                    // Extract location/department (often in sibling/child elements)
                    // Example selectors - **HIGHLY LIKELY TO NEED ADJUSTMENT PER COMPANY**
                    const locationElement = jobElement.find('.posting-categories .location').first();
                    const location = locationElement.text().trim();
                    const departmentElement = jobElement.find('.posting-categories .department').first();
                    const department = departmentElement.text().trim(); // May be useful for filtering/categorization

                    // Extract Job ID from URL (Lever URLs usually end with the ID)
                    const urlParts = relativeUrl.split('/');
                    const sourceId = urlParts.pop() || urlParts.pop(); // Handle potential trailing slash

                    if (!title || !applicationUrl || !sourceId) {
                        sourceLogger.warn({ extracted: { title, applicationUrl, sourceId }}, 'Skipping posting - missing essential data.');
                        return; // Continue
                    }

                    // Add the extracted ID to our set
                    foundSourceIds.add(sourceId);

                    // Store minimal data for now - processing will happen in LeverProcessor
                    jobsToProcess.push({
                        sourceId,
                        title,
                        applicationUrl,
                        location, 
                        department, 
                        companyName: source.name // Use the source name as default
                    });
                    
                } catch (extractError) {
                    stats.errors++;
                    sourceLogger.error({ error: extractError, elementIndex: _index }, '❌ Error extracting data from individual job element');
                }
            });

            sourceLogger.info(`+ ${jobsToProcess.length} jobs successfully extracted basic info.`);
            stats.relevant = jobsToProcess.length; // For now, assume all extracted are relevant; filtering happens later?

            // --- Hand off to Job Processor --- 
            sourceLogger.info(`Handing off ${jobsToProcess.length} jobs to the processor...`);
            await pMap(jobsToProcess, async (jobData) => {
                 try {
                    // Call the adapter with the raw data for this source
                    // The adapter will select the LeverProcessor internally
                    const saved = await this.jobProcessor.processRawJob('lever', jobData);
                    
                    if (saved) {
                        stats.processed++;
                        sourceLogger.debug({ jobId: jobData.sourceId }, 'Job processed/saved via adapter.');
                    } else {
                        // Error/skip logging is handled within the adapter/processor now
                        sourceLogger.warn({ jobId: jobData.sourceId, jobTitle: jobData.title }, 'Adapter reported job not saved (processor failure, irrelevant, or save issue).');
                    }
                 } catch (jobError) { // Catch errors during the adapter call itself
                     stats.errors++;
                     sourceLogger.error({ jobId: jobData.sourceId, jobTitle: jobData.title, error: jobError }, '❌ Unhandled error calling JobProcessingAdapter.processRawJob');
                 }
            }, { concurrency: 5, stopOnError: false });

            sourceLogger.info(`✓ Processing completed.`);

        } catch (error) {
            stats.errors++;
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError;
                sourceLogger.error(
                    { status: axiosError.response?.status, data: axiosError.response?.data, message: axiosError.message, apiUrl },
                    `❌ Axios error fetching HTML for source`
                );
            } else {
                sourceLogger.error({ error, leverCompanyId, apiUrl }, '❌ General error processing source');
            }
        }

        return { stats, foundSourceIds };
    }
} 