import axios, { AxiosError } from 'axios';
import { decode } from 'html-entities';
import { PrismaClient, JobStatus, JobType, ExperienceLevel } from '@prisma/client'; // Remove JobSource import
import pMap from 'p-map';
import pino from 'pino';
import { JobProcessingAdapter } from '../lib/adapters/JobProcessingAdapter'; // Ajuste o caminho se necessário
import { FilterConfig, FilterMetadataConfig, getGreenhouseConfig } from '../types/JobSource';
import { StandardizedJob } from '../types/StandardizedJob';
import { extractSkills, detectJobType, detectExperienceLevel } from '../lib/utils/jobUtils';

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
  level: process.env.LOG_LEVEL || 'info' // Permite controlar o nível de log
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
interface SourceStats {
    found: number;
    relevant: number;
    processed: number; // Vagas efetivamente salvas/atualizadas
    deactivated: number;
    errors: number;
}

// --- Lógica de Filtragem (Configurável) ---
// !! IMPORTANTE: Mova estas configurações para o DB (na JobSource.config?) ou um arquivo JSON/YAML !!
const DEFAULT_FILTER_CONFIG: FilterConfig = {
    REMOTE_METADATA_FIELDS: {
        // Mapeie nomes de metadados para seus significados (case-insensitive)
        'remote eligible': { type: 'boolean', positiveValue: 'yes' },
        'remote status': { type: 'string', positiveValues: ['fully remote', 'remote optional', 'worldwide'] },
        'geo scope': { type: 'string', allowedValues: ['worldwide', 'global', 'latam', 'americas'] },
        'location requirement': { type: 'string', disallowedValues: ['us only', 'eu only', 'usa', 'united states'] }
    },
    LOCATION_KEYWORDS: {
        STRONG_POSITIVE_GLOBAL: [
            'remote worldwide', 
            'global remote', 
            'fully remote', 
            'remote - global',
            'remote (global)',
            'remote - worldwide',
            'remote (worldwide)'
        ],
        STRONG_POSITIVE_LATAM: [
            'remote latam', 
            'remote - latam', 
            'remote (latam)',
            'remote latin america',
            'remote - latin america',
            'remote (latin america)',
            'remote south america',
            'remote - south america',
            'remote (south america)',
            'remote brazil',
            'remote brasil'
        ],
        STRONG_NEGATIVE_RESTRICTION: [
            // US-specific restrictions
            'remote (us)', 'remote (usa)', 'remote - us', 'remote - usa', 
            'remote us', 'remote usa', 'remote united states',
            'remote in us', 'remote in usa', 'remote in united states',
            'us remote', 'usa remote', 'united states remote',
            
            // Canada-specific restrictions
            'remote (canada)', 'remote - canada', 'remote canada', 
            'remote in canada', 'canada remote',
            
            // UK-specific restrictions
            'remote (uk)', 'remote - uk', 'remote uk', 
            'remote in uk', 'uk remote', 'remote united kingdom',
            'remote in united kingdom', 'united kingdom remote',
            
            // EU-specific restrictions
            'remote (eu)', 'remote - eu', 'remote eu', 
            'remote in eu', 'eu remote', 'remote europe',
            'remote in europe', 'europe remote',
            
            // Asia/Pacific restrictions
            'remote (apac)', 'remote - apac', 'remote apac',
            'remote asia', 'remote australia', 'remote new zealand',
            'remote japan', 'remote singapore', 'remote india', 'remote china',
            
            // Specific cities/regions (non-LATAM)
            'remote - berlin', 'remote - london', 'remote - san francisco',
            'remote - new york', 'remote - seattle', 'remote - austin',
            'remote - toronto', 'remote - vancouver', 'remote - sydney',
            'remote - dublin', 'remote - amsterdam', 'remote - paris',
            'remote - delhi', 'remote - bangalore',
            
            // Generic region restrictions
            'us only', 'usa only', 'u.s. only', 'u.s.a only',
            'eu only', 'uk only', 'canada only', 'australia only',
            'north america only', 'india only', 'asia only'
        ],
        AMBIGUOUS: ['remote']
    },
    CONTENT_KEYWORDS: {
        // Usar apenas se metadados e location forem ambíguos
        STRONG_POSITIVE_GLOBAL: [
            'work from anywhere', 
            'globally remote', 
            'worldwide',
            'fully distributed team',
            'fully remote team',
            'work from anywhere in the world',
            'remote first company',
            'remote-first',
            'work from your home anywhere'
        ],
        STRONG_POSITIVE_LATAM: [
            'latin america', 
            'latam', 
            'south america', 
            'brazil', 
            'brasil',
            'americas timezone',
            'latin american',
            'americas region'
        ],
        STRONG_NEGATIVE_REGION: [
            // US/North America restrictions
            'eligible to work in the us', 
            'must reside in the united states', 
            'must be based in the uk',
            'north america only', 
            'us citizen', 
            'u.s. citizen',
            'must have work authorization in the us', 
            'must possess work authorization for the uk',
            'legally authorized to work in the united states',
            'legally authorized to work in the us',
            'must be legally authorized to work in the us',
            'must be legally authorized to work in the united states',
            'must be eligible to work in the us',
            'must be eligible to work in the united states',
            'must be located in the us',
            'must be located in the united states',
            'must be based in the us',
            'must be based in the united states',
            'based in north america',
            'within the united states',
            'within the us',
            
            // EU/UK restrictions
            'must be based in europe',
            'must be located in europe',
            'must be eligible to work in the eu',
            'must be eligible to work in europe',
            'must be eligible to work in the uk',
            'must be eligible to work in the united kingdom',
            'must be located in the uk',
            'must be located in the united kingdom',
            'based in europe',
            
            // India/Asia restrictions
            'must be located in india',
            'based in india',
            'eligible to work in india',
            'must reside in india',
            'must be located in asia',
            'based in asia',
            'eligible to work in asia',
            
            // Other specific locations mentioned in text
            'based in delhi',
            'located in delhi',
            'based in bangalore',
            'located in bangalore',
            'based in singapore',
            'based in tokyo',
            'based in sydney',
            'based in australia',
            'based in canada',
            
            // General regional restrictions
            'applicants must be residents of',
            'open to candidates in',
            'only open to candidates in',
            'position is based in',
            'role is based in',
            'you must be located in',
            'you must reside in',
            'authorized to work in the country',
            'local candidates only',
            'domestic candidates only',
            'no visa sponsorship',
            'sponsorship is not available'
        ],
        STRONG_NEGATIVE_TIMEZONE: [
            // US-centric timezones that might exclude Brazil
            'pst timezone required',
            'pst only',
            'pst timezone only',
            'pacific timezone only',
            'pacific time only',
            
            // European timezones
            'cet timezone required',
            'cet only',
            'cet timezone only',
            'central european time only',
            'european timezone',
            'european time zone',
            
            // Asian/Australian timezones
            'jst timezone',
            'aest timezone',
            'australian time zone',
            'asian time zone',
            'asia pacific time zone',
            
            // Note: EST/EDT/CST generally not included as negatives since they overlap with Brazil
            // but including specific restrictive phrasings
            'eastern time only', 
            'eastern timezone only',
            'central time only',
            'central timezone only'
        ]
    }
};

