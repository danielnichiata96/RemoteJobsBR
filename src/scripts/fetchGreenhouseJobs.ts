import axios, { AxiosError } from 'axios';
import { decode } from 'html-entities';
import { PrismaClient, JobStatus, JobType, ExperienceLevel, JobSource } from '@prisma/client';
import pMap from 'p-map';
import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';
import { JobProcessingAdapter } from '../lib/adapters/JobProcessingAdapter';
import { FilterConfig, FilterMetadataConfig, getGreenhouseConfig } from '../types/JobSource';
import { StandardizedJob } from '../types/StandardizedJob';
import { extractSkills, detectJobType, detectExperienceLevel } from '../lib/utils/jobUtils';
import { GreenhouseFetcher } from '../lib/fetchers/GreenhouseFetcher';
import { SourceStats } from '../lib/fetchers/types';

// --- Configuração Inicial ---
const prisma = new PrismaClient();
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
      messageFormat: '{msg}',
      levelFirst: false
    }
  },
  base: undefined,
  level: process.env.LOG_LEVEL || 'info'
});

// Instância do adaptador do serviço de processamento de vagas
const jobProcessor = new JobProcessingAdapter();

// --- Tipos e Interfaces ---
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

// --- Lógica de Filtragem (Configurável) ---
// REMOVED: const DEFAULT_FILTER_CONFIG: FilterConfig = { ... }; (Lines 67-264)

// Função para normalizar e verificar keywords (case-insensitive)
const includesKeyword = (text: string, keywords: string[]): boolean => {
    if (!text || !keywords) return false;
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
};

function checkMetadataForRemoteness(metadata: GreenhouseMetadata[], filterConfig: FilterConfig): 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN' {
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
                    decision = 'ACCEPT_GLOBAL'; // Boolean 'yes' usually means globally remote unless specified otherwise
                } else if (valueLower && valueLower !== config.positiveValue?.toLowerCase()) {
                    return 'REJECT'; // Explicitly not remote
                }
            } else if (config.type === 'string') {
                const currentValues = valueLower ? [valueLower] : valueArrayLower;
                if (!currentValues) continue;

                // Check for allowed values (positive signal)
                if (config.allowedValues) {
                    const lowerAllowed = config.allowedValues.map(v => v.toLowerCase());
                    if (currentValues.some(v => lowerAllowed.includes(v))) {
                         // Check if LATAM is specifically mentioned
                         if (currentValues.some(v => v.includes('latam') || v.includes('americas'))) {
                             decision = 'ACCEPT_LATAM';
                         } else {
                            // If not LATAM, but allowed (like 'global' or 'worldwide'), consider it global
                             decision = 'ACCEPT_GLOBAL';
                         }
                    } else {
                        // Value exists but isn't in allowed list - might be a rejection depending on other fields
                        // We don't reject immediately, give other fields a chance
                    }
                }

                // Check for positive values (stronger positive signal)
                if (config.positiveValues) {
                    const lowerPositive = config.positiveValues.map(v => v.toLowerCase());
                     if (currentValues.some(v => lowerPositive.includes(v))) {
                         // Check if LATAM is specifically mentioned
                         if (currentValues.some(v => v.includes('latam') || v.includes('americas'))) {
                             decision = 'ACCEPT_LATAM';
                         } else {
                            decision = 'ACCEPT_GLOBAL';
                         }
                     }
                }

                // Check for disallowed values (strong negative signal)
                if (config.disallowedValues) {
                    const lowerDisallowed = config.disallowedValues.map(v => v.toLowerCase());
                    if (currentValues.some(v => lowerDisallowed.includes(v))) {
                        return 'REJECT'; // Found a disallowed value
                    }
                }
            }
        }
        // If a decision (ACCEPT_GLOBAL or ACCEPT_LATAM) was made, break early
        if (decision !== 'UNKNOWN') break;
    }

    return decision;
}

