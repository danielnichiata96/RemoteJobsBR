import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import pino from 'pino';
import { JobProcessor, StandardizedJob, ProcessedJobResult } from './types';
import {
    extractSkills,
    cleanHtml,
    detectJobType,
    detectExperienceLevel,
    parseSections,
    isRemoteJob, // We can reuse this or create a Lever-specific check
} from '../utils/jobUtils';
import { JobStatus } from '@prisma/client';

// Define the input structure expected from LeverFetcher
interface LeverBasicJobData {
    sourceId: string;
    title: string;
    applicationUrl: string;
    location: string; // Snippet from the main list
    department?: string; // Optional
    companyName: string;
}

export class LeverProcessor implements JobProcessor {
    source = 'lever';

    async processJob(rawJobData: LeverBasicJobData, logger: pino.Logger): Promise<ProcessedJobResult> {
        const jobLogger = logger.child({ processor: 'Lever', jobId: rawJobData.sourceId, jobTitle: rawJobData.title });
        jobLogger.info(`Processing job details from URL: ${rawJobData.applicationUrl}`);

        try {
            // --- Fetch Individual Job Page HTML --- 
            jobLogger.debug('Fetching individual job page HTML...');
            const response = await axios.get(rawJobData.applicationUrl, {
                timeout: 30000, // Shorter timeout for individual page
                headers: { // Mimic browser headers again
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                }
            });

            if (response.status !== 200 || !response.data) {
                jobLogger.error({ status: response.status }, '❌ Failed to fetch individual job page HTML');
                return { success: false, error: `Failed to fetch job page HTML (Status: ${response.status})` };
            }

            // --- Parse Full Job Description --- 
            const html = response.data;
            const $ = cheerio.load(html);

            // Extract main content - Selectors might need refinement!
            // Lever often uses sections with classes like 'section-wrapper' or specific IDs.
            // Let's try a common structure.
            let descriptionHtml = $('div[data-qa="job-description"]').html() || 
                                  $('.content .section-wrapper').html() || // Try another common pattern
                                  $('body').html(); // Fallback to body if specific selectors fail

            if (!descriptionHtml) {
                jobLogger.warn('⚠️ Could not extract description HTML using known selectors. Using full body as fallback.');
                descriptionHtml = $('body').html() || ''; // Ensure it's a string
            }

            const cleanContent = cleanHtml(descriptionHtml);
            const sections = parseSections(cleanContent);
            const skills = extractSkills(cleanContent);

            // --- Basic Relevance Check (Example: Location) --- 
            // Re-use or adapt the isRemoteJob check based on initial location snippet and full content
            if (!isRemoteJob(rawJobData.location, cleanContent)) {
                jobLogger.info('Skipping job - determined not remote based on location/content.');
                return { success: false, error: 'Job is not remote or has location restrictions' };
            }
            
            // --- Standardize Data --- 
            const standardizedJob: StandardizedJob = {
                sourceId: rawJobData.sourceId,
                source: this.source,
                title: rawJobData.title,
                description: sections.description, // Use the main parsed description
                requirements: sections.requirements,
                responsibilities: sections.responsibilities,
                benefits: sections.benefits,
                jobType: detectJobType(rawJobData.title, cleanContent),
                experienceLevel: detectExperienceLevel(rawJobData.title, cleanContent),
                skills: skills,
                tags: [...skills], // Default tags to skills
                location: rawJobData.location, // Use the initially extracted location snippet for now
                country: 'Worldwide', // Placeholder - enhance location analysis later if needed
                workplaceType: 'REMOTE', // Assume remote based on earlier check
                applicationUrl: rawJobData.applicationUrl,
                companyName: rawJobData.companyName,
                // Lever doesn't provide these easily from scraping
                companyEmail: null,
                companyLogo: null,
                companyWebsite: null,
                // Dates are often absent or hard to parse reliably from Lever HTML
                updatedAt: new Date(), 
                publishedAt: new Date(), // Use current date as fallback
                // Required fields from StandardizedJob that might need defaults
                status: JobStatus.ACTIVE, // Assuming jobs found are active
                salaryMin: null, 
                salaryMax: null,
                salaryCurrency: null,
                salaryPeriod: null,
                company: { // Link to company based on name
                    connectOrCreate: {
                        where: { name: rawJobData.companyName },
                        create: { name: rawJobData.companyName },
                    }
                },
            };

            jobLogger.info('Successfully processed job details.');
            return {
                success: true,
                job: standardizedJob
            };

        } catch (error) {
            jobLogger.error({ error }, '❌ Error processing individual job page');
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError;
                 return { success: false, error: `Axios error fetching job page: ${axiosError.message}` };
            } else if (error instanceof Error) {
                 return { success: false, error: error.message };
            } else {
                return { success: false, error: 'Unknown error processing job page' };
            }
        }
    }
} 