// Função para normalizar e verificar keywords (case-insensitive)
const includesKeyword = (text: string, keywords: string[]): boolean => {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
};

// Implementação das funções de verificação (melhoradas)
function checkMetadataForRemoteness(metadata: GreenhouseMetadata[]): 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN' {
    if (!metadata || metadata.length === 0) return 'UNKNOWN';

    let hasLatamIndicator = false;

    for (const item of metadata) {
        const fieldNameLower = item.name?.toLowerCase() || '';
        const config = DEFAULT_FILTER_CONFIG.REMOTE_METADATA_FIELDS[fieldNameLower];

        if (config) {
            const value = typeof item.value === 'string' ? item.value.toLowerCase() : null;
            if (!value) continue;

            switch (config.type) {
                case 'boolean':
                    if ('positiveValue' in config && value === config.positiveValue.toLowerCase()) {
                        return 'ACCEPT_GLOBAL'; // Assumir global por padrão
                    } else {
                        return 'REJECT';
                    }
                case 'string':
                    if ('disallowedValues' in config && config.disallowedValues?.some(disallowed => value.includes(disallowed.toLowerCase()))) {
                        return 'REJECT';
                    }
                    if ('allowedValues' in config && config.allowedValues?.some(allowed => value.includes(allowed.toLowerCase()))) {
                        const allowedValue = config.allowedValues.find(allowed => value.includes(allowed.toLowerCase()));
                        if (allowedValue && ['latam', 'americas'].includes(allowedValue.toLowerCase())) {
                            hasLatamIndicator = true;
                        }
                    }
                    if ('positiveValues' in config && config.positiveValues?.some(positive => value.includes(positive.toLowerCase()))) {
                        const positiveValue = config.positiveValues.find(positive => value.includes(positive.toLowerCase()));
                        if (positiveValue && ['latam', 'americas'].includes(positiveValue.toLowerCase())) {
                            hasLatamIndicator = true;
                        }
                    }
                    break;
            }
        }
    }
    
    // Decisão após verificar todos os metadados
    if (hasLatamIndicator) return 'ACCEPT_LATAM';
    // Se nenhum metadado relevante foi encontrado ou se foram ambíguos:
    return 'UNKNOWN';
}

