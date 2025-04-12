import axios, { AxiosError } from 'axios';
import { decode } from 'html-entities';
import { PrismaClient, JobSource, JobStatus, JobType, ExperienceLevel } from '@prisma/client';
import pMap from 'p-map';
import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';
import sanitizeHtml from 'sanitize-html';
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
    _determinedHiringRegionType?: 'global' | 'latam';
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
                    const relevanceResult = this._isJobRelevant(job, filterConfig!, sourceLogger);
                    if (relevanceResult.relevant) {
                        stats.relevant++;
                        sourceLogger.info(
                            { jobId: job.id, jobTitle: job.title, reason: relevanceResult.reason, type: relevanceResult.type },
                            `➡️ Relevant job found`
                        );

                        // Enhance the job object with the determined hiring region type
                        const enhancedJob = {
                            ...job,
                            _determinedHiringRegionType: relevanceResult.type // Add the type here
                        };

                        // Pass the *enhanced* job object and the source details to the adapter
                        const saved = await this.jobProcessor.processRawJob('greenhouse', enhancedJob, source);
                        
                        if (saved) {
                            stats.processed++;
                            sourceLogger.debug({ jobId: job.id }, 'Job processed/saved via adapter.');
                        } else {
                            // Logging handled within adapter/processor
                             sourceLogger.warn({ jobId: job.id, jobTitle: job.title }, 'Adapter reported job not saved (processor failure, irrelevant, or save issue).');
                        }
                    } else {
                        sourceLogger.trace({ jobId: job.id, jobTitle: job.title, reason: relevanceResult.reason }, `Job skipped as irrelevant`);
                    }
                } catch (jobError: any) { // Catch errors during relevance check or adapter call
                    stats.errors++;
                    // Log more error details
                    const errorDetails = {
                        message: jobError?.message,
                        stack: jobError?.stack,
                        name: jobError?.name,
                        // Add other relevant properties if needed
                    };
                    sourceLogger.error({ 
                        jobId: job.id, 
                        jobTitle: job?.title, 
                        error: errorDetails // Log the extracted details
                    }, '❌ Error processing individual job or calling adapter');
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

    // --- Private Helper Methods ---

    // Function to normalize and check keywords (case-insensitive, substring match)
    // Use for positive keywords or where partial matches are acceptable.
    private _includesSubstringKeyword(text: string | null | undefined, keywords: string[]): boolean {
        if (!text) return false;
        const lowerText = text.toLowerCase();
        return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
    };

    // Function to check for specific keywords using word boundaries (case-insensitive)
    // Use for restrictive keywords (like countries 'us', 'uk') to avoid partial matches (e.g., 'us' in 'business').
    private _matchesKeywordRegex(text: string | null | undefined, keywords: string[]): boolean {
        if (!text || keywords.length === 0) return false;
        const lowerText = text.toLowerCase();
        // Escape special regex characters in keywords and join with '|'
        const pattern = new RegExp(`\\b(${keywords.map(kw =>
            kw.toLowerCase().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') // Escape regex chars
        ).join('|')})\\b`);
        return pattern.test(lowerText);
    }

    // Helper to process and clean job content for keyword checks
    private _processJobContent(content: string): string {
        if (!content) return '';
        try {
            let processedContent = decode(content); // Decode HTML entities first

            // Use sanitize-html to remove tags, keeping line breaks potentially important
            processedContent = sanitizeHtml(processedContent, {
                allowedTags: [], // Remove all tags
                allowedAttributes: {}, // Remove all attributes
                // Basic handling to maybe preserve some structure with line breaks
                // You might need more sophisticated options depending on content structure
                parseStyleAttributes: false,
                 nonTextTags: [ 'style', 'script', 'textarea', 'option' ],
                // Add options here if you want to preserve line breaks represented by <br>, <p>, etc.
                // e.g., allowedTags: ['br', 'p'], transformTags: { 'p': '\n', 'br': '\n' }
                // For now, stripping all tags might merge lines.
            });

            // Normalize whitespace after sanitization
            processedContent = processedContent
                .replace(/(\r\n|\n|\r|\u2028|\u2029){2,}/g, '\n') // Collapse multiple newlines/linebreaks
                .replace(/[ \t\u00A0]{2,}/g, ' ') // Collapse multiple spaces/tabs/nbsp
                .replace(/\n /g, '\n') // Remove space after newline
                .replace(/ \n/g, '\n') // Remove space before newline
                .trim();

            return processedContent;
        } catch (error) {
             // Use a logger if available and configured, otherwise fallback to console
             console.error('Error processing job content with sanitize-html:', error);
             // Fallback to basic regex stripping on error
             let fallbackContent = decode(content);
             // Replace dot (.) with [\s\S] to mimic dotAll (s flag) behavior without requiring ES2018 target
             fallbackContent = fallbackContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gm, ''); // Remove style blocks
             fallbackContent = fallbackContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gm, ''); // Remove script blocks
             fallbackContent = fallbackContent.replace(/<[^>]+>/g, ' '); // Replace all tags with spaces
             fallbackContent = fallbackContent.replace(/\s+/g, ' ').trim(); // Normalize whitespace
             return fallbackContent;
        }
    }

    // Check metadata (Remains largely unchanged, uses simple includes)
    private _checkMetadataForRemoteness(metadata: GreenhouseMetadata[], filterConfig: FilterConfig, logger: pino.Logger): 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN' {
        if (!metadata || metadata.length === 0 || !filterConfig.REMOTE_METADATA_FIELDS) return 'UNKNOWN';

        let hasLatamIndicator = false;
        let hasGlobalIndicator = false;
        let hasRejectionIndicator = false;

        for (const item of metadata) {
            const fieldNameLower = item.name?.toLowerCase() || '';
            // Find config entry matching the field name (case-insensitive)
            const configKey = Object.keys(filterConfig.REMOTE_METADATA_FIELDS).find(key => key === fieldNameLower);
            const config = configKey ? filterConfig.REMOTE_METADATA_FIELDS[configKey] : undefined;

            if (config) {
                const value = typeof item.value === 'string' ? item.value.toLowerCase() :
                              Array.isArray(item.value) ? item.value.map(v => v?.toLowerCase()).filter(Boolean) : // Handle string arrays
                              null;
                if (!value) continue;

                const checkValue = (val: string): void => {
                     switch (config.type) {
                        case 'boolean':
                            if ('positiveValue' in config && val === config.positiveValue?.toLowerCase()) {
                                hasGlobalIndicator = true; // Assume global unless specified otherwise
                            } else if ('negativeValue' in config && typeof config.negativeValue === 'string' && val === config.negativeValue.toLowerCase()) {
                                 hasRejectionIndicator = true;
                            } else {
                                 // If boolean but not matching positive/negative, could be reject or unknown based on field meaning
                                 // For simplicity, let's assume non-positive boolean means reject for 'remote eligible' style fields
                                 if (fieldNameLower === 'remote eligible') hasRejectionIndicator = true;
                            }
                            break;
                        case 'string':
                             if ('disallowedValues' in config && config.disallowedValues?.some(disallowed => val.includes(disallowed.toLowerCase()))) {
                                hasRejectionIndicator = true;
                            }
                            // Check allowed values *before* positive values for more specific matching
                            if (!hasRejectionIndicator && 'allowedValues' in config && config.allowedValues?.some(allowed => val.includes(allowed.toLowerCase()))) {
                                const allowedValue = config.allowedValues.find(allowed => val.includes(allowed.toLowerCase()));
                                if (allowedValue) {
                                    if (['latam', 'americas'].includes(allowedValue.toLowerCase())) {
                                        hasLatamIndicator = true;
                                    } else if (['worldwide', 'global'].includes(allowedValue.toLowerCase())) {
                                         hasGlobalIndicator = true;
                                    } else {
                                         // If allowed but not global/latam (e.g., 'US'), treat as rejection
                                         hasRejectionIndicator = true;
                                    }
                                }
                            }
                            // Check positive values if no specific allowed match determined acceptance/rejection
                            else if (!hasLatamIndicator && !hasGlobalIndicator && !hasRejectionIndicator && 'positiveValues' in config && config.positiveValues?.some(positive => val.includes(positive.toLowerCase()))) {
                                 const positiveValue = config.positiveValues.find(positive => val.includes(positive.toLowerCase()));
                                 if (positiveValue) {
                                     if (['latam', 'americas'].includes(positiveValue.toLowerCase())) {
                                         hasLatamIndicator = true;
                                     } else {
                                         // Assume other positive values mean global
                                         hasGlobalIndicator = true;
                                     }
                                 }
                            }
                            break;
                    }
                };

                if (typeof value === 'string') {
                     checkValue(value);
                } else if (Array.isArray(value)) {
                     value.forEach(checkValue); // Check each value in the array
                }
            }
             // If we found a rejection signal, we can stop checking this metadata item
            if (hasRejectionIndicator) break;
        }

        // Decision priority: Reject > LATAM > Global
        if (hasRejectionIndicator) return 'REJECT';
        if (hasLatamIndicator) return 'ACCEPT_LATAM';
        if (hasGlobalIndicator) return 'ACCEPT_GLOBAL';

        return 'UNKNOWN'; // No conclusive indicators found
    }

    // Check location name AND offices (Simplified and Corrected Flow)
    private _checkLocationName(
        locationName: string | null | undefined,
        offices: GreenhouseOffice[] | null | undefined,
        filterConfig: FilterConfig,
        logger: pino.Logger
    ): 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN' {
        const nameLower = locationName?.toLowerCase().trim() ?? '';
        const keywords = filterConfig.LOCATION_KEYWORDS;
        const officeNames = (offices ?? []).map(o => o.name?.toLowerCase()).filter(Boolean);
        const acceptableLatamCountries = keywords.ACCEPT_EXACT_LATAM_COUNTRIES || [];
        const nonLatamLocations = keywords.STRONG_NEGATIVE_RESTRICTION || [];

        // 1. Explicit LATAM Acceptance (Direct Country or Remote + Country)
        if (acceptableLatamCountries.length > 0) {
            const latamCountryPattern = new RegExp(`^(${acceptableLatamCountries.join('|')})$`, 'i');
            if (latamCountryPattern.test(nameLower)) {
                logger.trace({ locationName }, 'Location accepted as LATAM (Direct Country Match from Config)');
                return 'ACCEPT_LATAM';
            }
            const remoteLatamCountryPattern = new RegExp(`remote.*\\b(${acceptableLatamCountries.join('|')})\\b`, 'i');
            if (remoteLatamCountryPattern.test(nameLower)) {
                 logger.trace({ locationName }, 'Location accepted as LATAM (Remote + Country Match from Config)');
                 return 'ACCEPT_LATAM';
             }
        }

        // 2. Explicit GLOBAL Acceptance (Keywords)
        if (this._includesSubstringKeyword(nameLower, keywords.STRONG_POSITIVE_GLOBAL || [])) {
            logger.trace({ locationName }, 'Location accepted as GLOBAL via keyword');
            return 'ACCEPT_GLOBAL';
        }

        // 3. Generic LATAM Acceptance (Keywords like "Remote Latam")
        if (this._includesSubstringKeyword(nameLower, keywords.STRONG_POSITIVE_LATAM || [])) {
            logger.trace({ locationName }, 'Location accepted as LATAM via keyword');
            return 'ACCEPT_LATAM';
        }

            // 4. Strong Rejection Check (Direct Negative or Remote-Negative Pattern)
            // Inserted here: If this matches, reject immediately.
            if (nonLatamLocations.length > 0) {
                // Check direct match
                const directNegativeMatch = nonLatamLocations.find(loc => this._matchesKeywordRegex(nameLower, [loc]));
                if (directNegativeMatch) {
                    logger.trace({ locationName, matchedNegativeLocation: directNegativeMatch }, 'Location rejected due to Direct Negative Keyword Match');
                    return 'REJECT';
                }
                // Check "Remote - [NegativeKeyword]" pattern
                const escapedLocations = nonLatamLocations.map(l => l.replace(/[-\/\\^$*+?.()|[\\]{}]/g, '\\$&'));
                const remoteNegativePattern = new RegExp(`^remote[\\s-]*(${escapedLocations.join('|')})\\b`, 'i');
                const remoteNegativeMatch = remoteNegativePattern.exec(nameLower);
                if (remoteNegativeMatch) {
                     const matchedNegativeTerm = remoteNegativeMatch[1];
                     logger.trace({ locationName, matchedNegativeLocation: matchedNegativeTerm }, 'Location rejected due to Remote - Negative Keyword Pattern');
                     return 'REJECT';
                }
            }
    
            // --- If not explicitly accepted or rejected by name pattern, check ambiguity/offices ---
    
            // 5. Check if potentially remote/ambiguous 
        const isPotentiallyRemoteOrAmbiguous = nameLower.includes('remote') || nameLower.includes('distributed') || (keywords.AMBIGUOUS && keywords.AMBIGUOUS.some(kw => nameLower === kw.toLowerCase()));

        // 6. Check Offices if Potentially Remote/Ambiguous
        if (isPotentiallyRemoteOrAmbiguous) {
            let officeCheckResult: 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN' = 'UNKNOWN';
            if (officeNames.length > 0) {
                 logger.trace({ locationName, officeNames }, 'Location name is potentially remote/ambiguous, checking offices...');
                 const hasLatamOffice = officeNames.some(officeName =>
                      this._includesSubstringKeyword(officeName, keywords.STRONG_POSITIVE_LATAM || []) ||
                      acceptableLatamCountries.some((country: string) => officeName.includes(country))
                 );
                 if (hasLatamOffice) {
                     logger.trace({ locationName, officeNames }, 'Office check accepted as LATAM');
                     officeCheckResult = 'ACCEPT_LATAM';
                 } else {
                      const hasOnlyRestrictedOffices = officeNames.every(officeName =>
                          this._matchesKeywordRegex(officeName, nonLatamLocations) // Use nonLatamLocations here
                      );
                       if (hasOnlyRestrictedOffices) {
                          logger.trace({ locationName, officeNames }, 'Office check rejected (all offices in restricted locations)');
                          officeCheckResult = 'REJECT';
                      } else {
                          logger.trace({ locationName, officeNames }, 'Office check inconclusive (no clear LATAM or exclusive restriction signal)');
                          officeCheckResult = 'UNKNOWN';
                      }
                 }
            } else {
                // No offices provided, treat as UNKNOWN
                logger.trace({ locationName }, 'Location potentially remote/ambiguous, but no office data provided.');
                officeCheckResult = 'UNKNOWN';
            }

            // --- Process Office Check Result ---
            if (officeCheckResult === 'REJECT') {
                return 'REJECT';
            }
            if (officeCheckResult === 'ACCEPT_LATAM') {
                 return 'ACCEPT_LATAM';
            }
            // If officeCheckResult is UNKNOWN (or no offices), defer to content check
            logger.trace({ locationName }, 'Location is potentially remote/ambiguous and office check inconclusive, deferring to content');
            return 'UNKNOWN';
        }

        // 7. Final Rejection (Default for non-remote/unspecified)
        // Reached only if: not explicitly LATAM/Global by name, not rejected by name pattern, AND not potentially remote/ambiguous.
        logger.trace({ locationName }, 'Location rejected as non-remote or unspecified (default final)');
        return 'REJECT';
    }

    // Check content keywords (Refactored with context)
    private _checkContentKeywords(title: string | null | undefined, content: string | null | undefined, filterConfig: FilterConfig, logger: pino.Logger): 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN' {
        if (!content && !title) return 'UNKNOWN';

        // Use the improved processing method
        const cleanContent = this._processJobContent(content || '');
        const titleLower = title?.toLowerCase() || '';
        // Combine title and cleaned content for broader search
        const fullText = `${titleLower}\n${cleanContent}`.toLowerCase(); // Use newline separator
        const keywords = filterConfig.CONTENT_KEYWORDS;
        const locationKeywords = filterConfig.LOCATION_KEYWORDS; // Need negative locations

        // --- Contextual Rejection (Phrases + Locations) ---
        const restrictionPhrases = [
            'must be located in', 'must reside in', 'eligible to work in', 'must be based in',
            'currently located in', 'currently residing in', 'position based in',
            'based in', 'located in', 'residing in', 'resident of', 'based out of',
            'authorized to work in', 'must possess work authorization for',
            'applicants must be residents of', 'open [only]? to candidates in', // Optional 'only'
            'position is based in', 'role is based in', 'this role is based in',
            'you must be located in', 'you must reside in', 'must work from',
            'requirement to live in', 'requirement to be based in',
            'local candidates only', 'domestic candidates only', 'restricted to residents of',
            // Add variants like: 'candidate must be in', 'hiring only in'
            'candidate must be in', 'hiring [only]? in', 'we can [only]? hire in',
            'will only consider applicants in', 'must be physically located in'
            // Add more as identified
        ];
        // Use the stricter regex matching for locations within the phrase check
        const negativeLocations = locationKeywords.STRONG_NEGATIVE_RESTRICTION; // From LOCATION_KEYWORDS

        if (negativeLocations && negativeLocations.length > 0) {
            // Escape special characters in phrases and locations
            const escapedPhrases = restrictionPhrases.map(p => p.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
            const escapedLocations = negativeLocations.map(l => l.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));

             // Build the pattern: (phrase) + optional space/punctuation + optional (the) + (location - word boundary)
             const pattern = new RegExp(
                 `(${escapedPhrases.join('|')})` + // Capture the phrase
                 `[\\s\\p{P}]*` +                  // Allow space or punctuation between phrase and location
                 `(?:the\\s+)?` +                  // Optional "the "
                 `(${escapedLocations.join('|')})\\b`, // Capture the location with word boundary
                 'i' // Case-insensitive
             );

             const match = pattern.exec(fullText);
             if (match) {
                 // Basic check to avoid rejecting if a positive LATAM keyword is very close by (e.g., "must be located in the US or LatAm")
                 // This is a simple heuristic and might need refinement. Look within a small window around the match.
                 const matchEndIndex = match.index + match[0].length;
                 const contextWindow = fullText.substring(matchEndIndex, matchEndIndex + 30); // Look 30 chars ahead
                 const mentionsLatamNearby = this._includesSubstringKeyword(contextWindow, keywords.STRONG_POSITIVE_LATAM);

                 if (!mentionsLatamNearby) {
                     logger.trace({ title, matchedPhrase: match[1], matchedLocation: match[2] }, 'Content rejected due to restriction phrase + negative location');
                     return 'REJECT';
                 } else {
                      logger.trace({ title, matchedPhrase: match[1], matchedLocation: match[2], contextWindow }, 'Potential rejection phrase found, but LATAM mentioned nearby. Deferring decision.');
                 }
             }
        }


        // --- Other Rejections (Timezone, Citizenship/Visa - Use Substring Match) ---
        const citizenshipVisaKeywords = [
             'us citizen', 'u.s. citizen', 'u.s. citizenship', 'us citizenship',
             'no visa sponsorship', 'sponsorship is not available', 'unable to provide sponsorship',
             'must have work authorization', // Careful: needs context, but often implies US/specific country
             'valid work authorization in the u.s.', // Be specific
             'green card', 'permanent resident' // Often US context
        ];
        // Use stricter Regex match for timezones to avoid partial matches like 'est' in 'latest'
        if (this._matchesKeywordRegex(fullText, keywords.STRONG_NEGATIVE_TIMEZONE) ||
            this._includesSubstringKeyword(fullText, citizenshipVisaKeywords)) {
             const reason = this._matchesKeywordRegex(fullText, keywords.STRONG_NEGATIVE_TIMEZONE)
                 ? 'Content includes STRONG_NEGATIVE_TIMEZONE keyword (Regex Match)'
                 : 'Content includes citizenship/sponsorship restriction';
             // Find the specific keyword that matched
             const matchedTimezone = this._matchesKeywordRegex(fullText, keywords.STRONG_NEGATIVE_TIMEZONE) 
                 ? keywords.STRONG_NEGATIVE_TIMEZONE.find(kw => this._matchesKeywordRegex(fullText, [kw]))
                 : undefined;
             const matchedCitizenship = this._includesSubstringKeyword(fullText, citizenshipVisaKeywords)
                 ? citizenshipVisaKeywords.find(kw => fullText.includes(kw.toLowerCase()))
                 : undefined;
             const matchedKeyword = matchedTimezone || matchedCitizenship;
             logger.trace({ title, reason, matchedKeyword }, 'Content rejected');
            return 'REJECT';
        }


        // --- Strong Acceptance (Prioritize LATAM - Use Substring Match) ---
        if (this._includesSubstringKeyword(fullText, keywords.STRONG_POSITIVE_LATAM)) {
            logger.trace({ title }, 'Content accepted as LATAM');
            return 'ACCEPT_LATAM';
        }
        if (this._includesSubstringKeyword(fullText, keywords.STRONG_POSITIVE_GLOBAL)) {
            logger.trace({ title }, 'Content accepted as GLOBAL');
            return 'ACCEPT_GLOBAL';
        }

        // No strong indicators found in content
        logger.trace({ title }, 'Content check inconclusive (UNKNOWN)');
        return 'UNKNOWN';
    }

     // Main relevance check function (Refined Logic)
    private _isJobRelevant(job: GreenhouseJob, filterConfig: FilterConfig, logger: pino.Logger): FilterResult {
        const title = job.title || '';
        const locationName = job.location?.name;
        const metadata = job.metadata;
        const content = job.content;
        const offices = job.offices; // Get offices
        const jobLogger = logger.child({ jobId: job.id, title });

        // 1. Check Metadata First
        const metadataCheck = this._checkMetadataForRemoteness(metadata, filterConfig, jobLogger);
        if (metadataCheck === 'REJECT') {
             jobLogger.debug(`Job rejected by Metadata`);
             return { relevant: false, reason: 'Metadata indicates Restriction' };
        }
        // Potential acceptance signal, but don't accept yet

        // 2. Check Location Name AND Offices (Passing offices now)
        const locationCheck = this._checkLocationName(locationName, offices, filterConfig, jobLogger);
        if (locationCheck === 'REJECT') {
            jobLogger.debug({ locationName, offices: offices?.map(o=>o.name) }, `Job rejected by Location Name / Office Analysis`);
            return { relevant: false, reason: `Location/Office indicates Restriction or is non-remote: "${locationName}" / Offices: ${offices?.map(o=>o.name).join(', ')}` };
        }
         // Potential acceptance signal, but don't accept yet

        // 3. Check Content Keywords (Contextual)
        const contentCheck = this._checkContentKeywords(title, content, filterConfig, jobLogger);
         if (contentCheck === 'REJECT') {
            jobLogger.debug(`Job rejected by Content Keywords`);
            return { relevant: false, reason: 'Content indicates Restriction (Region/Timezone/Citizenship)' };
        }
        // Potential acceptance signal

        // 4. Determine Acceptance based on priority if no rejection occurred
        // Prioritize LATAM from any source
        if (metadataCheck === 'ACCEPT_LATAM' || locationCheck === 'ACCEPT_LATAM' || contentCheck === 'ACCEPT_LATAM') {
            const reason = metadataCheck === 'ACCEPT_LATAM' ? 'Metadata(LATAM)' :
                           locationCheck === 'ACCEPT_LATAM' ? 'Location/Office(LATAM)' : 'Content(LATAM)';
            jobLogger.debug(`Job accepted as LATAM (${reason})`);
            return { relevant: true, reason, type: 'latam' };
        }
        // Then Global from any source
        if (metadataCheck === 'ACCEPT_GLOBAL' || locationCheck === 'ACCEPT_GLOBAL' || contentCheck === 'ACCEPT_GLOBAL') {
             const reason = metadataCheck === 'ACCEPT_GLOBAL' ? 'Metadata(Global)' :
                            locationCheck === 'ACCEPT_GLOBAL' ? 'Location/Office(Global)' : 'Content(Global)';
             jobLogger.debug(`Job accepted as GLOBAL (${reason})`);
             return { relevant: true, reason, type: 'global' };
        }

        // No strong indicators found in content
        logger.trace({ title }, 'Content check inconclusive (UNKNOWN)');
        return { relevant: false, reason: 'No strong indicators found in content' };
    }
}