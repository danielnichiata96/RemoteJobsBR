import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check user authentication
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  // Only GET method is allowed for this endpoint
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Find the user ID by email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Fetch saved jobs with job details
    const savedJobs = await prisma.savedJob.findMany({
      where: { candidateId: user.id },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            description: true,
            location: true,
            country: true,
            jobType: true,
            experienceLevel: true,
            companyId: true,
            // Get company name through company relation
            company: {
              select: {
                name: true,
                logo: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform the data to include company name directly
    const savedJobsWithCompanyInfo = savedJobs.map(savedJob => {
      const { job, ...rest } = savedJob;
      return {
        ...rest,
        job: {
          ...job,
          companyName: job.company?.name || null,
          companyLogo: job.company?.logo || null
        }
      };
    });

    return res.status(200).json(savedJobsWithCompanyInfo);
  } catch (error) {
    console.error('Error fetching saved jobs:', error);
    return res.status(500).json({ error: 'Erro ao buscar vagas salvas' });
  }
} 