function checkLocationName(locationName: string): 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN' {
    if (!locationName) return 'UNKNOWN'; // Treat missing location as unknown, not global
    const nameLower = locationName.toLowerCase().trim();

    // --- Strong Rejection ---
    if (includesKeyword(nameLower, DEFAULT_FILTER_CONFIG.LOCATION_KEYWORDS.STRONG_NEGATIVE_RESTRICTION)) {
        return 'REJECT';
    }

    // --- Strong Acceptance ---
    if (includesKeyword(nameLower, DEFAULT_FILTER_CONFIG.LOCATION_KEYWORDS.STRONG_POSITIVE_GLOBAL)) {
        return 'ACCEPT_GLOBAL';
    }
    if (includesKeyword(nameLower, DEFAULT_FILTER_CONFIG.LOCATION_KEYWORDS.STRONG_POSITIVE_LATAM)) {
        return 'ACCEPT_LATAM';
    }

    // --- Check for generic "Remote" vs. Non-Remote ---
    if (nameLower.includes('remote')) {
        // It says remote, but no clear global/latam/restriction keyword - Needs content check
        return 'UNKNOWN';
    }

    // --- Rejection for non-remote ---
    // If it doesn't contain "remote" and wasn't explicitly accepted.
    return 'REJECT';
}

function checkContentKeywords(title: string, content: string): 'ACCEPT_GLOBAL' | 'ACCEPT_LATAM' | 'REJECT' | 'UNKNOWN' {
    if (!content && !title) return 'UNKNOWN';
    const titleLower = title?.toLowerCase() || '';
    const contentLower = content?.toLowerCase() || '';
    const fullText = `${titleLower} ${contentLower}`;

    // --- Strong Rejection ---
    if (includesKeyword(fullText, DEFAULT_FILTER_CONFIG.CONTENT_KEYWORDS.STRONG_NEGATIVE_REGION) ||
        includesKeyword(fullText, DEFAULT_FILTER_CONFIG.CONTENT_KEYWORDS.STRONG_NEGATIVE_TIMEZONE)) {
        return 'REJECT';
    }

    // --- Strong Acceptance ---
    // Prioritize LATAM keywords if present
    if (includesKeyword(fullText, DEFAULT_FILTER_CONFIG.CONTENT_KEYWORDS.STRONG_POSITIVE_LATAM)) {
        return 'ACCEPT_LATAM';
    }
    if (includesKeyword(fullText, DEFAULT_FILTER_CONFIG.CONTENT_KEYWORDS.STRONG_POSITIVE_GLOBAL)) {
        return 'ACCEPT_GLOBAL';
    }

    // No strong indicators found
    return 'UNKNOWN';
}

