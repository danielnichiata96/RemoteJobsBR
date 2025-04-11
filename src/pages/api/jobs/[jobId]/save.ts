import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]'; // Adjust path if needed
import prisma from '@/lib/prisma'; // Adjust path if needed

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user || !session.user.id) {
    return res.status(401).json({ message: 'Unauthorized: User not logged in.' });
  }

  const { jobId } = req.query;

  if (typeof jobId !== 'string') {
    return res.status(400).json({ message: 'Invalid request: Missing or invalid jobId.' });
  }

  const candidateId = session.user.id;

  if (req.method === 'POST') {
    // --- Save a job --- 
    try {
      // Check if the job exists
      const jobExists = await prisma.job.findUnique({
        where: { id: jobId },
        select: { id: true } // Only select id for efficiency
      });

      if (!jobExists) {
        return res.status(404).json({ message: 'Job not found.' });
      }

      // Attempt to create the SavedJob entry
      const savedJob = await prisma.savedJob.create({
        data: {
          jobId: jobId,
          candidateId: candidateId,
        },
      });

      return res.status(201).json({ message: 'Job saved successfully.', savedJobId: savedJob.id });

    } catch (error: any) {
      // Handle potential unique constraint violation (already saved)
      if (error.code === 'P2002') {
        return res.status(409).json({ message: 'Job already saved.' });
      }
      // Handle foreign key constraint violation (job doesn't exist - redundant check but safe)
      if (error.code === 'P2003') {
        return res.status(404).json({ message: 'Job not found.' });
      }
      console.error('Error saving job:', error);
      return res.status(500).json({ message: 'Internal server error while saving job.' });
    }
  }
  
  else if (req.method === 'DELETE') {
    // --- Unsave a job --- 
    try {
      const result = await prisma.savedJob.deleteMany({
        where: {
          jobId: jobId,
          candidateId: candidateId,
        },
      });

      if (result.count === 0) {
        // This could mean the job wasn't saved, or the job/user doesn't exist.
        // We already check for user auth, so likely it wasn't saved.
        return res.status(404).json({ message: 'Saved job not found or already unsaved.' });
      }

      return res.status(200).json({ message: 'Job unsaved successfully.' });

    } catch (error) {
      console.error('Error unsaving job:', error);
      return res.status(500).json({ message: 'Internal server error while unsaving job.' });
    }
  }
  
  else {
    res.setHeader('Allow', ['POST', 'DELETE']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
} 