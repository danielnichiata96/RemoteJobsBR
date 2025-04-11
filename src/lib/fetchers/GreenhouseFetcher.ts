import axios, { AxiosError } from 'axios';
import { decode } from 'html-entities';
import { PrismaClient, JobSource, JobStatus, JobType, ExperienceLevel } from '@prisma/client';
import pMap from 'p-map';
import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';
import { JobProcessingAdapter } from '../adapters/JobProcessingAdapter';
import { FilterConfig, FilterMetadataConfig, getGreenhouseConfig } from '../../types/JobSource'; // Adjust path
import { StandardizedJob } from '../../types/StandardizedJob'; // Adjust path
import { extractSkills, detectJobType, detectExperienceLevel } from '../utils/jobUtils';
import { JobFetcher, SourceStats, FetcherResult } from './types';

// --- Greenhouse Specific Interfaces ---
interface GreenhouseOffice {
    id: number;
    name: string;
    location: string;
}
interface GreenhouseMetadata {
    id: number;
    name: string;
    value: string | string[] | null;
}
interface GreenhouseJob {
    id: number;
    title: string;
    updated_at: string;
    location: { name: string };
    content: string;
    absolute_url: string;
    metadata: GreenhouseMetadata[];
    offices: GreenhouseOffice[];
    departments: Array<{ name: string }>;
    company?: { name: string };
}
interface FilterResult {
    relevant: boolean;
    reason: string;
    type?: 'global' | 'latam';
}

export class GreenhouseFetcher implements JobFetcher {
    private prisma: PrismaClient;
    private jobProcessor: JobProcessingAdapter;

    constructor(prismaClient: PrismaClient, jobProcessingAdapter: JobProcessingAdapter) {
        this.prisma = prismaClient;
        this.jobProcessor = jobProcessingAdapter;
    }

