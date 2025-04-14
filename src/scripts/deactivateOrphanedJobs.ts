/**
 * Script to deactivate "orphaned" jobs - jobs from sources that no longer exist
 * in the JobSource table or are no longer enabled.
 */

import { PrismaClient, JobStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding and deactivating orphaned jobs...');
  console.log('---------------------------------------------');

  try {
    // 1. Get all unique source types with active jobs
    const jobSources = await prisma.job.findMany({
      where: {
        status: JobStatus.ACTIVE
      },
      select: {
        source: true,
        company: {
          select: {
            id: true,
            name: true
          }
        }
      },
      distinct: ['source', 'companyId']
    });

    // Group by source and company
    const sourceCompanies = jobSources.reduce((acc, job) => {
      if (!acc[job.source]) {
        acc[job.source] = new Map();
      }
      if (job.company && job.company.name) {
        acc[job.source].set(job.company.id, job.company.name);
      }
      return acc;
    }, {} as Record<string, Map<string, string>>);

    console.log(`Found ${Object.keys(sourceCompanies).length} unique source types with active jobs`);
    
    // 2. For each source, check if there's a corresponding enabled JobSource
    let totalJobsDeactivated = 0;
    let totalSourcesProcessed = 0;

    for (const [source, companies] of Object.entries(sourceCompanies)) {
      totalSourcesProcessed++;
      console.log(`\nProcessing source: ${source} (Companies: ${Array.from(companies.values()).join(', ')})`);
      
      // For each company, check if there's an enabled job source
      for (const [companyId, companyName] of companies.entries()) {
        const activeJobSource = await prisma.jobSource.findFirst({
          where: {
            type: source,
            name: companyName,
            isEnabled: true
          }
        });

        if (!activeJobSource) {
          console.log(`  ⚠️ No active job source found for ${companyName} (${source})`);
          
          // Deactivate all jobs for this company and source
          const deactivationResult = await prisma.job.updateMany({
            where: {
              source,
              companyId,
              status: JobStatus.ACTIVE
            },
            data: {
              status: JobStatus.CLOSED
            }
          });
          
          totalJobsDeactivated += deactivationResult.count;
          console.log(`  🗑️ Deactivated ${deactivationResult.count} jobs for ${companyName} (${source})`);
        } else {
          console.log(`  ✅ Found active job source for ${companyName} (${source})`);
        }
      }
    }

    console.log('\n---------------------------------------------');
    console.log(`🏁 Process completed!`);
    console.log(`   - Sources processed: ${totalSourcesProcessed}`);
    console.log(`   - Jobs deactivated: ${totalJobsDeactivated}`);

  } catch (error) {
    console.error('Error during orphaned job cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  }); 