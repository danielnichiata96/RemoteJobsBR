// scripts/deactivateStaleJobs.ts
import { PrismaClient, JobStatus } from '@prisma/client';
import pino from 'pino';
import { Command } from 'commander';

const prisma = new PrismaClient();
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

interface ScriptOptions {
  days: number;
  dryRun: boolean;
}

async function main(options: ScriptOptions) {
  const { days, dryRun } = options;
  logger.info(`Starting stale job deactivation script with threshold: ${days} days. Dry run: ${dryRun}`);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  logger.info(`Calculated cutoff date: ${cutoffDate.toISOString()}`);

  try {
    // Find jobs that are ACTIVE and haven't been updated since the cutoff date
    const staleJobs = await prisma.job.findMany({
      where: {
        status: JobStatus.ACTIVE,
        updatedAt: {
          lt: cutoffDate, // Less than the cutoff date
        },
      },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        company: { select: { name: true } }, // Include company name for logging
      },
    });

    if (staleJobs.length === 0) {
      logger.info('✅ No stale jobs found matching the criteria.');
      return;
    }

    logger.info(`Found ${staleJobs.length} potentially stale jobs:`);
    staleJobs.forEach(job => {
      logger.info(`  - ID: ${job.id}, Title: "${job.title}", Company: ${job.company?.name || 'N/A'}, Last Updated: ${job.updatedAt.toISOString()}`);
    });

    if (dryRun) {
      logger.warn('DRY RUN enabled. No jobs will be deactivated.');
    } else {
      logger.info(`Attempting to deactivate ${staleJobs.length} jobs...`);
      const updateResult = await prisma.job.updateMany({
        where: {
          id: {
            in: staleJobs.map(job => job.id),
          },
          // Double-check status and date to prevent race conditions
          status: JobStatus.ACTIVE,
          updatedAt: {
            lt: cutoffDate,
          },
        },
        data: {
          status: JobStatus.CLOSED,
          // Optionally update updatedAt timestamp here if desired
          // updatedAt: new Date(), 
        },
      });

      logger.info(`✅ Successfully deactivated ${updateResult.count} stale jobs.`);
      if (updateResult.count !== staleJobs.length) {
           logger.warn(`Mismatch: Found ${staleJobs.length} stale jobs initially, but deactivated ${updateResult.count}. Some may have been updated/deactivated concurrently.`);
      }
    }
  } catch (error) {
    logger.error({ error }, '❌ An error occurred during stale job deactivation.');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    logger.info('Script finished.');
  }
}

const program = new Command();
program
  .option('-d, --days <number>', 'Number of days threshold for staleness', (value) => parseInt(value, 10), 14)
  .option('--dry-run', 'Run the script without making database changes', false)
  .action(main);

program.parse(process.argv);

// Handle cases where the script is run directly without arguments
if (!process.argv.slice(2).length) {
  // No arguments provided, run with defaults
  main(program.opts<ScriptOptions>());
} else if (process.argv.slice(2).length === 1 && process.argv[2] === '--help') {
   // Let commander handle help output if only --help is passed
   // Commander automatically handles this, so no explicit action needed here
} else {
   // Arguments were provided, Commander already parsed and called action
} 