    async processSource(source: JobSource, parentLogger: pino.Logger): Promise<FetcherResult> {
        const sourceLogger = parentLogger.child({ fetcher: 'Greenhouse', sourceName: source.name, sourceId: source.id });
        const stats: SourceStats = { found: 0, relevant: 0, processed: 0, deactivated: 0, errors: 0 }; // Deactivated will be handled by orchestrator
        const foundSourceIds = new Set<string>();
        let filterConfig: FilterConfig | null = null;
        let boardToken: string | null = null;
        let apiUrl: string | null = null;

        try {
            // --- Load Configuration ---
            const greenhouseConfig = getGreenhouseConfig(source.config);
            if (!greenhouseConfig || !greenhouseConfig.boardToken) {
                sourceLogger.error('❌ Missing or invalid boardToken in source config');
                stats.errors++;
                return { stats, foundSourceIds }; // Return early
            }
            boardToken = greenhouseConfig.boardToken;
            apiUrl = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
            sourceLogger.info({ boardToken }, `-> Starting processing...`);

            try {
                const configPath = path.resolve(__dirname, '../../config/greenhouse-filter-config.json');
                const configFile = fs.readFileSync(configPath, 'utf-8');
                filterConfig = JSON.parse(configFile) as FilterConfig;
                sourceLogger.info({ configPath }, `Successfully loaded filter configuration`);
            } catch (error: any) {
                sourceLogger.error({ err: error, configPath: path.resolve(__dirname, '../../config/greenhouse-filter-config.json') }, `❌ Failed to load or parse filter configuration. Aborting.`);
                stats.errors++;
                return { stats, foundSourceIds };
            }

            // --- Fetch Jobs --- 
            sourceLogger.debug({ apiUrl }, 'Fetching jobs from Greenhouse API...');
            const response = await axios.get(apiUrl, { timeout: 45000 });

            if (!response.data || !Array.isArray(response.data.jobs)) {
                sourceLogger.error({ responseStatus: response.status, responseData: response.data }, '❌ Invalid response structure from Greenhouse API');
                stats.errors++;
                return { stats, foundSourceIds };
            }
            const apiJobs: GreenhouseJob[] = response.data.jobs;
            stats.found = apiJobs.length;
            apiJobs.forEach(job => foundSourceIds.add(String(job.id))); // Collect all found IDs
            sourceLogger.info(`+ ${stats.found} jobs found in API response.`);
            
            if (apiJobs.length > 0) {
                sourceLogger.trace({ sampleJobId: apiJobs[0].id, sampleJobTitle: apiJobs[0].title }, 'Sample job structure check');
            }

            // --- Process Jobs --- 
            sourceLogger.debug(`Processing ${apiJobs.length} jobs for relevance...`);
            await pMap(apiJobs, async (job) => {
                try {
                    const relevanceResult = this._isJobRelevant(job, filterConfig!); // Use private method
                    if (relevanceResult.relevant) {
                        stats.relevant++;
                        sourceLogger.info(
                            { jobId: job.id, jobTitle: job.title, reason: relevanceResult.reason, type: relevanceResult.type },
                            `➡️ Relevant job found`
                        );

                        const sections = this._extractSectionsFromContent(job.content);
                        const companyName = job.company?.name || source.name;

                        const standardizedJobData: StandardizedJob = {
                            source: 'greenhouse',
                            sourceId: `${job.id}`,
                            title: job.title,
                            description: job.content, // Store raw HTML initially?
                            applicationUrl: job.absolute_url,
                            companyName: companyName,
                            location: relevanceResult.type === 'latam' ? 'Remote - Latin America' : 'Remote - Worldwide',
                            requirements: sections.requirements,
                            responsibilities: sections.responsibilities,
                            benefits: sections.benefits,
                            publishedAt: new Date(job.updated_at),
                            updatedAt: new Date(job.updated_at),
                            status: JobStatus.ACTIVE,
                            company: { // Assuming we have a company relation to connect
                                connectOrCreate: {
                                    where: { name: companyName }, // Need a unique constraint on company name?
                                    create: { name: companyName },
                                }
                            },
                            // Fields needing detection/defaults
                            jobType: detectJobType(job.title, job.content),
                            experienceLevel: detectExperienceLevel(job.title, job.content),
                            skills: extractSkills(job.content),
                            tags: extractSkills(job.content),
                            country: relevanceResult.type === 'latam' ? 'LATAM' : 'Worldwide',
                            workplaceType: 'REMOTE'
                        };

                        const saved = await this.jobProcessor.processAndSaveJob(standardizedJobData);
                        if (saved) {
                            stats.processed++;
                            sourceLogger.debug({ jobId: job.id }, 'Job processed/saved by service.');
                        } else {
                            sourceLogger.warn({ jobId: job.id, jobTitle: job.title }, 'Job relevant but not saved/updated by service (likely duplicate or internal issue).');
                        }
                    } else {
                        sourceLogger.trace({ jobId: job.id, jobTitle: job.title, reason: relevanceResult.reason }, `Job skipped as irrelevant`);
                    }
                } catch (jobError) {
                    stats.errors++;
                    sourceLogger.error({ jobId: job.id, jobTitle: job?.title, error: jobError }, '❌ Error processing individual job');
                }
            }, { concurrency: 5, stopOnError: false });

            sourceLogger.info(`✓ Processing completed.`);

        } catch (error) {
            stats.errors++;
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError;
                sourceLogger.error(
                    { status: axiosError.response?.status, data: axiosError.response?.data, message: axiosError.message, apiUrl },
                    `❌ Axios error fetching jobs for source`
                );
            } else {
                sourceLogger.error({ error, boardToken, apiUrl }, '❌ General error processing source');
            }
        }

