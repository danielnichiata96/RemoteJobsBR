const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * List of companies using Greenhouse known for remote/distributed hiring.
 * boardToken is the identifier in the Greenhouse URL.
 * How to find it:
 * 1. Go to the company's career page.
 * 2. Click on a job listing.
 * 3. Look at the URL. If it's like `https://boards.greenhouse.io/{boardToken}/jobs/...`,
 *    then `{boardToken}` is what you need.
 *
 * Note: Hiring policies change. This list focuses on companies historically
 * known for remote work using Greenhouse, but individual job relevance
 * still depends on your fetching script's filtering.
 */
const companies = [
  // Original List
  { name: 'Stripe', boardToken: 'stripe' },
  { name: 'GitLab', boardToken: 'gitlab' },       // All-remote company
  { name: 'CircleCI', boardToken: 'circleci' },   // CI/CD platform, often remote roles

  // Additional Companies (Verified Greenhouse Usage & Remote Hiring Reputation)
  { name: 'HubSpot', boardToken: 'hubspot' },     // Marketing/Sales software, offers remote options
  { name: 'Mozilla', boardToken: 'mozilla' },     // Firefox browser, non-profit, remote-friendly
  { name: 'Wikimedia Foundation', boardToken: 'wikimedia' }, // Wikipedia's parent org, remote-friendly non-profit
  { name: 'Remote', boardToken: 'remotecom' },      // Company focused on remote work itself
  { name: 'Coinbase', boardToken: 'coinbase' },   // Cryptocurrency exchange, remote-first announced
  { name: 'Twilio', boardToken: 'twilio' },       // Communications API, historically remote-friendly
  { name: 'Dropbox', boardToken: 'dropbox' },     // Cloud storage, shifted to "Virtual First"
  { name: 'Reddit', boardToken: 'reddit' },       // Social media platform, increased remote hiring
  { name: 'HashiCorp', boardToken: 'hashicorp' }, // Infrastructure software (Terraform, Vault), remote-first foundation
  { name: 'Vercel', boardToken: 'vercel' },       // Frontend cloud platform (Next.js), remote-friendly
  { name: 'Figma', boardToken: 'figma' },         // Design tool, offers remote roles
  { name: 'Affirm', boardToken: 'affirm' },       // Fintech (BNPL), remote-first
  { name: 'Cloudflare', boardToken: 'cloudflare' }, // Web infrastructure/security, global presence, many remote roles
  { name: 'Datadog', boardToken: 'datadog' },     // Monitoring/Analytics, global presence, offers remote
  { name: 'Elastic', boardToken: 'elastic' },     // Search/Analytics (Elasticsearch), distributed company
  { name: 'Grafana Labs', boardToken: 'grafanalabs' }, // Observability platform (Grafana), remote-first
  { name: 'Valtech', boardToken: 'valtechgreenhouse' }, // Digital agency, various remote roles
  { name: 'Brave', boardToken: 'brave' },         // Privacy-focused browser, remote-friendly
  { name: 'Canonical', boardToken: 'canonical' }, // Ubuntu Linux, remote-friendly
  // Add more as you find them!
];

async function main() {
  console.log(`Starting to add/verify ${companies.length} Greenhouse companies...`);
  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  try {
    for (const company of companies) {
      try {
        // Check if a job source with this boardToken already exists for Greenhouse
        // Using boardToken in config is a more unique identifier than just name
        const existing = await prisma.jobSource.findFirst({
          where: {
            type: 'greenhouse',
            // Check within the JSON config field
            config: {
              path: ['boardToken'], // Specify the path within the JSON
              equals: company.boardToken, // Check for equality
            }
          }
        });

        if (existing) {
          // Optional: Update isEnabled or name if needed, but for now, just skip.
          // console.log(`Company with boardToken '${company.boardToken}' (${existing.name}) already exists, skipping.`);
          skippedCount++;
          continue; // Skip if boardToken already exists
        }

        // Check if the name exists (less reliable but good for catching duplicates if boardToken changes)
        const existingByName = await prisma.jobSource.findFirst({
          where: {
            name: company.name,
            type: 'greenhouse'
          }
        });
        if(existingByName) {
             console.log(`WARN: Company named '${company.name}' exists but with different/missing boardToken? Skipping creation for boardToken '${company.boardToken}'. Manual check advised.`);
             skippedCount++;
             continue;
        }


        // Create the job source
        const jobSource = await prisma.jobSource.create({
          data: {
            name: company.name,
            type: 'greenhouse',
            isEnabled: true, // Default to enabled
            config: { boardToken: company.boardToken }, // Store boardToken in JSON config
            lastFetched: null, // Initialize lastFetched
          }
        });

        console.log(`✅ Created job source: ${jobSource.name} (boardToken: ${company.boardToken})`);
        createdCount++;
      } catch (error) {
        console.error(`❌ Error processing ${company.name} (boardToken: ${company.boardToken}):`, error.message);
        errorCount++;
      }
    }

    console.log('--- Summary ---');
    console.log(`Companies Processed: ${companies.length}`);
    console.log(`✅ Created: ${createdCount}`);
    console.log(`⏭️ Skipped (Already Exists): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('Done adding companies!');

  } catch (error) {
    console.error('❌ Fatal error during script execution:', error);
  } finally {
    await prisma.$disconnect();
    console.log('Prisma client disconnected.');
  }
}

main(); 