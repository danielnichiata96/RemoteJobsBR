import { StandardizedJob } from '../../types/StandardizedJob'; // Ajuste o path conforme necessário
import { JobProcessor, ProcessedJobResult } from './types';
import { JobSource, JobType, /* HiringRegion, */ ExperienceLevel, JobStatus, Prisma } from '@prisma/client'; // Adicionei Prisma para JsonValue - Commented HiringRegion as it's not directly used now
import pino from 'pino';
import { detectJobType, detectExperienceLevel, extractSkills } from '../utils/jobUtils'; // Ajuste o path
// import { parseDate } from '../utils/dateUtils'; // Assumindo que você criou este utilitário - COMMENTED OUT
import sanitizeHtml from 'sanitize-html'; // Necessário para limpar HTML para skills
import { decode } from 'html-entities';   // Necessário para limpar HTML para skills

// --- Interfaces Corretas para API Ashby ---

// Interface Location alinhada com a documentação e o Fetcher
interface AshbyLocation {
  id: string;
  name: string;
  type: string;
  address?: {
    rawAddress: string | null;
    streetAddress1: string | null;
    streetAddress2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
    countryCode: string | null;
  } | null;
  isRemote: boolean; // Note: Este isRemote é por LOCALIZAÇÃO, o job principal tem o seu próprio isRemote
}

// Interface AshbyApiJob alinhada com a documentação e o Fetcher
// Inclui o campo customizado _determinedHiringRegionType que o Fetcher adiciona
interface AshbyRawJob {
    id: string; // ID interno do Ashby
    title: string;
    locations: AshbyLocation[]; // Campo principal de localização
    secondaryLocations?: AshbyLocation[]; // Campo secundário opcional
    department?: { id: string; name: string; } | null;
    team?: { id: string; name: string; } | null;
    isRemote: boolean | null; // Flag principal da vaga (pode ser null)
    descriptionHtml?: string | null;
    descriptionPlain?: string | null;
    publishedAt: string; // ISO DateTime string
    updatedAt: string; // ISO DateTime string
    employmentType?: "FullTime" | "PartTime" | "Intern" | "Contract" | "Temporary" | null;
    compensationTier?: { id: string; name: string; } | null;
    compensationRange?: string | null;
    isListed: boolean;
    jobUrl: string;
    applyUrl: string;
    // Campo adicionado pelo Fetcher após análise de relevância:
    _determinedHiringRegionType?: 'global' | 'latam';
}