        return { stats, foundSourceIds };
    }

    // --- Private Helper Methods (Moved from script) ---

    private _includesKeyword(text: string, keywords: string[]): boolean {
        if (!text || !keywords) return false;
        const lowerText = text.toLowerCase();
        return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
    }

    private _checkMetadataForRemoteness(metadata: GreenhouseMetadata[], filterConfig: FilterConfig): 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN' {
        const fieldsToCheck = filterConfig.REMOTE_METADATA_FIELDS;
        if (!metadata || metadata.length === 0 || !fieldsToCheck) return 'UNKNOWN';
        let decision: 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN' = 'UNKNOWN';
        for (const item of metadata) {
            if (!item || !item.name || !item.value) continue;
            const fieldNameLower = item.name.toLowerCase();
            const config = fieldsToCheck[fieldNameLower];
            if (config) {
                const valueLower = typeof item.value === 'string' ? item.value.toLowerCase() : null;
                const valueArrayLower = Array.isArray(item.value) ? item.value.map(v => v.toLowerCase()) : null;
                if (config.type === 'boolean') {
                    if (valueLower === config.positiveValue?.toLowerCase()) {
                        decision = 'ACCEPT_GLOBAL';
                    } else if (valueLower && valueLower !== config.positiveValue?.toLowerCase()) {
                        return 'REJECT';
                    }
                } else if (config.type === 'string') {
                    const currentValues = valueLower ? [valueLower] : valueArrayLower;
                    if (!currentValues) continue;
                    if (config.allowedValues) {
                        const lowerAllowed = config.allowedValues.map(v => v.toLowerCase());
                        if (currentValues.some(v => lowerAllowed.includes(v))) {
                            if (currentValues.some(v => v.includes('latam') || v.includes('americas'))) {
                                decision = 'ACCEPT_LATAM';
                            } else {
                                decision = 'ACCEPT_GLOBAL';
                            }
                        } // No immediate rejection if not in allowedValues
                    }
                    if (config.positiveValues) {
                        const lowerPositive = config.positiveValues.map(v => v.toLowerCase());
                        if (currentValues.some(v => lowerPositive.includes(v))) {
                            if (currentValues.some(v => v.includes('latam') || v.includes('americas'))) {
                                decision = 'ACCEPT_LATAM';
                            } else {
                                decision = 'ACCEPT_GLOBAL';
                            }
                        }
                    }
                    if (config.disallowedValues) {
                        const lowerDisallowed = config.disallowedValues.map(v => v.toLowerCase());
                        if (currentValues.some(v => lowerDisallowed.includes(v))) {
                            return 'REJECT';
                        }
                    }
                }
            }
            if (decision !== 'UNKNOWN') break;
        }
        return decision;
    }

    private _checkLocationName(locationName: string, filterConfig: FilterConfig): 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN' {
        if (!locationName) return 'UNKNOWN';
        const lowerLocation = locationName.toLowerCase().trim();
        const keywords = filterConfig.LOCATION_KEYWORDS;
        if (this._includesKeyword(lowerLocation, keywords.STRONG_NEGATIVE_RESTRICTION)) return 'REJECT';
        if (this._includesKeyword(lowerLocation, keywords.STRONG_POSITIVE_LATAM)) return 'ACCEPT_LATAM';
        if (this._includesKeyword(lowerLocation, keywords.STRONG_POSITIVE_GLOBAL)) return 'ACCEPT_GLOBAL';
        if (keywords.AMBIGUOUS && keywords.AMBIGUOUS.some(kw => lowerLocation === kw.toLowerCase())) return 'UNKNOWN';
        if (!lowerLocation.includes('remote')) return 'REJECT';
        return 'UNKNOWN';
    }

    private _checkContentKeywords(title: string, content: string, filterConfig: FilterConfig): 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN' {
        if (!content && !title) return 'UNKNOWN';
        const lowerContent = (content || '').toLowerCase();
        const lowerTitle = (title || '').toLowerCase();
        const fullText = `${lowerTitle} ${lowerContent}`;
        const keywords = filterConfig.CONTENT_KEYWORDS;
        if (keywords.STRONG_NEGATIVE_TIMEZONE && this._includesKeyword(fullText, keywords.STRONG_NEGATIVE_TIMEZONE)) return 'REJECT';
        if (keywords.STRONG_NEGATIVE_REGION && this._includesKeyword(fullText, keywords.STRONG_NEGATIVE_REGION)) return 'REJECT';
        if (keywords.STRONG_POSITIVE_LATAM && this._includesKeyword(fullText, keywords.STRONG_POSITIVE_LATAM)) return 'ACCEPT_LATAM';
        if (keywords.STRONG_POSITIVE_GLOBAL && this._includesKeyword(fullText, keywords.STRONG_POSITIVE_GLOBAL)) return 'ACCEPT_GLOBAL';
        return 'UNKNOWN';
    }

    private _isJobRelevant(job: GreenhouseJob, filterConfig: FilterConfig): FilterResult {
        const { title, location, content, metadata } = job;
        const locationName = location?.name || '';
        const cleanContent = this._processJobContent(content || '');

        const metadataResult = this._checkMetadataForRemoteness(metadata || [], filterConfig);
        if (metadataResult === 'ACCEPT_GLOBAL') return { relevant: true, reason: 'Metadata indicates global remote', type: 'global' };
        if (metadataResult === 'ACCEPT_LATAM') return { relevant: true, reason: 'Metadata indicates LATAM remote', type: 'latam' };
        if (metadataResult === 'REJECT') return { relevant: false, reason: 'Metadata indicates non-remote or excluded region' };

        const locationResult = this._checkLocationName(locationName, filterConfig);
        if (locationResult === 'ACCEPT_GLOBAL') return { relevant: true, reason: 'Location indicates global remote', type: 'global' };
        if (locationResult === 'ACCEPT_LATAM') return { relevant: true, reason: 'Location indicates LATAM remote', type: 'latam' };
        if (locationResult === 'REJECT') return { relevant: false, reason: 'Location indicates non-remote or excluded region' };

        const contentResult = this._checkContentKeywords(title, cleanContent, filterConfig);
        if (contentResult === 'ACCEPT_GLOBAL') return { relevant: true, reason: 'Content keywords indicate global remote', type: 'global' };
        if (contentResult === 'ACCEPT_LATAM') return { relevant: true, reason: 'Content keywords indicate LATAM remote', type: 'latam' };
        if (contentResult === 'REJECT') return { relevant: false, reason: 'Content keywords indicate non-remote or excluded region/timezone' };

        return { relevant: false, reason: 'Could not determine relevance (defaulting to irrelevant)' };
    }

    private _processJobContent(content: string): string {
        if (!content) return '';
        try {
            let processedContent = decode(content);
            processedContent = processedContent
                .replace(/(\r\n|\n|\r){3,}/g, '\n\n')
                .replace(/<p>\s*(&nbsp;|\s)*\s*<\/p>/gi, '')
                .replace(/<br\s*\/?>(?:\s*<br\s*\/?>)+/gi, '<br>') // Collapse multiple <br>
                .replace(/<strong\s*>\s*<\/strong>/gi, '') // Remove empty <strong>
                .replace(/<em\s*>\s*<\/em>/gi, '') // Remove empty <em>
                .replace(/<ul\s*>\s*<\/ul>/gi, '') // Remove empty <ul>
                .replace(/<ol\s*>\s*<\/ol>/gi, '') // Remove empty <ol>
                .replace(/<div\s*>\s*<\/div>/gi, '') // Remove empty <div>
                .replace(/\s{2,}/g, ' ') // Replace multiple spaces with single space
                .trim();
            return processedContent;
        } catch (error) {
            // Log error but return original content? Or empty string?
            // Consider logging with job ID if available in context
            console.error("Error processing job content:", error);
            return content; // Return original on error for now
        }
    }

    private _extractSectionsFromContent(content: string): { requirements: string, responsibilities: string, benefits: string } {
        const sections = {
            requirements: '',
            responsibilities: '',
            benefits: '',
        };
        if (!content) return sections;

        // Basic extraction based on common headings (case-insensitive)
        // This needs refinement for robustness
        const reqMatch = content.match(/<(?:h[1-6]|strong|b)>\s*(requirements|qualifications|needed|experience|you have|you need|necess[aá]rio|requisitos)[^<]*<\/(?:h[1-6]|strong|b)>([\s\S]*?)(?:<(?:h[1-6]|strong|b)>|$)/i);
        if (reqMatch && reqMatch[2]) {
            sections.requirements = this._cleanExtractedSection(reqMatch[2]);
        }

        const respMatch = content.match(/<(?:h[1-6]|strong|b)>\s*(responsibilities|role|duties|you will do|what you['']ll do|suas fun[cç][oõ]es|atividades)[^<]*<\/(?:h[1-6]|strong|b)>([\s\S]*?)(?:<(?:h[1-6]|strong|b)>|$)/i);
        if (respMatch && respMatch[2]) {
            sections.responsibilities = this._cleanExtractedSection(respMatch[2]);
        }

        const benMatch = content.match(/<(?:h[1-6]|strong|b)>\s*(benefits|perks|what we offer|oferecemos|benef[ií]cios)[^<]*<\/(?:h[1-6]|strong|b)>([\s\S]*?)(?:<(?:h[1-6]|strong|b)>|$)/i);
        if (benMatch && benMatch[2]) {
            sections.benefits = this._cleanExtractedSection(benMatch[2]);
        }

        // Fallback if specific sections aren't found (less ideal)
        if (!sections.requirements && !sections.responsibilities && !sections.benefits) {
            // Could try splitting content or just assign all to description?
        }

        return sections;
    }

    private _cleanExtractedSection(htmlContent: string): string {
        // Remove leading/trailing whitespace and potentially unwanted tags
        let cleaned = htmlContent.trim();
        // Example: Remove potential leading/trailing list tags if they are the immediate wrappers
        cleaned = cleaned.replace(/^\s*<\/?(?:ul|ol)[^>]*>/i, '').replace(/<\/?(?:ul|ol)[^>]*>\s*$/i, '');
        return cleaned.trim();
    }
} 