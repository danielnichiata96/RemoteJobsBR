import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// List of company names to remove
const namesToRemove: string[] = [
    "Auth0",
    "Automattic",
    "Buffer",
    "DuckDuckGo"
];

async function main() {
  console.log(`Attempting to remove ${namesToRemove.length} job sources by name...`);
  let removedCount = 0;
  let errorCount = 0;

  try {
    for (const name of namesToRemove) {
      try {
        const result = await prisma.jobSource.deleteMany({
          where: {
            name: name,
          },
        });

        if (result.count > 0) {
          console.log(`✅ Successfully removed ${result.count} source(s) named '${name}'.`);
          removedCount += result.count;
        } else {
          console.log(`🤷 Source named '${name}' not found, skipping.`);
        }
      } catch (error) {
        console.error(`❌ Error removing source named '${name}':`, error instanceof Error ? error.message : error);
        errorCount++;
      }
    }
  } catch (error) {
    console.error('❌ Fatal error during script execution:', error);
  } finally {
    await prisma.$disconnect();
    console.log('--- Summary ---');
    console.log(`Sources targeted for removal: ${namesToRemove.length}`);
    console.log(`✅ Successfully removed: ${removedCount}`);
    console.log(`❌ Errors encountered: ${errorCount}`);
    console.log('Prisma client disconnected. Script finished.');
  }
}

main(); 