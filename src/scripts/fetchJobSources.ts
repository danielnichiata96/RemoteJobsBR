import { PrismaClient, JobSource } from '@prisma/client';
import pMap from 'p-map';
import pino from 'pino';
import { JobProcessingAdapter } from '../lib/adapters/JobProcessingAdapter';
import { JobProcessingService } from '../lib/services/jobProcessingService';
import { GreenhouseFetcher } from '../lib/fetchers/GreenhouseFetcher';
import { LeverFetcher } from '../lib/fetchers/LeverFetcher';
import { JobFetcher, FetcherResult } from '../lib/fetchers/types';

// --- Configuração Inicial ---
const prisma = new PrismaClient();
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
      messageFormat: '{msg}', // Simple message format
      levelFirst: false, // Show level after timestamp
    },
  },
  base: undefined, // Don't bind pid, hostname
  level: process.env.LOG_LEVEL || 'info',
});

// Instantiate necessary services and adapters
const jobProcessorAdapter = new JobProcessingAdapter(); // Adapter handles processor selection
const jobProcessingService = new JobProcessingService(); // Service handles saving and deactivation

// --- Fetcher Mapping ---
// Maps source type string to the corresponding fetcher class instance
const fetcherMap = new Map<string, JobFetcher>();
fetcherMap.set('greenhouse', new GreenhouseFetcher(prisma, jobProcessorAdapter));
fetcherMap.set('lever', new LeverFetcher(prisma, jobProcessorAdapter));
// Add mappings for new fetchers here, e.g.:
// fetcherMap.set('workable', new WorkableFetcher(prisma, jobProcessorAdapter));

// --- Função Principal Refatorada ---
async function main() {
  logger.info('🚀 Starting job source fetching process...');

  let totalSourcesProcessed = 0;
  let totalJobsFound = 0;
  let totalJobsRelevant = 0; // Note: Relevance logic now within fetchers/processors
  let totalJobsProcessed = 0;
  let totalErrors = 0;
  let totalJobsDeactivated = 0;

  // Store active job source IDs found during the run, grouped by source type
  // Used later for deactivating jobs no longer present in the source
  const allActiveSourceIdsByType = new Map<string, Set<string>>();

  try {
    // 1. Fetch all active JobSource records from the database
    const sources = await prisma.jobSource.findMany({
      where: { isEnabled: true },
    });
    logger.info(`Found ${sources.length} active job sources to process.`);

    if (sources.length === 0) {
      logger.info('No active job sources found. Exiting.');
      return;
    }

    // 2. Process each source using the appropriate fetcher
    await pMap(
      sources,
      async (source: JobSource) => {
        const startTime = Date.now();
        // Create a logger specific to this source for better context
        const sourceLogger = logger.child({
          sourceId: source.id,
          sourceName: source.name,
          sourceType: source.type,
        });
        sourceLogger.info(`Processing source...`);

        // Find the correct fetcher based on the source type
        const fetcher = fetcherMap.get(source.type.toLowerCase());

        if (!fetcher) {
          sourceLogger.warn(
            `No fetcher registered for source type '${source.type}'. Skipping.`
          );
          totalErrors++; // Count as an error for the summary
          return; // Skip to the next source
        }

        try {
          // Execute the fetcher's processSource method
          const result: FetcherResult = await fetcher.processSource(
            source,
            sourceLogger
          );
          const duration = (Date.now() - startTime) / 1000;

          // Aggregate statistics
          totalJobsFound += result.stats.found;
          totalJobsRelevant += result.stats.relevant;
          totalJobsProcessed += result.stats.processed;
          totalErrors += result.stats.errors;

          // Store the set of job source IDs found for this source, grouped by type
          const sourceTypeName = source.type.toLowerCase();
          if (!allActiveSourceIdsByType.has(sourceTypeName)) {
            allActiveSourceIdsByType.set(sourceTypeName, new Set<string>());
          }
          const activeIdsForType = allActiveSourceIdsByType.get(sourceTypeName)!; // Assert non-null as we just set it
          result.foundSourceIds.forEach((id) => activeIdsForType.add(id));

          sourceLogger.info(
            {
              duration: `${duration.toFixed(2)}s`,
              found: result.stats.found,
              relevant: result.stats.relevant,
              processed: result.stats.processed,
              errors: result.stats.errors,
            },
            `Finished processing source.`
          );
          totalSourcesProcessed++;
        } catch (fetcherError) {
          // Catch errors specifically from the fetcher.processSource call
          totalErrors++;
          sourceLogger.error(
            { error: fetcherError },
            `Unhandled error during fetcher.processSource for source.`
          );
        }
      },
      { concurrency: 3, stopOnError: false } // Limit concurrency to avoid overwhelming sources/DB
    );

    // 3. Deactivate jobs that are no longer found in the active sources
    logger.info('Starting deactivation process for jobs no longer found...');
    for (const [sourceType, activeIds] of allActiveSourceIdsByType.entries()) {
      logger.info(`Deactivating jobs for source type: ${sourceType}...`);
      try {
        const deactivatedCount = await jobProcessingService.deactivateJobs(
          sourceType,
          activeIds
        );
        totalJobsDeactivated += deactivatedCount;
        logger.info(
          `Deactivated ${deactivatedCount} jobs for source type: ${sourceType}.`
        );
      } catch (deactivationError) {
        logger.error(
          { error: deactivationError, sourceType },
          `Error during deactivation for source type ${sourceType}`
        );
        totalErrors++; // Count deactivation errors as well
      }
    }
  } catch (error) {
    // Catch fatal errors during the main process (e.g., fetching sources)
    logger.error({ error }, '❌ Fatal error during the main fetching process');
    totalErrors++;
  } finally {
    // Ensure the database connection is closed
    await prisma.$disconnect();
    logger.info('Database connection closed.');
  }

  // 4. Log final summary statistics
  logger.info(
    {
      sources_processed: totalSourcesProcessed,
      jobs_found_total: totalJobsFound,
      // jobs_relevant_total: totalJobsRelevant, // Relevance is less meaningful at this top level now
      jobs_processed_total: totalJobsProcessed,
      jobs_deactivated_total: totalJobsDeactivated,
      errors_total: totalErrors,
    },
    '🏁 Job source fetching process finished.'
  );
}

// --- Execução ---
main()
  .then(() => {
    logger.info('Script executed successfully.');
    process.exit(0); // Exit with success code
  })
  .catch((e) => {
    logger.error(e, 'Script execution failed.');
    process.exit(1); // Exit with failure code
  });