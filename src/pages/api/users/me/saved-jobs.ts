import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]'; // Adjust path if needed
import prisma from '@/lib/prisma'; // Adjust path if needed
import { Job, UserRole } from '@/types/models'; // Ensure your types are correct

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user || !session.user.id) {
    return res.status(401).json({ message: 'Unauthorized: User not logged in.' });
  }

  const candidateId = session.user.id;

  try {
    const savedJobEntries = await prisma.savedJob.findMany({
      where: {
        candidateId: candidateId,
      },
      orderBy: {
        createdAt: 'desc', // Show most recently saved first
      },
      include: {
        job: { // Include the full Job details
          include: {
            company: { // Include the related company details
              select: {
                id: true,
                name: true,
                logo: true,
                isVerified: true,
                industry: true, // Add other company fields as needed
              },
            },
          },
        },
      },
    });

    // Format the response to return just the Job objects, potentially adding the savedAt timestamp
    const savedJobs = savedJobEntries.map(entry => ({
      ...entry.job, // Spread all job fields
      company: {
          ...entry.job.company, // Spread company fields
          // Ensure logo URL is absolute if needed or handle nulls
          logo: entry.job.company.logo || null, 
      },
      savedAt: entry.createdAt, // Include when the job was saved
      // Explicitly set isSaved to true for consistency on the frontend
      isSaved: true, 
    }));

    return res.status(200).json(savedJobs);

  } catch (error) {
    console.error('Error fetching saved jobs:', error);
    return res.status(500).json({ message: 'Internal server error while fetching saved jobs.' });
  }
} 