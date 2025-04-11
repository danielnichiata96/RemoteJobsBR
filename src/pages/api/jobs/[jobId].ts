import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

// Create a prisma client instance for this endpoint
const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const { jobId } = req.query;

  if (typeof jobId !== 'string') {
    return res.status(400).json({ message: 'Invalid Job ID format' });
  }

  try {
    // Fetch the job and include its related company information
    const job = await prisma.job.findUnique({
      where: {
        id: jobId,
      },
      include: {
        company: true, // Include the related company data
      },
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Construct the response, ensuring company data is included if available
    const responseData = {
      id: job.id,
      title: job.title,
      description: job.description,
      createdAt: job.createdAt?.toISOString() ?? new Date().toISOString(), // Use optional chaining and nullish coalescing
      updatedAt: job.updatedAt?.toISOString() ?? new Date().toISOString(),
      publishedAt: job.publishedAt?.toISOString() ?? job.createdAt?.toISOString() ?? new Date().toISOString(),
      jobType: job.jobType ?? 'FULL_TIME',
      experienceLevel: job.experienceLevel ?? 'MID',
      skills: job.skills ?? [],
      tags: job.tags ?? [],
      location: job.location ?? 'Remote',
      workplaceType: job.workplaceType ?? 'REMOTE',
      applicationUrl: job.applicationUrl,
      applicationEmail: job.applicationEmail,
      company: job.company // Use the fetched company data
        ? {
            id: job.company.id,
            name: job.company.name,
            logo: job.company.logoUrl, // Assuming logoUrl field exists for direct logo link
            websiteUrl: job.company.websiteUrl // Include websiteUrl if needed for logo generation on frontend
            // Add other necessary company fields
          }
        : {
            id: "placeholder", // Fallback if company relationship is missing
            name: "Company Information Unavailable", 
            logo: null,
            websiteUrl: null
          }
    };

    return res.status(200).json(responseData);

  } catch (error) {
    console.error("API Error fetching job details:", error); // Log the error for debugging
    // Check for specific Prisma errors if needed
    // if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    //   return res.status(404).json({ message: 'Job not found' });
    // }
    return res.status(500).json({ message: 'Internal server error retrieving job details' });
  } finally {
    // Explicitly disconnect
    await prisma.$disconnect();
  }
} 