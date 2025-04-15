import { PrismaClient, UserRole } from '@prisma/client';
import { normalizeForDeduplication } from '../src/lib/utils/textUtils';

const prisma = new PrismaClient();
const BATCH_SIZE = 100; // Process records in batches

async function backfillCompanyNames() {
    console.log('Starting backfill for User normalizedCompanyName...');
    let updatedCount = 0;
    let cursorId: string | undefined = undefined;

    while (true) {
        const usersToUpdate = await prisma.user.findMany({
            take: BATCH_SIZE,
            cursor: cursorId ? { id: cursorId } : undefined,
            where: {
                role: UserRole.COMPANY,
                normalizedCompanyName: null,
            },
            select: {
                id: true,
                name: true,
            },
            orderBy: {
                id: 'asc',
            },
        });

        if (usersToUpdate.length === 0) {
            console.log('No more company users found needing normalized names.');
            break;
        }

        const updatePromises = usersToUpdate.map(user => {
            const normalizedName = normalizeForDeduplication(user.name);
            if (normalizedName) { // Only update if normalization produces a non-empty string
                return prisma.user.update({
                    where: { id: user.id },
                    data: { normalizedCompanyName: normalizedName },
                }).then(() => { updatedCount++; });
            } else {
                console.warn(`Skipping user ${user.id} as name "${user.name}" resulted in empty normalization.`);
                return Promise.resolve(); // Resolve immediately if skipping
            }
        });

        await Promise.all(updatePromises);
        console.log(`Processed batch of ${usersToUpdate.length} users. Total updated so far: ${updatedCount}`);
        
        cursorId = usersToUpdate[usersToUpdate.length - 1].id;
        
        // Small delay to prevent overwhelming the DB (optional)
        await new Promise(resolve => setTimeout(resolve, 50)); 
    }
    console.log(`Finished backfill for User normalizedCompanyName. Total updated: ${updatedCount}`);
}

async function backfillJobTitles() {
    console.log('Starting backfill for Job normalizedTitle...');
    let updatedCount = 0;
    let cursorId: string | undefined = undefined;

    while (true) {
        const jobsToUpdate = await prisma.job.findMany({
            take: BATCH_SIZE,
            cursor: cursorId ? { id: cursorId } : undefined,
            where: {
                normalizedTitle: null,
            },
            select: {
                id: true,
                title: true,
            },
            orderBy: {
                id: 'asc',
            },
        });

        if (jobsToUpdate.length === 0) {
            console.log('No more jobs found needing normalized titles.');
            break;
        }

        const updatePromises = jobsToUpdate.map(job => {
            const normalizedTitle = normalizeForDeduplication(job.title);
            if (normalizedTitle) { // Only update if normalization produces a non-empty string
                return prisma.job.update({
                    where: { id: job.id },
                    data: { normalizedTitle: normalizedTitle },
                }).then(() => { updatedCount++; });
            } else {
                console.warn(`Skipping job ${job.id} as title "${job.title}" resulted in empty normalization.`);
                return Promise.resolve(); // Resolve immediately if skipping
            }
        });

        await Promise.all(updatePromises);
        console.log(`Processed batch of ${jobsToUpdate.length} jobs. Total updated so far: ${updatedCount}`);
        
        cursorId = jobsToUpdate[jobsToUpdate.length - 1].id;

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.log(`Finished backfill for Job normalizedTitle. Total updated: ${updatedCount}`);
}

async function main() {
    console.log('Starting data backfill script...');
    await backfillCompanyNames();
    await backfillJobTitles();
    console.log('Backfill script completed successfully.');
}

main()
    .catch(e => {
        console.error('Error during backfill script:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        console.log('Prisma client disconnected.');
    }); 