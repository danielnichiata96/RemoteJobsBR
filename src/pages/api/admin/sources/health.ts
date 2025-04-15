import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]'; // Adjust path if needed
import { prisma } from '../../../../lib/prisma';
import { UserRole, JobSourceRunStats } from '@prisma/client';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Helper function to determine health status
function calculateHealthStatus(latestRun: JobSourceRunStats | null | undefined): string {
    if (!latestRun) {
        return 'Unknown'; // No run data yet
    }

    // Define time threshold for considering a run "stale" (e.g., 2 days)
    const staleThreshold = 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds
    const timeSinceRun = Date.now() - new Date(latestRun.runEndedAt || latestRun.runStartedAt).getTime();

    if (latestRun.status === 'FAILURE') {
        return 'Error';
    } else if (latestRun.status === 'PARTIAL_SUCCESS' || latestRun.jobsErrored > 0) {
        return 'Warning';
    } else if (latestRun.status === 'SUCCESS' && latestRun.jobsFound === 0 && latestRun.jobsRelevant === 0) {
        // Successful run but found nothing - could be okay or a warning
        return 'Warning'; // Consider this a warning for now
    } else if (timeSinceRun > staleThreshold) {
        // Successful, but hasn't run recently
        return 'Warning'; 
    } else if (latestRun.status === 'SUCCESS') {
        return 'Healthy';
    }

    return 'Unknown'; // Default fallback
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    const session = await getServerSession(req, res, authOptions);

    // Check authentication and authorization
    // @ts-ignore // Ignore possible type issue with custom session/user fields
    if (!session || session.user?.role !== UserRole.ADMIN) {
        logger.warn('Unauthorized access attempt to admin source health API');
        return res.status(403).json({ message: 'Forbidden: Access denied' });
    }

    logger.info({ userId: session.user.id }, 'Admin user accessed source health API');

    try {
        const sourcesWithStats = await prisma.jobSource.findMany({
            orderBy: {
                name: 'asc',
            },
            include: { // Use include to get related stats
                runStats: { // Relation field name
                    orderBy: {
                        runStartedAt: 'desc', // Get the latest run first
                    },
                    take: 1, // Only take the most recent run
                },
            },
        });

        // Map results to include health status
        const results = sourcesWithStats.map(source => {
            const latestRun = source.runStats && source.runStats.length > 0 ? source.runStats[0] : null;
            const healthStatus = calculateHealthStatus(latestRun);
            
            // Return a new object with healthStatus, latestRun, and essential source fields
            return {
                id: source.id,
                name: source.name,
                type: source.type,
                isEnabled: source.isEnabled,
                lastFetched: source.lastFetched,
                companyWebsite: source.companyWebsite,
                healthStatus: healthStatus,
                latestRun: latestRun // Include the latest run details for potential display
            };
        });

        logger.debug({ count: results.length }, 'Fetched and processed job sources for health dashboard');
        return res.status(200).json(results);

    } catch (error) {
        logger.error({ error }, 'Failed to fetch job sources for health dashboard');
        return res.status(500).json({ message: 'Internal Server Error' });
    }
} 