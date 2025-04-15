import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]'; // Adjust path as needed
import { prisma } from '../../../../lib/prisma';
import { UserRole, JobSource } from '@prisma/client';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'PATCH') {
        res.setHeader('Allow', ['PATCH']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    const session = await getServerSession(req, res, authOptions);

    // Check authentication and authorization
    // @ts-ignore // Ignore possible type issue with custom session/user fields
    if (!session || session.user?.role !== UserRole.ADMIN) {
        logger.warn('Unauthorized access attempt to toggle job source API');
        return res.status(403).json({ message: 'Forbidden: Access denied' });
    }

    const { sourceId } = req.query;

    if (typeof sourceId !== 'string' || !sourceId) {
        logger.warn('Invalid sourceId provided for toggle');
        return res.status(400).json({ message: 'Bad Request: Missing or invalid sourceId' });
    }

    const adminUserId = session.user.id;
    logger.info({ adminUserId, sourceId }, 'Admin request to toggle job source status');

    try {
        // 1. Fetch the current source to get its current state
        const currentSource = await prisma.jobSource.findUnique({
            where: { id: sourceId },
        });

        if (!currentSource) {
            logger.warn({ adminUserId, sourceId }, 'Job source not found for toggling');
            return res.status(404).json({ message: 'Job source not found' });
        }

        // 2. Update the source with the toggled isEnabled status
        const updatedSource = await prisma.jobSource.update({
            where: { id: sourceId },
            data: {
                isEnabled: !currentSource.isEnabled, // Toggle the status
            },
        });

        logger.info({ adminUserId, sourceId, newStatus: updatedSource.isEnabled }, 'Successfully toggled job source status');
        return res.status(200).json(updatedSource);

    } catch (error) {
        logger.error({ error, adminUserId, sourceId }, 'Failed to toggle job source status');
        // Check for specific Prisma errors if needed, e.g., RecordNotFound
        return res.status(500).json({ message: 'Internal Server Error' });
    }
} 