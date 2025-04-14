/**
 * Script to completely remove jobs from sources that don't exist in the JobSource table anymore
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Cleaning up jobs from removed sources...');
  console.log('------------------------------------------');

  try {
    // 1. Get all unique source/company combinations from jobs
    const allSourceCompanies = await prisma.job.groupBy({
      by: ['source', 'companyId'],
      _count: {
        id: true
      }
    });

    // 2. Get all existing job sources
    const existingJobSources = await prisma.jobSource.findMany({
      select: {
        id: true,
        type: true,
        name: true,
        isEnabled: true
      }
    });

    // 3. Map existing sources for lookup
    const existingSourcesByType = new Map();
    for (const source of existingJobSources) {
      if (!existingSourcesByType.has(source.type)) {
        existingSourcesByType.set(source.type, new Set());
      }
      existingSourcesByType.get(source.type).add(source.name);
    }

    console.log('\nExisting job sources:');
    for (const [sourceType, sourceNames] of existingSourcesByType.entries()) {
      console.log(`  - ${sourceType}: ${Array.from(sourceNames).join(', ')}`);
    }

    // 4. Identify company/source combinations to process
    const sourcesToProcess = [];

    for (const sourceGroup of allSourceCompanies) {
      const { source, companyId } = sourceGroup;
      
      // Get company name
      const company = await prisma.user.findUnique({
        where: { id: companyId },
        select: { name: true }
      });
      
      const companyName = company?.name || 'Unknown';
      
      // Check if this source type exists in our job sources
      const sourceExists = existingSourcesByType.has(source) && 
                          existingSourcesByType.get(source).has(companyName);
      
      if (!sourceExists) {
        sourcesToProcess.push({
          source,
          companyId,
          companyName,
          jobCount: sourceGroup._count.id
        });
      }
    }

    // 5. Print sources to remove and confirm with user
    if (sourcesToProcess.length === 0) {
      console.log('\n✅ No jobs from removed sources found. Nothing to cleanup.');
      return;
    }

    console.log('\nFound jobs from removed sources:');
    sourcesToProcess.forEach((src, index) => {
      console.log(`  ${index + 1}. ${src.companyName} (${src.source}) - ${src.jobCount} jobs`);
    });

    // 6. Ask for confirmation before proceeding
    console.log('\n⚠️ WARNING: This will PERMANENTLY DELETE these jobs from the database.');
    console.log('Do you want to proceed? (y/n)');
    
    // This is a synchronous prompt, but for a script it's fine
    const response = await new Promise(resolve => {
      process.stdin.once('data', data => {
        resolve(data.toString().trim().toLowerCase());
      });
    });

    if (response !== 'y') {
      console.log('❌ Operation cancelled by user.');
      return;
    }

    // 7. Delete jobs from each source
    console.log('\nDeleting jobs:');
    for (const src of sourcesToProcess) {
      console.log(`  Processing ${src.companyName} (${src.source})...`);
      
      const deleteResult = await prisma.job.deleteMany({
        where: {
          source: src.source,
          companyId: src.companyId
        }
      });
      
      console.log(`  ✓ Deleted ${deleteResult.count} jobs for ${src.companyName} (${src.source})`);
    }

    console.log('\n🏁 Job cleanup completed successfully!');

  } catch (error) {
    console.error('Error during cleanup:', error);
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