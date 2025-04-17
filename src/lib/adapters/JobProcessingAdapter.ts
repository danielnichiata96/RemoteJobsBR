import { PrismaClient, JobSource } from '@prisma/client';
import { JobProcessingService } from '../services/jobProcessingService';
import { StandardizedJob } from '../../types/StandardizedJob';
import { JobProcessor, ProcessedJobResult, GreenhouseJob } from '../jobProcessors/types';
import { GreenhouseProcessor } from '../jobProcessors/greenhouseProcessor';
import { LeverProcessor } from '../jobProcessors/LeverProcessor';
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
    logger.info('Initializing JobProcessingAdapter...');
    this.jobProcessingService = new JobProcessingService();
    logger.info('JobProcessingService instantiated.');
    
    // Initialize processors
    this.processors = new Map<string, JobProcessor>();
    logger.info('Processor map created.');

    try {
      logger.info('Attempting to instantiate GreenhouseProcessor...');
      this.processors.set('greenhouse', new GreenhouseProcessor());
      logger.info('GreenhouseProcessor instantiated and added.');
    } catch (error: any) {
        logger.error({ error }, 'Failed to instantiate GreenhouseProcessor');
    }
    
    try {
      logger.info('Attempting to instantiate LeverProcessor...');
      this.processors.set('lever', new LeverProcessor());
      logger.info('LeverProcessor instantiated and added.');
    } catch (error: any) {
        logger.error({ error }, 'Failed to instantiate LeverProcessor');
    }

    // Add other processors here as needed
    logger.info('JobProcessingAdapter initialization complete. Processors: %s', Array.from(this.processors.keys()).join(', '));
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
    // Enhanced logging for processor selection
    const lowerCaseSource = source.toLowerCase();
    const processor = this.processors.get(lowerCaseSource);
    const adapterLogger = logger.child({ adapter: 'JobProcessingAdapter', source: source });

    adapterLogger.info({ availableProcessors: Array.from(this.processors.keys()), requestedSource: source, lowerCaseSource }, `Attempting to find processor for source.`);

    if (!processor) {
      adapterLogger.error(`No processor found for source.`);
      return false;
    }

    adapterLogger.info({ processorSource: processor.source }, `Found processor. Starting processing...`);

    // Use a logger specific to this processing attempt
    const processLogger = adapterLogger.child({ processor: processor.source });
    // processLogger.debug({ rawJobData }, `Starting processing with ${processor.source} processor`); // Redundant with log above

    try {
      // Pass sourceData to the processor
      processLogger.info('>>> PRE-CALL: Attempting to call processor.processJob...');
      const result: ProcessedJobResult = await processor.processJob(rawJobData, sourceData);
      processLogger.info('<<< POST-CALL: processor.processJob completed.');

      if (!result.success || !result.job) {
        processLogger.warn({ error: result.error }, `Processor reported failure or irrelevant job.`);
        return false; // Processor failed or job wasn't relevant
      }

      processLogger.info({ jobId: result.job.sourceId, title: result.job.title }, `Processor returned standardized job. Attempting save...`);
      
      // Call the service to handle saving the standardized job
      const saved = await this.jobProcessingService.saveOrUpdateJob(result.job);
      
      if (!saved) {
         processLogger.warn({ standardizedJobId: result.job.sourceId }, `JobProcessingService failed to save/update the job.`);
      }
      
      return saved;

    } catch (error: any) { // Catch any error
      // Log detailed error information
      const errorDetails = {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        rawJobData: JSON.stringify(rawJobData)?.substring(0, 500) + '...' // Log snippet of raw data
      };
      processLogger.error({ error: errorDetails }, `*** CATCH BLOCK in JobProcessingAdapter.processRawJob ***`);
      return false;
    }
  }
} 