import { PrismaClient, JobSource } from '@prisma/client';
import pMap from 'p-map';
import pino from 'pino';
import { JobProcessingAdapter } from '../lib/adapters/JobProcessingAdapter';
import { JobProcessingService } from '../lib/services/jobProcessingService';
import { GreenhouseFetcher } from '../lib/fetchers/GreenhouseFetcher';
import { JobFetcher, FetcherResult, SourceStats } from '../lib/fetchers/types';
import { AshbyFetcher } from '../lib/fetchers/AshbyFetcher';
import { searchCache } from '../lib/cache/searchCache';

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

// --- Concurrency Configuration ---
const DEFAULT_CONCURRENCY = 5;
const fetchConcurrency = parseInt(process.env.FETCH_CONCURRENCY || '', 10);
const concurrencyLevel = 
    !isNaN(fetchConcurrency) && fetchConcurrency > 0 
    ? fetchConcurrency 
    : DEFAULT_CONCURRENCY;

// --- Fetcher Mapping ---
// Maps source type string to the corresponding fetcher class instance
const fetcherMap = new Map<string, JobFetcher>();
fetcherMap.set('greenhouse', new GreenhouseFetcher(prisma, jobProcessorAdapter));
fetcherMap.set('ashby', new AshbyFetcher(prisma, jobProcessorAdapter));
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
        const sourceLogger = logger.child({
          sourceId: source.id,
          sourceName: source.name,
          sourceType: source.type,
        });
        sourceLogger.info(`Processing source...`);

        const fetcher = fetcherMap.get(source.type.toLowerCase());

        let runStatus = 'FAILURE'; // Default to failure
        let fetcherResult: FetcherResult | null = null;

        if (!fetcher) {
          sourceLogger.warn(`No fetcher registered for source type '${source.type}'. Skipping.`);
          totalErrors++;
          fetcherResult = { 
            stats: { found: 0, relevant: 0, processed: 0, deactivated: 0, errors: 1 }, 
            foundSourceIds: new Set(), 
            durationMs: 0, 
            errorMessage: `No fetcher registered for type '${source.type}'` 
          };
        } else {
          try {
            fetcherResult = await fetcher.processSource(source, sourceLogger);
            
            // Determine status based on errors
            if (fetcherResult.stats.errors === 0 && !fetcherResult.errorMessage) {
              runStatus = 'SUCCESS';
            } else if (fetcherResult.stats.processed > 0 || fetcherResult.stats.relevant > 0) {
              runStatus = 'PARTIAL_SUCCESS'; // Some jobs processed despite errors
            } else {
              runStatus = 'FAILURE';
            }

            // Aggregate statistics
            totalJobsFound += fetcherResult.stats.found;
            totalJobsRelevant += fetcherResult.stats.relevant;
            totalJobsProcessed += fetcherResult.stats.processed;
            totalErrors += fetcherResult.stats.errors;

            // Store active IDs
            const sourceTypeName = source.type.toLowerCase();
            if (!allActiveSourceIdsByType.has(sourceTypeName)) {
              allActiveSourceIdsByType.set(sourceTypeName, new Set<string>());
            }
            const activeIdsForType = allActiveSourceIdsByType.get(sourceTypeName)!;
            fetcherResult.foundSourceIds.forEach((id) => activeIdsForType.add(id));

            sourceLogger.info(
              {
                duration: `${(fetcherResult.durationMs / 1000).toFixed(2)}s`,
                found: fetcherResult.stats.found,
                relevant: fetcherResult.stats.relevant,
                processed: fetcherResult.stats.processed,
                errors: fetcherResult.stats.errors,
                status: runStatus,
              },
              `Finished processing source.`
            );
            totalSourcesProcessed++;

          } catch (fetcherError) {
            totalErrors++;
            const errorMsg = fetcherError instanceof Error ? fetcherError.message : String(fetcherError);
            runStatus = 'FAILURE';
            fetcherResult = { 
              stats: { found: 0, relevant: 0, processed: 0, deactivated: 0, errors: 1 }, 
              foundSourceIds: new Set(), 
              durationMs: 0, // Or calculate duration until error if possible?
              errorMessage: `Unhandled error: ${errorMsg}` 
            };
            sourceLogger.error(
              { error: fetcherError },
              `Unhandled error during fetcher.processSource for source.`
            );
          }
        }
        
        // *** Save Run Statistics ***
        if (fetcherResult) {
          try {
            await prisma.jobSourceRunStats.create({
              data: {
                jobSourceId: source.id,
                runStartedAt: new Date(Date.now() - fetcherResult.durationMs), // Approximate start time
                // runEndedAt will be set by @updatedAt (or set explicitly)
                status: runStatus,
                jobsFound: fetcherResult.stats.found,
                jobsRelevant: fetcherResult.stats.relevant,
                jobsProcessed: fetcherResult.stats.processed,
                jobsErrored: fetcherResult.stats.errors,
                errorMessage: fetcherResult.errorMessage?.substring(0, 1000), // Truncate long messages
                durationMs: fetcherResult.durationMs,
              }
            });
            sourceLogger.trace('Saved run statistics to database.');
          } catch (statsError) {
            sourceLogger.error({ error: statsError }, 'Failed to save run statistics to database.');
            // Don't increment totalErrors here to avoid double counting
          }
        }
      },
      { concurrency: concurrencyLevel, stopOnError: false }
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

    // Clear the search API cache AFTER all processing and DB disconnect
    try {
        logger.info('Attempting to clear search API cache...');
        searchCache.flushAll();
        logger.info('Search API cache cleared successfully.');
    } catch (cacheError) {
        logger.error({ error: cacheError }, 'Failed to clear search API cache.');
        // Do not increment totalErrors here, as fetching might have been successful
    }
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