// Logger default
const defaultLogger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class AshbyProcessor implements JobProcessor {
    readonly source = 'ashby'; // Define a fonte que este processor lida

    // Helper para limpar HTML (usado para extração de skills)
    private _stripHtml(html: string | undefined | null): string {
        if (!html) return '';
        try {
            const sanitized = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
            return decode(sanitized).replace(/\s+/g, ' ').trim();
        } catch (e) { defaultLogger.warn({ error: e }, "Error stripping HTML."); return ''; }
    }

    async processJob(
        rawJob: AshbyRawJob, // Usa a interface correta
        sourceData: JobSource, // sourceData é obrigatório aqui
        logger: pino.Logger = defaultLogger
    ): Promise<ProcessedJobResult> {
        // Usa jobUrl ou id como identificador para logs
        const logJobId = rawJob.jobUrl || rawJob.id || 'unknown_ashby_job';
        const jobLogger = logger.child({ processor: 'ashby', jobId: logJobId, jobTitle: rawJob.title });

        jobLogger.debug("--- ENTERED AshbyProcessor.processJob ---");

        // 1. Validações Essenciais do Raw Job
        if (!rawJob.title) {
            jobLogger.warn('Job processing skipped: Missing title.');
            return { success: false, error: 'Missing title' };
        }
        if (!rawJob.jobUrl && !rawJob.id) { // Precisa de pelo menos um ID
            jobLogger.warn('Job processing skipped: Missing both jobUrl and internal id.');
            return { success: false, error: 'Missing job identifier (jobUrl or id)' };
        }
        // Usa jobUrl como sourceId prioritário
        const sourceId = rawJob.jobUrl || rawJob.id;

        // Não checamos mais isListed aqui, pois o Fetcher já deve ter filtrado

        jobLogger.trace("Initial raw job validation passed.");

        try {
            // 2. Mapear para StandardizedJob (sem validação completa aqui, apenas mapeamento)
            jobLogger.trace("Attempting to map raw job to StandardizedJob...");
            const standardizedJobPartial = this._mapToStandardizedJob(rawJob, sourceData, sourceId, jobLogger);
            jobLogger.trace("Mapping successful.");

            // 3. Retornar sucesso com o job parcial mapeado
            // A validação final e o tipo completo são feitos no serviço que chama o processJob
            return {
                success: true,
                job: standardizedJobPartial as Omit<StandardizedJob, 'id' | 'createdAt' | 'status'> // Cast para o tipo esperado pelo serviço
            };
        } catch (error: any) {
            jobLogger.error({ errorMsg: error.message, stackPreview: error.stack?.substring(0, 200) }, 'Error during mapping in _mapToStandardizedJob');
            return { success: false, error: `Mapping error: ${error.message}` };
        }
    }

    private _mapToStandardizedJob(
        job: AshbyRawJob,
        sourceData: JobSource,
        sourceId: string, // sourceId já validado (jobUrl ou id)
        logger: pino.Logger
    ): Omit<StandardizedJob, 'id' | 'createdAt' | 'updatedAt' | 'status'> // Retorna o tipo parcial
    {
        logger.trace("Starting _mapToStandardizedJob execution.");

        // 1. Preparar Texto para Análise (Skills, Experience)
        const textForAnalysis = job.descriptionPlain || this._stripHtml(job.descriptionHtml) || '';
        const combinedTextForAnalysis = `${job.title || ''} ${textForAnalysis}`;
        logger.trace({ textLength: combinedTextForAnalysis.length }, "Prepared text for analysis.");

        // 2. Extrair Skills
        const skills = extractSkills(combinedTextForAnalysis);
        logger.trace({ skillCount: skills.length }, "Extracted skills.");

        // 3. Determinar Nível de Experiência
        const experienceLevel = detectExperienceLevel(combinedTextForAnalysis);
        logger.trace({ experienceLevel }, "Detected experience level.");

        // 4. Determinar Tipo de Vaga (JobType)
        const jobType = this._mapEmploymentType(job.employmentType);
        logger.trace({ employmentType: job.employmentType, mappedJobType: jobType }, "Mapped employment type.");

        // 5. Construir String de Localização
        const locationString = this._buildLocationString(job.locations, job.secondaryLocations, job.isRemote, logger);
        logger.trace({ locationString }, "Built location string.");

        // 6. Determinar Hiring Region (DO FETCHER) e Workplace Type
        // Usa o valor passado pelo Fetcher, default para null se não existir
        const hiringRegionType = job._determinedHiringRegionType ?? undefined; // Use undefined for optional field
        // WorkplaceType baseado no isRemote principal E/OU na análise do Fetcher
        // Se isRemote for true OU o fetcher determinou global/latam, é REMOTE.
        const workplaceType = (job.isRemote === true || hiringRegionType !== undefined) ? 'REMOTE' : 'UNKNOWN'; // Check against undefined
        logger.trace({ hiringRegionType, isRemote: job.isRemote, workplaceType }, "Determined hiring region type and workplace type.");

        // 7. Parsear Datas - Reverted to new Date() as parseDate is not implemented yet
        const publishedAt = job.publishedAt ? new Date(job.publishedAt) : undefined;
        const jobUpdatedAt = job.updatedAt ? new Date(job.updatedAt) : undefined;
        logger.trace({ publishedAt, jobUpdatedAt }, "Parsed dates.");

        // 8. Mapear para o Objeto StandardizedJob (Parcial)
        const mappedJob: Omit<StandardizedJob, 'id' | 'createdAt' | 'updatedAt' | 'status'> = {
            source: this.source,
            sourceId: sourceId, // Já validado
            title: job.title, // Já validado
            description: job.descriptionHtml || job.descriptionPlain || '', // Prioriza HTML, usa Plain como fallback
            location: locationString,
            applicationUrl: job.applyUrl || job.jobUrl || '', // Use applicationUrl for apply/job URL
            companyName: sourceData.name,
            companyWebsite: sourceData.companyWebsite ?? undefined,
            publishedAt: publishedAt ?? new Date(),
            jobType: jobType,
            experienceLevel: experienceLevel,
            jobType2: hiringRegionType,
            workplaceType: workplaceType,
            skills: skills,
            minSalary: undefined,
            maxSalary: undefined,
            currency: undefined,
            salaryCycle: undefined,
        };
        logger.trace("Finished mapping to StandardizedJob partial object.");
        return mappedJob;
    }

    private _mapEmploymentType(type?: string | null): JobType {
        switch (type) {
            case 'FullTime': return JobType.FULL_TIME;
            case 'PartTime': return JobType.PART_TIME;
            // Corrected: Use CONTRACT instead of CONTRACTOR
            case 'Contract': return JobType.CONTRACT;
            case 'Intern': return JobType.INTERNSHIP;
            // Corrected: Map Temporary to CONTRACT as TEMPORARY doesn't exist
            case 'Temporary': return JobType.CONTRACT;
            // Corrected: Use UNKNOWN instead of OTHER
            default: return JobType.UNKNOWN;
        }
    }

    // Removido: Esta lógica agora pertence ao Fetcher._isJobRelevant
    // private _determineHiringRegion(job: AshbyRawJob): HiringRegion { ... }

    // Nova função auxiliar para construir a string de localização
    private _buildLocationString(
        locations: AshbyLocation[] | undefined | null,
        secondaryLocations: AshbyLocation[] | undefined | null,
        isJobRemote: boolean | null,
        logger: pino.Logger
    ): string {
        const allLocations = [...(locations || []), ...(secondaryLocations || [])];
        if (allLocations.length === 0) {
            // Se não há localizações, mas a vaga é marcada como remota, retorna 'Remote'
            return isJobRemote === true ? 'Remote' : 'Location Unknown';
        }

        const locationParts = new Set<string>(); // Usar Set para evitar duplicatas

        allLocations.forEach(loc => {
            if (loc.name && loc.name.toLowerCase() !== 'remote') { // Adiciona nome se não for "Remote"
                locationParts.add(loc.name);
            } else if (loc.address) { // Se nome é "Remote" ou ausente, tenta construir do endereço
                const addressString = [
                    loc.address.city,
                    loc.address.state,
                    loc.address.countryCode?.toUpperCase() // Usar código do país se disponível
                    // loc.address.country // Ou nome completo do país
                ].filter(Boolean).join(', '); // Filtra nulos/undefined e junta com vírgula
                if (addressString) {
                    locationParts.add(addressString);
                }
            }
        });

        let finalString = [...locationParts].join(' | '); // Junta as partes únicas com um separador

        // Se a string final estiver vazia E a vaga for remota, retorna 'Remote'
        if (!finalString && isJobRemote === true) {
            finalString = 'Remote';
        }
        // Se ainda estiver vazia, retorna um placeholder
        if (!finalString) {
            finalString = 'Location Not Specified';
        }

        logger.trace({ finalLocationString: finalString }, "Generated location string.");
        return finalString;
    }
} 