function isJobRelevant(job: GreenhouseJob): FilterResult {
    // --- Initial Checks (Metadata, Location Name) ---
    const metadataCheck = checkMetadataForRemoteness(job.metadata);
    if (metadataCheck === 'REJECT') return { relevant: false, reason: 'Metadata indicates Restriction' };

    const locationCheck = checkLocationName(job.location?.name);
    if (locationCheck === 'REJECT') return { relevant: false, reason: 'Location Name indicates Restriction or is non-remote' };
    
    // --- FINAL Content Check for Hard Restrictions (PRIORITY) ---
    // Even if metadata/location seemed okay, check the *full text* for deal-breakers
    const fullTextLower = (job.title?.toLowerCase() || '') + ' ' + (job.content?.toLowerCase() || '');
    if (includesKeyword(fullTextLower, DEFAULT_FILTER_CONFIG.CONTENT_KEYWORDS.STRONG_NEGATIVE_REGION) ||
        includesKeyword(fullTextLower, DEFAULT_FILTER_CONFIG.CONTENT_KEYWORDS.STRONG_NEGATIVE_TIMEZONE)) {
        logger.debug({ jobId: job.id, title: job.title }, "Rejected by STRONG NEGATIVE content keywords (final check)");
        return { relevant: false, reason: 'Content indicates strong Restriction (Region/Timezone)' };
    }

    // --- Positive Indicators (Accept if found) ---
    if (metadataCheck === 'ACCEPT_GLOBAL') return { relevant: true, reason: 'Metadata indicates Global', type: 'global' };
    if (metadataCheck === 'ACCEPT_LATAM') return { relevant: true, reason: 'Metadata indicates LATAM', type: 'latam' };
    if (locationCheck === 'ACCEPT_GLOBAL') return { relevant: true, reason: 'Location Name indicates Global', type: 'global' };
    if (locationCheck === 'ACCEPT_LATAM') return { relevant: true, reason: 'Location Name indicates LATAM', type: 'latam' };
    
    // Check content keywords *after* the final negative check
    const contentCheck = checkContentKeywords(job.title, job.content); 
    // Note: contentCheck itself won't return REJECT anymore because we did that above
    if (contentCheck === 'ACCEPT_GLOBAL') return { relevant: true, reason: 'Content indicates Global', type: 'global' };
    if (contentCheck === 'ACCEPT_LATAM') return { relevant: true, reason: 'Content indicates LATAM', type: 'latam' };
    
    // --- Advanced Heuristics for Ambiguous "Remote" Jobs (if no clear signals so far) ---
    const hasRemoteInLocation = job.location?.name?.toLowerCase().includes('remote') || false;
    const hasRemoteInTitle = job.title?.toLowerCase().includes('remote') || false;

    // If the job has "Remote" in location or title, AND we didn't find strong negative keywords in the full text check earlier
    // then we can consider it a potential global remote job.
    if (hasRemoteInLocation || hasRemoteInTitle) { 
        logger.debug({ 
            jobId: job.id, 
            title: job.title,
            hasRemoteInLocation,
            hasRemoteInTitle,
        }, "Using advanced heuristics to accept ambiguous remote job (passed final content check)");
        
        return { relevant: true, reason: 'Ambiguous Remote job with no clear restrictions found in content', type: 'global' };
    }
    
    // --- Default Case: If still no explicit acceptance, consider it not relevant ---
    logger.trace({ jobId: job.id, title: job.title }, 'Job considered irrelevant by default (no clear positive indicators or ambiguous remote signal)');
    return { relevant: false, reason: 'No clear Worldwide/LATAM/Brazil indicator found, and not clearly marked as unrestricted Remote.' };
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

// --- Funções de Desativação (Implementação Essencial) ---
async function getActiveJobSourceIdsFromDb(sourceId: string): Promise<Set<string>> {
    // Buscar todos os `sourceId` de Jobs com `jobSourceId` = sourceId E `status` = 'ACTIVE'
    logger.debug({ sourceId }, 'Fetching active job IDs from DB for deactivation check...');
    try {
        // O problema é que aqui estamos buscando TODAS as vagas ativas do Greenhouse
        // e não apenas as da fonte específica (empresa) que estamos processando agora
        
        // Primeiro, precisamos encontrar quais vagas do banco pertencem a esta empresa especifica
        // Para isso, primeiro encontramos a empresa no banco pelo sourceId
        const jobSource = await prisma.jobSource.findUnique({
            where: { id: sourceId },
            select: { name: true }
        });
        
        if (!jobSource) {
            logger.warn({ sourceId }, 'Job source not found in database');
            return new Set<string>();
        }
        
        // Agora buscamos a empresa (User com role COMPANY) pelo nome
        const company = await prisma.user.findFirst({
            where: { 
                name: jobSource.name,
                role: 'COMPANY'
            },
            select: { id: true }
        });
        
        if (!company) {
            logger.warn({ sourceId, sourceName: jobSource.name }, 'Company not found in database');
            return new Set<string>();
        }
        
        // Finalmente, buscamos as vagas ativas desta empresa específica
        const activeJobs = await prisma.job.findMany({
            where: {
                source: 'greenhouse',
                status: 'ACTIVE',
                companyId: company.id // Esta é a chave: filtrar pela empresa específica
            },
            select: {
                sourceId: true
            }
        });
        
        // Filter out any null sourceIds and convert to a Set
        const sourceIds = activeJobs
            .map(job => job.sourceId)
            .filter((sourceId): sourceId is string => sourceId !== null);
            
        const idSet = new Set(sourceIds);
        logger.debug({ sourceId, companyId: company.id, count: idSet.size }, 'Active job IDs fetched from DB for specific company.');
        return idSet;
    } catch (error) {
        logger.error({ sourceId, error }, 'Failed to fetch active job IDs from DB');
        return new Set<string>(); // Retorna vazio para não desativar nada em caso de erro
    }
}

async function deactivateJobsInDb(sourceId: string, jobSourceIdsToDeactivate: string[]): Promise<number> {
    if (jobSourceIdsToDeactivate.length === 0) {
        logger.debug({ sourceId }, 'No jobs to deactivate.');
        return 0;
    }
    logger.info({ sourceId, count: jobSourceIdsToDeactivate.length }, `Deactivating ${jobSourceIdsToDeactivate.length} jobs...`);
    try {
        // Primeiro, precisamos encontrar a empresa associada a esta fonte
        const jobSource = await prisma.jobSource.findUnique({
            where: { id: sourceId },
            select: { name: true }
        });
        
        if (!jobSource) {
            logger.warn({ sourceId }, 'Job source not found in database for deactivation');
            return 0;
        }
        
        // Agora buscamos a empresa (User com role COMPANY) pelo nome
        const company = await prisma.user.findFirst({
            where: { 
                name: jobSource.name,
                role: 'COMPANY'
            },
            select: { id: true }
        });
        
        if (!company) {
            logger.warn({ sourceId, sourceName: jobSource.name }, 'Company not found in database for deactivation');
            return 0;
        }
        
        // Agora desativamos apenas as vagas desta empresa específica
        const updateResult = await prisma.job.updateMany({
            where: {
                source: 'greenhouse',
                sourceId: {
                    in: jobSourceIdsToDeactivate
                },
                status: JobStatus.ACTIVE,
                companyId: company.id // Filtrar pela empresa específica
            },
            data: {
                status: JobStatus.CLOSED
            }
        });
        logger.info({ sourceId, companyId: company.id, count: updateResult.count }, 'Jobs successfully deactivated.');
        return updateResult.count;
    } catch (error) {
        logger.error({ sourceId, count: jobSourceIdsToDeactivate.length, error }, 'Failed to deactivate jobs in DB');
        return 0;
    }
}

// --- Processador de Fonte Individual ---
async function processGreenhouseSource(source: any, parentLogger: pino.Logger): Promise<SourceStats> {
    const sourceLogger = parentLogger.child({ sourceName: source.name, sourceId: source.id });
    const stats: SourceStats = { found: 0, relevant: 0, processed: 0, deactivated: 0, errors: 0 };
    
    // Usar nossa função auxiliar para extrair e validar boardToken do config
    const greenhouseConfig = getGreenhouseConfig(source.config);
    if (!greenhouseConfig || !greenhouseConfig.boardToken) {
        sourceLogger.error('❌ Missing boardToken in source config');
        stats.errors++;
        return stats;
    }
    
    const boardToken = greenhouseConfig.boardToken;
    sourceLogger.info(`-> Starting processing for boardToken: ${boardToken}`);

    try {
        // 1. Fetch jobs com ?content=true
        sourceLogger.debug('Fetching jobs from Greenhouse API...');
        const response = await axios.get(
            `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`,
            { timeout: 45000 } // Timeout maior
        );

        if (!response.data || !Array.isArray(response.data.jobs)) {
            sourceLogger.error({ responseData: response.data }, '❌ Invalid response structure from Greenhouse API');
            stats.errors++;
            return stats;
        }
        const apiJobs: GreenhouseJob[] = response.data.jobs;
        stats.found = apiJobs.length;
        sourceLogger.info(`+ ${stats.found} jobs found in API response.`);
        
        // Log the structure of the first job to see what company information is available
        if (apiJobs.length > 0) {
            sourceLogger.debug({
                sampleJob: {
                    id: apiJobs[0].id,
                    title: apiJobs[0].title,
                    departments: apiJobs[0].departments,
                    location: apiJobs[0].location,
                    company: apiJobs[0].company
                }
            }, 'Sample job structure');
        }

        // 2. Lógica de Desativação
        const activeDbJobSourceIds = await getActiveJobSourceIdsFromDb(source.id); // Passar ID da fonte
        const currentApiJobSourceIds = new Set(apiJobs.map(job => String(job.id)));
        const jobSourceIdsToDeactivate = Array.from(activeDbJobSourceIds)
            .filter(dbId => !currentApiJobSourceIds.has(dbId));

        // 3. Processar e Salvar Vagas Relevantes em Paralelo
        sourceLogger.debug(`Processing ${apiJobs.length} jobs for relevance...`);
        await pMap(apiJobs, async (job) => {
            try {
                const filterResult = isJobRelevant(job);
                if (filterResult.relevant) {
                    stats.relevant++;
                    sourceLogger.info(
                        { jobId: job.id, title: job.title, reason: filterResult.reason, type: filterResult.type },
                        `➡️ Relevant job found`
                    );

                    // Preparar dados para o serviço de processamento
                    const cleanedContent = processJobContent(job.content);
                    
                    // Extract sections from content if possible
                    const sections = extractSectionsFromContent(cleanedContent);
                    
                    // Get company name with priority: job.company.name, then source.name
                    const companyName = job.company?.name || source.name;
                    sourceLogger.info({ jobId: job.id, companyName }, 'Processing job from company');
                    
                    const standardizedJobData: StandardizedJob = {
                        source: 'greenhouse',
                        sourceId: `${job.id}`,
                        title: job.title,
                        description: job.content,
                        applicationUrl: job.absolute_url,
                        // Prioritize job.company.name, then fall back to source.name
                        companyName: companyName,
                        location: filterResult.type === 'latam' ? 'Remote - Latin America' : 'Remote - Worldwide',
                        // Add required fields with reasonable defaults
                        requirements: sections.requirements,
                        responsibilities: sections.responsibilities,
                        benefits: sections.benefits,
                        jobType: detectJobType(job.content) as JobType,
                        experienceLevel: detectExperienceLevel(job.content) as ExperienceLevel,
                        skills: extractSkills(job.content),
                        tags: extractSkills(job.content),
                        country: filterResult.type === 'latam' ? 'LATAM' : 'Worldwide', // Set country based on filter result
                        workplaceType: 'REMOTE'
                    };

                    // Chamar serviço adaptado para salvar/atualizar
                    const saved = await jobProcessor.processAndSaveJob(standardizedJobData);
                    if (saved) {
                        stats.processed++;
                        sourceLogger.debug({ jobId: job.id }, 'Job processed/saved by service.');
                    } else {
                        sourceLogger.warn({ jobId: job.id }, 'Job relevant but not saved by service.');
                    }
                } else {
                     sourceLogger.trace({ jobId: job.id, title: job.title, reason: filterResult.reason }, `Job skipped as irrelevant`); // Usar trace para menos verbosidade
                }
            } catch (jobError) {
                stats.errors++;
                sourceLogger.error({ jobId: job.id, error: jobError }, '❌ Error processing individual job');
            }
        }, { concurrency: 5, stopOnError: false }); // Concorrência interna para processar vagas

        // 4. Executar Desativação
        stats.deactivated = await deactivateJobsInDb(source.id, jobSourceIdsToDeactivate);

        sourceLogger.info(`✓ Processing completed. Found: ${stats.found}, Relevant: ${stats.relevant}, Processed: ${stats.processed}, Deactivated: ${stats.deactivated}, Errors: ${stats.errors}`);

    } catch (error) {
        stats.errors++;
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            sourceLogger.error(
                { status: axiosError.response?.status, data: axiosError.response?.data, message: axiosError.message },
                `❌ Axios error fetching jobs`
            );
        } else {
            sourceLogger.error({ error }, '❌ General error processing source');
        }
    }
    return stats;
}

