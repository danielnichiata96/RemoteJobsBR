import { PrismaClient } from '@prisma/client';
import pino from 'pino';

const prisma = new PrismaClient();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

async function cleanupAshbyData() {
  logger.info('🧹 Starting Ashby data cleanup process...');

  try {
    // Find Ashby Job Sources
    const ashbySources = await prisma.jobSource.findMany({
      where: { type: 'ashby' }, // Case-sensitive match
      select: { id: true, name: true },
    });

    if (ashbySources.length === 0) {
      logger.info('✅ No JobSource records with type "ashby" found. No cleanup needed.');
      return;
    }

    const ashbySourceIds = ashbySources.map(source => source.id);
    logger.info(`🔍 Found ${ashbySources.length} Ashby sources: ${ashbySources.map(s => `${s.name} (ID: ${s.id})`).join(', ')}`);

    // Find Jobs linked to these sources
    const jobsToDelete = await prisma.job.findMany({
      where: {
        jobSourceId: { in: ashbySourceIds },
      },
      select: { id: true }, // Only select ID for deletion query
    });

    if (jobsToDelete.length === 0) {
      logger.info('✅ No Job records found linked to Ashby sources.');
    } else {
      logger.info(`🗑️ Found ${jobsToDelete.length} Job records linked to Ashby sources. Deleting them...`);
      const deleteJobsResult = await prisma.job.deleteMany({
        where: {
          id: { in: jobsToDelete.map(job => job.id) },
        },
      });
      logger.info(`✅ Deleted ${deleteJobsResult.count} Job records.`);
    }

    // Delete the JobSource records themselves
    logger.info('🗑️ Deleting the Ashby JobSource records themselves...');
    const deleteSourcesResult = await prisma.jobSource.deleteMany({
        where: {
            id: { in: ashbySourceIds },
        },
    });
    logger.info(`✅ Deleted ${deleteSourcesResult.count} Ashby JobSource records.`);


    logger.info('🏁 Ashby data cleanup process finished successfully.');

  } catch (error) {
    logger.error({ error }, '❌ Error during Ashby data cleanup process.');
    throw error; // Re-throw error to ensure script exits with non-zero code
  } finally {
    await prisma.$disconnect();
    logger.info('🔌 Database connection closed.');
  }
}

cleanupAshbyData()
  .then(() => {
      logger.info("Script completed successfully.");
      process.exit(0);
  })
  .catch((e) => {
    logger.error(e, 'Script execution failed.');
    process.exit(1);
  }); 