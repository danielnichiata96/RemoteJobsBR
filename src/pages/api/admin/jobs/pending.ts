import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { JobStatus, Job } from '@prisma/client';
import pino from 'pino';

const logger = pino({
  name: 'api/admin/jobs/pending',
  level: process.env.LOG_LEVEL || 'info',
});

// Define a type for the response data, including the company relation
type PendingJobWithCompany = Job & {
  company: {
    name: string;
    logo: string | null;
  } | null;
};

type ApiResponse = {
  jobs?: PendingJobWithCompany[];
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    logger.info('Fetching jobs with PENDING_REVIEW status...');
    
    const pendingJobs = await prisma.job.findMany({
      where: {
        status: JobStatus.PENDING_REVIEW,
      },
      include: {
        company: { // Include related company data
          select: {
            name: true,
            logo: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc', // Show most recently updated pending jobs first
      },
    });

    logger.info(`Found ${pendingJobs.length} pending jobs.`);

    res.status(200).json({ jobs: pendingJobs as PendingJobWithCompany[] }); // Cast to ensure type

  } catch (error) {
    logger.error({ error }, 'Error fetching pending jobs');
    res.status(500).json({ message: 'Internal Server Error fetching pending jobs' });
  }
} 