function checkLocationName(locationName: string, filterConfig: FilterConfig): 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN' {
    if (!locationName) return 'UNKNOWN';
    const lowerLocation = locationName.toLowerCase().trim();
    const keywords = filterConfig.LOCATION_KEYWORDS;

    // Check for strong negative restrictions first
    if (includesKeyword(lowerLocation, keywords.STRONG_NEGATIVE_RESTRICTION)) {
        return 'REJECT';
    }

    // Check for strong LATAM indicators
    if (includesKeyword(lowerLocation, keywords.STRONG_POSITIVE_LATAM)) {
        return 'ACCEPT_LATAM';
    }

    // Check for strong global indicators
    if (includesKeyword(lowerLocation, keywords.STRONG_POSITIVE_GLOBAL)) {
        return 'ACCEPT_GLOBAL';
    }

    // Check for ambiguous 'remote' - treat as unknown for now
    if (keywords.AMBIGUOUS && keywords.AMBIGUOUS.some(kw => lowerLocation === kw.toLowerCase())) {
        return 'UNKNOWN'; // Could be restricted, let content check decide
    }

    // If location is not explicitly remote or restricted, assume it implies a location requirement
    // E.g., "New York, NY" or "London"
    if (!lowerLocation.includes('remote')) {
        return 'REJECT';
    }

    return 'UNKNOWN'; // Ambiguous remote location like "Remote - US or Canada"
}

function checkContentKeywords(title: string, content: string, filterConfig: FilterConfig): 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN' {
    if (!content && !title) return 'UNKNOWN';
    const lowerContent = (content || '').toLowerCase();
    const lowerTitle = (title || '').toLowerCase(); // Include title in keyword check
    const fullText = `${lowerTitle} ${lowerContent}`;
    const keywords = filterConfig.CONTENT_KEYWORDS;

    // Check for negative timezone restrictions first
    if (keywords.STRONG_NEGATIVE_TIMEZONE && includesKeyword(fullText, keywords.STRONG_NEGATIVE_TIMEZONE)) {
        return 'REJECT';
    }

    // Check for negative region restrictions
    if (keywords.STRONG_NEGATIVE_REGION && includesKeyword(fullText, keywords.STRONG_NEGATIVE_REGION)) {
        return 'REJECT';
    }

    // Check for strong positive LATAM keywords
    if (keywords.STRONG_POSITIVE_LATAM && includesKeyword(fullText, keywords.STRONG_POSITIVE_LATAM)) {
        return 'ACCEPT_LATAM';
    }

    // Check for strong positive global keywords
    if (keywords.STRONG_POSITIVE_GLOBAL && includesKeyword(fullText, keywords.STRONG_POSITIVE_GLOBAL)) {
        return 'ACCEPT_GLOBAL';
    }

    return 'UNKNOWN';
}

function isJobRelevant(job: GreenhouseJob, filterConfig: FilterConfig): FilterResult {
    const { title, location, content, metadata } = job;
    const locationName = location?.name || '';
    const cleanContent = processJobContent(content || ''); // Clean content once

    // 1. Check Metadata (Highest Priority)
    const metadataResult = checkMetadataForRemoteness(metadata || [], filterConfig);
    if (metadataResult === 'ACCEPT_GLOBAL') return { relevant: true, reason: 'Metadata indicates global remote', type: 'global' };
    if (metadataResult === 'ACCEPT_LATAM') return { relevant: true, reason: 'Metadata indicates LATAM remote', type: 'latam' };
    if (metadataResult === 'REJECT') return { relevant: false, reason: 'Metadata indicates non-remote or excluded region' };

    // 2. Check Location Name (Second Priority)
    const locationResult = checkLocationName(locationName, filterConfig);
    if (locationResult === 'ACCEPT_GLOBAL') return { relevant: true, reason: 'Location indicates global remote', type: 'global' };
    if (locationResult === 'ACCEPT_LATAM') return { relevant: true, reason: 'Location indicates LATAM remote', type: 'latam' };
    if (locationResult === 'REJECT') return { relevant: false, reason: 'Location indicates non-remote or excluded region' };

    // 3. Check Content Keywords (Last Resort)
    const contentResult = checkContentKeywords(title, cleanContent, filterConfig);
    if (contentResult === 'ACCEPT_GLOBAL') return { relevant: true, reason: 'Content keywords indicate global remote', type: 'global' };
    if (contentResult === 'ACCEPT_LATAM') return { relevant: true, reason: 'Content keywords indicate LATAM remote', type: 'latam' };
    if (contentResult === 'REJECT') return { relevant: false, reason: 'Content keywords indicate non-remote or excluded region/timezone' };

    // 4. Default: If all checks are UNKNOWN, assume irrelevant to be safe
    return { relevant: false, reason: 'Could not determine relevance from metadata, location, or content (defaulting to irrelevant)' };
}