// --- Orquestrador Principal ---
async function main() {
    logger.info('🚀 Starting Greenhouse jobs fetch orchestrator...');
    const startTime = Date.now();
    let totalSourcesProcessed = 0;
    const aggregatedStats: SourceStats = { found: 0, relevant: 0, processed: 0, deactivated: 0, errors: 0 };

    try {
        const sources = await prisma.jobSource.findMany({
            where: { type: 'greenhouse', isEnabled: true }
        });
        logger.info(`Found ${sources.length} active Greenhouse sources to process.`);

        await pMap(sources, async (source) => {
            const stats = await processGreenhouseSource(source, logger);
            aggregatedStats.found += stats.found;
            aggregatedStats.relevant += stats.relevant;
            aggregatedStats.processed += stats.processed;
            aggregatedStats.deactivated += stats.deactivated;
            aggregatedStats.errors += stats.errors;
            totalSourcesProcessed++;

            // Atualizar lastFetched apenas se não houve erro fatal na fonte? Decisão sua.
            if (stats.errors === 0 || stats.found > 0) { // Exemplo: Atualizar se processou algo ou não teve erro crítico
                try {
                    await prisma.jobSource.update({
                        where: { id: source.id },
                        data: { lastFetched: new Date() }
                    });
                } catch (updateError) {
                    logger.warn({ sourceId: source.id, error: updateError }, 'Failed to update lastFetched for source');
                }
            }

            logger.info(`Progress: ${totalSourcesProcessed}/${sources.length} sources processed.`);

        }, { concurrency: 3, stopOnError: false }); // Concorrência entre fontes

        const duration = (Date.now() - startTime) / 1000;
  logger.info(
    { 
                sourcesProcessed: totalSourcesProcessed,
                totalSources: sources.length,
                totalJobsFound: aggregatedStats.found,
                totalJobsRelevant: aggregatedStats.relevant,
                totalJobsProcessed: aggregatedStats.processed,
                totalJobsDeactivated: aggregatedStats.deactivated,
                totalErrors: aggregatedStats.errors,
                durationSeconds: duration.toFixed(2),
      durationMinutes: (duration / 60).toFixed(1)
    },
            '🏁 Greenhouse fetch orchestration completed!'
        );

    } catch (error) {
        logger.error({ error }, '❌ Fatal error in main orchestration process');
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        logger.info('Prisma client disconnected.');
    }
}

// --- Execução ---
main();