import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const { jobId } = req.query;

  if (typeof jobId !== 'string') {
    return res.status(400).json({ message: 'Invalid Job ID format' });
  }

  try {
    const updatedJob = await prisma.job.update({
      where: {
        id: jobId,
      },
      data: {
        clickCount: {
          increment: 1,
        },
      },
      // Optionally select only the fields you need back, like the new count
      // select: { clickCount: true } 
    });

    // Optionally return the updated count or just a success status
    return res.status(200).json({ message: 'Click tracked successfully', clickCount: updatedJob.clickCount });

  } catch (error) {
    console.error("API Error tracking job click:", error);

    // Handle specific Prisma error for record not found
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ message: 'Job not found to track click' });
    }

    // Generic server error
    return res.status(500).json({ message: 'Internal server error tracking click' });
  } finally {
    await prisma.$disconnect();
  }
} 