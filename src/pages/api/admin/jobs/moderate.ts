import type { NextApiRequest, NextApiResponse } from 'next';
import { JobStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import pino from 'pino';
import { z } from 'zod';

const logger = pino({ name: 'moderateJobApi', level: process.env.LOG_LEVEL || 'info' });

// --- Input Validation Schema --- 
const ModerateJobSchema = z.object({
  jobId: z.string().uuid('Invalid Job ID format'),
  action: z.enum(['APPROVE', 'REJECT'], { message: 'Invalid action specified' }),
});

// --- Response Type --- 
type ResponseData = {
  message: string;
  jobId?: string;
  newStatus?: JobStatus;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    logger.warn('Method not allowed attempt');
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  logger.debug({ body: req.body }, 'Received moderation request');

  // --- Validate Input --- 
  const validationResult = ModerateJobSchema.safeParse(req.body);
  if (!validationResult.success) {
    logger.warn({ errors: validationResult.error.flatten() }, 'Invalid request body');
    return res.status(400).json({ message: 'Invalid request body', ...validationResult.error.flatten() });
  }

  const { jobId, action } = validationResult.data;

  try {
    // --- Find the Job --- 
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      logger.warn({ jobId }, 'Job not found for moderation');
      return res.status(404).json({ message: 'Job not found' });
    }

    // --- Check if already moderated --- 
    // Optional: Prevent re-moderating if already ACTIVE or REJECTED?
    // if (job.status === JobStatus.ACTIVE || job.status === JobStatus.REJECTED) {
    //   logger.info({ jobId, currentStatus: job.status }, 'Job already moderated');
    //   return res.status(409).json({ message: `Job is already ${job.status}` });
    // }

    // --- Determine New Status --- 
    const newStatus = action === 'APPROVE' ? 'ACTIVE' as JobStatus : 'REJECTED' as JobStatus;
    logger.info({ jobId, action, oldStatus: job.status, newStatus }, 'Processing job moderation');

    // --- Update Job --- 
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: newStatus,
        // Optionally: add moderatorId if tracking who moderated
        // moderatedAt: new Date(), 
      },
    });

    logger.info({ jobId, newStatus: updatedJob.status }, 'Job moderation successful');
    
    // Fix message formation based on action
    const successMessage = action === 'APPROVE' 
      ? 'Job approved successfully.'
      : `Job ${action.toLowerCase()}ed successfully.`;
      
    return res.status(200).json({
      message: successMessage,
      jobId: updatedJob.id,
      newStatus: updatedJob.status,
    });

  } catch (error) {
    logger.error({ error, jobId, action }, 'Error moderating job');
    return res.status(500).json({ message: 'Internal Server Error' });
  }
} 