// --- Funções Auxiliares ---
function processJobContent(content: string): string {
  if (!content) return '';
    try {
        let processedContent = decode(content); // Decode HTML entities first
        // Simplificar Regex - talvez focar menos em espaçamento e mais em remover tags vazias?
    processedContent = processedContent
            .replace(/(\r\n|\n|\r){3,}/g, '\n\n') // Remover quebras de linha excessivas
            .replace(/<p>\s*( |\s)*\s*<\/p>/gi, '') // Remover parágrafos vazios (com ou sem  )
            .replace(/<div>\s*( |\s)*\s*<\/div>/gi, '') // Remover divs vazias
            .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '\n') // Substituir <br><br> por nova linha
            .replace(/\s{2,}/g, ' ') // Normalizar espaços múltiplos
      .trim();
        // Considerar usar uma biblioteca como sanitize-html se a limpeza precisar ser mais robusta
    return processedContent;
  } catch (error) {
        logger.error({ error }, 'Error processing job content');
        return content; // Retornar original em caso de erro
    }
}

/**
 * Extract requirements and responsibilities sections from job content
 */
function extractSectionsFromContent(content: string): { requirements: string, responsibilities: string, benefits: string } {
    // Default empty result
    const result = { 
        requirements: '', 
        responsibilities: '',
        benefits: ''
    };
    
    if (!content) return result;
    
    try {
        // Common heading patterns for requirements section
        const requirementsPatterns = [
            /requirements/i,
            /qualifications/i,
            /what you'll need/i,
            /what you need/i,
            /what we require/i,
            /what we're looking for/i,
            /your profile/i,
            /skills.*required/i,
            /you should have/i,
            /who you are/i
        ];
        
        // Common heading patterns for responsibilities section
        const responsibilitiesPatterns = [
            /responsibilities/i,
            /what you'll do/i,
            /what you will do/i,
            /your role/i,
            /job description/i,
            /about the role/i,
            /the role/i,
            /about the job/i,
            /duties/i,
            /what you would be doing/i
        ];
        
        // Common heading patterns for benefits section
        const benefitsPatterns = [
            /benefits/i,
            /perks/i,
            /what we offer/i,
            /why work with us/i,
            /compensation/i,
            /what's in it for you/i,
            /what you'll get/i,
            /we offer/i
        ];
        
        // Split content by common section dividers (headers, etc.)
        const sections = content.split(/(<h[1-6]>.*?<\/h[1-6]>|<strong>.*?<\/strong>|\n##.*?\n|\n#.*?\n)/i);
        
        let currentSection: 'requirements' | 'responsibilities' | 'benefits' | '' = '';
        
        // Process each chunk and identify sections
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            
            // Check if this is a heading/divider
            if (section.match(/<h[1-6]>|<strong>|\n##|\n#/i)) {
                // Determine section type
                if (requirementsPatterns.some(pattern => pattern.test(section))) {
                    currentSection = 'requirements';
                } else if (responsibilitiesPatterns.some(pattern => pattern.test(section))) {
                    currentSection = 'responsibilities';
                } else if (benefitsPatterns.some(pattern => pattern.test(section))) {
                    currentSection = 'benefits';
                } else {
                    currentSection = ''; // Unknown section
                }
            } 
            // Add content to the appropriate section if we're in a known section
            else if (currentSection && i > 0) {
                // Type-safe access to result properties
                if (currentSection === 'requirements') {
                    result.requirements += ' ' + section.trim();
                } else if (currentSection === 'responsibilities') {
                    result.responsibilities += ' ' + section.trim();
                } else if (currentSection === 'benefits') {
                    result.benefits += ' ' + section.trim();
                }
            }
        }
        
        // If we couldn't extract structured sections, use heuristics
        if (!result.requirements && !result.responsibilities) {
            // Basic heuristics: split content in half if it's reasonably long
            if (content.length > 200) {
                const midpoint = Math.floor(content.length / 2);
                result.responsibilities = content.substring(0, midpoint).trim();
                result.requirements = content.substring(midpoint).trim();
    } else {
                // For very short descriptions, just use the whole content for both
                result.responsibilities = content.trim();
                result.requirements = content.trim();
            }
        }
        
        return {
            requirements: result.requirements.trim(),
            responsibilities: result.responsibilities.trim(),
            benefits: result.benefits.trim()
        };
    } catch (error) {
        logger.error({ error }, 'Error extracting sections from content');
        return result;
    }
}

// --- Funções de Desativação (Permanecem no Orquestrador) ---

/**
 * Busca no DB os sourceIds ativos para uma determinada JobSource.
 */
async function getActiveJobSourceIdsFromDb(jobSourceRecordId: string, companyId: string): Promise<Set<string>> {
    logger.debug({ jobSourceRecordId, companyId }, 'Fetching active job source IDs from DB for deactivation check...');
    try {
        const jobs = await prisma.job.findMany({
            where: {
                jobSourceId: jobSourceRecordId,
                companyId: companyId,
                status: JobStatus.ACTIVE
            },
            select: {
                sourceId: true
            }
        });
        const idSet = new Set(jobs.map(job => job.sourceId));
        logger.debug({ jobSourceRecordId, companyId, count: idSet.size }, 'Active job source IDs fetched from DB.');
        return idSet;
    } catch (error) {
        logger.error({ jobSourceRecordId, companyId, error }, 'Failed to fetch active job source IDs from DB');
        return new Set<string>();
    }
}

/**
 * Desativa vagas no DB que não estão mais presentes na fonte.
 */
async function deactivateJobsInDb(jobSourceRecordId: string, companyId: string, jobSourceIdsToDeactivate: string[]): Promise<number> {
    if (jobSourceIdsToDeactivate.length === 0) {
        logger.debug({ jobSourceRecordId, companyId }, 'No jobs to deactivate.');
        return 0;
    }
    const count = jobSourceIdsToDeactivate.length;
    logger.info({ jobSourceRecordId, companyId, count }, `Deactivating ${count} jobs...`);
    try {
        const updateResult = await prisma.job.updateMany({
            where: {
                jobSourceId: jobSourceRecordId,
                companyId: companyId,
                sourceId: { in: jobSourceIdsToDeactivate },
                status: JobStatus.ACTIVE,
            },
            data: {
                status: JobStatus.CLOSED,
                lastDeactivatedAt: new Date() // Add timestamp for deactivation
            }
        });
        logger.info({ jobSourceRecordId, companyId, count: updateResult.count }, 'Jobs successfully deactivated.');
        return updateResult.count;
    } catch (error) {
        logger.error({ jobSourceRecordId, companyId, count, error }, 'Failed to deactivate jobs in DB');
        return 0;
    }
}

// --- Orquestrador Principal ---
async function main() {
    logger.info('🚀 Starting Job Fetch Orchestrator...');
    const startTime = Date.now();
    let totalSourcesProcessed = 0;
    const aggregatedStats: SourceStats = { found: 0, relevant: 0, processed: 0, deactivated: 0, errors: 0 };

    // Instanciar Fetchers (Aqui só temos Greenhouse por enquanto)
    const greenhouseFetcher = new GreenhouseFetcher(prisma, jobProcessor);
    // No futuro, poderíamos ter um mapa: const fetchers = { 'greenhouse': greenhouseFetcher, 'linkedin': linkedInFetcher };

    try {
        const sources = await prisma.jobSource.findMany({
            where: { isEnabled: true }, // Buscar todas as fontes ativas
            include: { company: true } // Incluir empresa para desativação
        });
        logger.info(`Found ${sources.length} active sources to process.`);

        await pMap(sources, async (source) => {
            const sourceLogger = logger.child({ jobSourceRecordId: source.id, sourceType: source.type, sourceName: source.name });
            sourceLogger.info(`Processing source...`);
            let sourceResultStats: SourceStats | null = null;
            let foundSourceIds = new Set<string>();
            let deactivatedCount = 0;

            try {
                 // Validação da Empresa
                 if (!source.company) {
                    sourceLogger.error('Source is not linked to a company. Skipping deactivation and processing.');
                    // Optionally increment an error count in aggregatedStats?
                    return; 
                }
                const companyId = source.company.id;

                // Selecionar o fetcher apropriado com base em source.type
                let fetcher;
                if (source.type === 'greenhouse') {
                    fetcher = greenhouseFetcher;
                } else {
                    sourceLogger.warn(`Unsupported source type "${source.type}". Skipping.`);
                    // Increment error count?
                    return; // Pular para a próxima fonte
                }

                // 1. Buscar vagas da fonte usando o fetcher
                const { stats: currentStats, foundSourceIds: currentFoundIds } = await fetcher.processSource(source, sourceLogger);
                sourceResultStats = currentStats;
                foundSourceIds = currentFoundIds;

                // 2. Lógica de Desativação (agora no orquestrador)
                const activeDbJobSourceIds = await getActiveJobSourceIdsFromDb(source.id, companyId);
                const jobSourceIdsToDeactivate = Array.from(activeDbJobSourceIds)
                    .filter(dbId => !foundSourceIds.has(dbId));
                
                deactivatedCount = await deactivateJobsInDb(source.id, companyId, jobSourceIdsToDeactivate);
                sourceResultStats.deactivated = deactivatedCount; // Atualizar stats com o valor real

            } catch (error) {
                sourceLogger.error({ error }, '❌ Unhandled error during source processing loop');
                 // Garantir que temos um objeto stats mesmo em caso de erro não capturado internamente
                if (!sourceResultStats) {
                    sourceResultStats = { found: 0, relevant: 0, processed: 0, deactivated: 0, errors: 1 };
                } else {
                    sourceResultStats.errors++;
                }
            }

            // Agregar estatísticas
            if (sourceResultStats) {
                 aggregatedStats.found += sourceResultStats.found;
                 aggregatedStats.relevant += sourceResultStats.relevant;
                 aggregatedStats.processed += sourceResultStats.processed;
                 aggregatedStats.deactivated += sourceResultStats.deactivated;
                 aggregatedStats.errors += sourceResultStats.errors;
                 totalSourcesProcessed++;
            }

            // Atualizar lastFetched
             if (sourceResultStats && (sourceResultStats.errors === 0 || sourceResultStats.found > 0)) {
                 try {
                     await prisma.jobSource.update({
                         where: { id: source.id },
                         data: { lastFetched: new Date() }
                     });
                 } catch (updateError) {
                     sourceLogger.warn({ error: updateError }, 'Failed to update lastFetched for source');
                 }
             }

        }, { concurrency: 3 }); // Limitar concorrência geral entre fontes

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        logger.info({
            durationSeconds: duration,
            sourcesProcessed: totalSourcesProcessed,
            totalJobsFound: aggregatedStats.found,
            totalJobsRelevant: aggregatedStats.relevant,
            totalJobsProcessed: aggregatedStats.processed,
            totalJobsDeactivated: aggregatedStats.deactivated,
            totalErrors: aggregatedStats.errors
        }, `🏁 Orchestrator finished processing all sources.`);

    } catch (error) {
        logger.error({ error }, '❌ Fatal error in main orchestration process');
        process.exitCode = 1; // Set exit code to indicate failure
    } finally {
        await prisma.$disconnect();
        logger.info('Prisma client disconnected.');
    }
}

// --- Execução ---
main();