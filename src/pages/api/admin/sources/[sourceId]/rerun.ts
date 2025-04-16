import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../pages/api/auth/[...nextauth]'; // Adjust path as needed
import { prisma } from '../../../../../lib/prisma';
import { UserRole } from '@prisma/client';
import { JobProcessingService } from '../../../../../lib/services/jobProcessingService'; // Fixed import path
import pino from 'pino';

const logger = pino({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
});

type ResponseData = {
    message: string;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData> // Response is typically just a message
) {
    // Instantiate the service INSIDE the handler
    const jobProcessingService = new JobProcessingService(prisma);

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    const session = await getServerSession(req, res, authOptions);

    if (!session || session.user?.role !== UserRole.ADMIN) {
        logger.warn({ userId: session?.user?.id, role: session?.user?.role }, 'Unauthorized attempt to re-run job source');
        return res.status(403).json({ message: 'Forbidden: Access denied' });
    }

    const { sourceId } = req.query;

    if (!sourceId || typeof sourceId !== 'string') {
        logger.warn('Re-run attempt with missing sourceId');
        return res.status(400).json({ message: 'Bad Request: Missing sourceId' });
    }

    const logCtx = logger.child({ sourceId, adminUserId: session.user.id });

    try {
        logCtx.info('Attempting to find job source for re-run');
        const jobSource = await prisma.jobSource.findUnique({
            where: { id: sourceId },
        });

        if (!jobSource) {
            logCtx.warn('Job source not found for re-run');
            return res.status(404).json({ message: 'Job source not found' });
        }

        if (!jobSource.isEnabled) {
            logCtx.warn({ isEnabled: jobSource.isEnabled }, 'Attempted to re-run a disabled job source');
            return res.status(400).json({ message: 'Cannot re-run a disabled job source' });
        }

        logCtx.info('Job source found and is enabled. Triggering re-run via JobProcessingService...');

        // Trigger the processing asynchronously. The API responds immediately.
        // We don't await this intentionally, as processing can take time.
        jobProcessingService.processJobSourceById(sourceId)
            .then(() => {
                logCtx.info('JobProcessingService.processJobSourceById completed successfully (async).');
            })
            .catch((processingError) => {
                // Log the error that occurred during the async processing
                logCtx.error({ error: processingError.message, stack: processingError.stack }, 'Error during asynchronous job source processing triggered by re-run');
                // Note: This error happens *after* the API response has been sent.
                // Implement proper background job error monitoring/alerting here.
            });

        logCtx.info('Re-run trigger sent to JobProcessingService.');
        return res.status(200).json({ message: `Re-run triggered for source ${sourceId}` });

    } catch (error: any) {
        // This catch block handles errors during the initial findUnique call or synchronous setup
        logCtx.error({ error: error.message, stack: error.stack }, 'Error preparing to re-run job source');
        return res.status(500).json({ message: 'Internal Server Error' });
    }
} 