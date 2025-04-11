import { NextApiRequest, NextApiResponse } from 'next';
// Remove direct PrismaClient import
// import { PrismaClient, Prisma } from '@prisma/client'; 
// Import the shared prisma instance
import { prisma } from '@/lib/prisma'; 
// Import Prisma namespace for types if needed (like error type)
// import { Prisma } from '@prisma/client'; 

// Remove local prisma instance creation
// const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const { jobId } = req.query;

  // Keep validation as is
  if (typeof jobId !== 'string' || !jobId) { // Also check for empty string
    return res.status(400).json({ message: 'Invalid Job ID format' });
  }

  try {
    // Use the imported prisma instance
    const updatedJob = await prisma.job.update({
      where: {
        id: jobId,
      },
      data: {
        clickCount: {
          increment: 1,
        },
      },
    });

    return res.status(200).json({ message: 'Click tracked successfully', clickCount: updatedJob.clickCount });

  } catch (error) {
    console.error("API Error tracking job click:", error);

    // Simplify error check: Rely only on the error code (duck-typing)
    // This avoids issues with `instanceof` in testing environments.
    if ((error as any)?.code === 'P2025') { 
      return res.status(404).json({ message: 'Job not found to track click' });
    }

    return res.status(500).json({ message: 'Internal server error tracking click' });
  } finally {
    // Remove the explicit disconnect call
    // The shared Prisma instance should generally not be disconnected after each request.
    // Connection management is handled by Prisma's pooling.
    // await prisma.$disconnect(); 
    // console.log('Finally block reached'); // Optional debug log
  }
} 