import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../pages/api/auth/[...nextauth]';
import { prisma } from '../../../../../lib/prisma';
import { UserRole } from '@prisma/client';
import pino from 'pino';

const logger = pino({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
});

type ErrorResponse = {
    message: string;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<any | ErrorResponse> // Response can be the updated JobSource or an error
) {
    if (req.method !== 'PATCH') {
        res.setHeader('Allow', ['PATCH']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    const session = await getServerSession(req, res, authOptions);

    if (!session || session.user?.role !== UserRole.ADMIN) {
        logger.warn({ userId: session?.user?.id, role: session?.user?.role }, 'Unauthorized attempt to toggle job source');
        return res.status(403).json({ message: 'Forbidden: Access denied' });
    }

    const { sourceId } = req.query;

    if (!sourceId || typeof sourceId !== 'string') {
        logger.warn('Toggle attempt with missing sourceId');
        return res.status(400).json({ message: 'Bad Request: Missing sourceId' });
    }

    const logCtx = logger.child({ sourceId, adminUserId: session.user.id });

    try {
        logCtx.info('Attempting to find job source for toggle');
        const jobSource = await prisma.jobSource.findUnique({
            where: { id: sourceId },
        });

        if (!jobSource) {
            logCtx.warn('Job source not found for toggle');
            return res.status(404).json({ message: 'Job source not found' });
        }

        logCtx.info({ currentIsEnabled: jobSource.isEnabled }, 'Found job source, attempting to toggle');
        const updatedJobSource = await prisma.jobSource.update({
            where: { id: sourceId },
            data: {
                isEnabled: !jobSource.isEnabled,
            },
        });

        logCtx.info({ newIsEnabled: updatedJobSource.isEnabled }, 'Job source toggled successfully');
        return res.status(200).json(updatedJobSource); // Return the updated source

    } catch (error: any) {
        if (error.code === 'P2025') { // Prisma error code for record not found during update (should be caught by findUnique, but as a safeguard)
            logCtx.warn('Job source not found during update attempt (race condition?)');
            return res.status(404).json({ message: 'Job source not found' });
        }
        logCtx.error({ error: error.message, stack: error.stack }, 'Error toggling job source status');
        // Determine if the error came from findUnique or update for better logging/response
        // For simplicity now, just return 500
        const errorMessage = error.message.includes('update') ? 'Internal Server Error updating source' : 'Internal Server Error';
        return res.status(500).json({ message: errorMessage });
    }
} 