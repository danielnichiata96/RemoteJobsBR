import { PrismaClient, JobSource } from '@prisma/client';
import { JobProcessingService } from '../services/jobProcessingService';
import { StandardizedJob } from '../../types/StandardizedJob';
import { JobProcessor, ProcessedJobResult, GreenhouseJob } from '../jobProcessors/types';
import { GreenhouseProcessor } from '../jobProcessors/greenhouseProcessor';
import { LeverProcessor } from '../jobProcessors/leverProcessor';
import pino from 'pino';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    }
  }
});

/**
 * Adapter to select the correct Job Processor based on the source
 * and orchestrate the processing and saving of job data.
 */
export class JobProcessingAdapter {
  private jobProcessingService: JobProcessingService;
  private processors: Map<string, JobProcessor>;

  constructor() {
    this.jobProcessingService = new JobProcessingService();
    // Initialize processors
    this.processors = new Map<string, JobProcessor>();
    this.processors.set('greenhouse', new GreenhouseProcessor());
    // Temporariamente desativando o processador Lever até corrigir a interface
    // this.processors.set('lever', new LeverProcessor());
    // Add other processors here as needed
  }

  /**
   * Selects the appropriate processor based on the source,
   * processes the raw job data to get a StandardizedJob,
   * and then saves it using the JobProcessingService.
   *
   * @param source The source identifier (e.g., 'greenhouse', 'lever')
   * @param rawJobData The raw data object fetched from the source (structure varies by source)
   * @param sourceData Optional source data
   * @returns Promise<boolean> True if the job was successfully processed and saved/updated, false otherwise.
   */
  async processRawJob(source: string, rawJobData: any, sourceData?: JobSource): Promise<boolean> {
    const processor = this.processors.get(source.toLowerCase());

    if (!processor) {
      logger.error({ source }, `No processor found for source`);
      return false;
    }

    const processLogger = logger.child({ source, processor: processor.source });
    processLogger.debug({ rawJobData }, `Starting processing with ${processor.source} processor`);

    try {
      // Pass sourceData to the processor
      const result: ProcessedJobResult = await processor.processJob(rawJobData, sourceData);

      if (!result.success || !result.job) {
        processLogger.warn({ error: result.error, rawJobData }, `Processor failed or determined job irrelevant`);
        return false; // Processor failed or job wasn't relevant
      }

      processLogger.info({ jobId: result.job.sourceId, title: result.job.title }, `Processor returned standardized job. Attempting save...`);
      
      // Call the service to handle saving the standardized job
      const saved = await this.jobProcessingService.saveOrUpdateJob(result.job);
      
      if (!saved) {
         processLogger.warn({ standardizedJob: result.job }, `JobProcessingService failed to save/update the job.`);
      }
      
      return saved;

    } catch (error) {
      processLogger.error({ error, rawJobData }, `Unhandled error during processing or saving`);
      return false;
    }
  }
  
  // --- Deprecated Method --- 
  // This method is kept temporarily for backward compatibility if needed,
  // but the flow should ideally be Fetcher -> processRawJob -> Service.saveOrUpdateJob
  /**
   * @deprecated Use processRawJob instead. This method assumes input is already standardized 
   *             and adapts it to a Greenhouse format, which is incorrect for other sources.
   */
  async processAndSaveJob_DEPRECATED(standardizedJob: StandardizedJob): Promise<boolean> {
     logger.warn("processAndSaveJob_DEPRECATED called - this indicates an old workflow is still in use.");
     try {
       if (!standardizedJob.source || !standardizedJob.sourceId) {
         logger.error('Job missing required source or sourceId');
         return false;
       }
 
       // Call the service directly to save/update
       return await this.jobProcessingService.saveOrUpdateJob(standardizedJob);

     } catch (error) {
       logger.error({ error }, 'Error in JobProcessingAdapter (Deprecated Method)');
       return false;
     }
   }
} 