const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * List of companies using AshbyHQ known for remote/distributed hiring.
 * jobBoardName is the identifier in the Ashby URL: https://jobs.ashbyhq.com/{jobBoardName}
 *
 * Note: Hiring policies change. This list focuses on companies known to use
 * Ashby, but individual job relevance still depends on the fetching script's filtering.
 */
const companies = [
  { name: 'Synthflow', jobBoardName: 'synthflow' },
  { name: 'Silver', jobBoardName: 'silver' },
  { name: 'Sierra Studio', jobBoardName: 'sierra-studio' },
  { name: 'Dynamic', jobBoardName: 'dynamic' },
  { name: 'Zapier', jobBoardName: 'zapier' },
  // Add more Ashby companies here as needed
];

async function main() {
  console.log(`Starting to add/verify ${companies.length} Ashby companies...`);
  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  try {
    for (const company of companies) {
      if (!company.jobBoardName) {
        console.error(`❌ Skipping ${company.name}: jobBoardName is missing.`);
        errorCount++;
        continue;
      }

      try {
        // Check if a job source with this jobBoardName already exists for Ashby
        const existing = await prisma.jobSource.findFirst({
          where: {
            type: 'ashby',
            // Check within the JSON config field for jobBoardName
            config: {
              path: ['jobBoardName'],
              equals: company.jobBoardName,
            }
          }
        });

        if (existing) {
          console.log(`⏭️ Company with jobBoardName '${company.jobBoardName}' (${existing.name || 'N/A'}) already exists, skipping.`);
          skippedCount++;
          continue; // Skip if boardToken already exists
        }

        // Optional: Check by name as a fallback (less reliable for Ashby)
        // const existingByName = await prisma.jobSource.findFirst({
        //   where: {
        //     name: company.name,
        //     type: 'ashby'
        //   }
        // });
        // if(existingByName) {
        //      console.log(`WARN: Company named '${company.name}' exists but with different/missing jobBoardName? Skipping creation for jobBoardName '${company.jobBoardName}'. Manual check advised.`);
        //      skippedCount++;
        //      continue;
        // }

        // Create the job source
        const jobSource = await prisma.jobSource.create({
          data: {
            name: company.name,
            type: 'ashby',
            isEnabled: true, // Default to enabled
            config: { jobBoardName: company.jobBoardName }, // Store jobBoardName in JSON config
            lastFetched: null, // Initialize lastFetched
            // companyWebsite: company.website || null, // Optional: Add website if known
          }
        });

        console.log(`✅ Created job source: ${jobSource.name} (jobBoardName: ${company.jobBoardName})`);
        createdCount++;
      } catch (error) {
        console.error(`❌ Error processing ${company.name} (jobBoardName: ${company.jobBoardName}):`, error instanceof Error ? error.message : String(error));
        errorCount++;
      }
    }

    console.log('\n--- Summary ---');
    console.log(`Companies Processed: ${companies.length}`);
    console.log(`✅ Created: ${createdCount}`);
    console.log(`⏭️ Skipped (Already Exists/Missing ID): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('Done adding Ashby companies!');

  } catch (error) {
    console.error('❌ Fatal error during script execution:', error);
  } finally {
    await prisma.$disconnect();
    console.log('Prisma client disconnected.');
  }
}

main(); 