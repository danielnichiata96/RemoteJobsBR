import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { JobStatus, UserRole } from '@prisma/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const userEmail = session.user.email as string;

  try {
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true, role: true }
    });

    if (!user || (user.role !== UserRole.COMPANY && user.role !== 'COMPANY')) {
      return res.status(403).json({ error: 'Acesso apenas para recrutadores' });
    }

    // Contar vagas ativas
    const publishedJobsCount = await prisma.job.count({
      where: {
        companyId: user.id,
        status: JobStatus.ACTIVE,
      },
    });

    // Contar total de vagas (todas as vagas, não apenas as ativas)
    const totalJobsCount = await prisma.job.count({
      where: {
        companyId: user.id,
      },
    });

    // Contar visualizações das vagas
    const viewsCount = await prisma.job.aggregate({
      where: {
        companyId: user.id,
      },
      _sum: {
        viewCount: true,
      },
    });

    return res.status(200).json({
      publishedJobsCount,
      totalJobsCount,
      viewsCount: viewsCount._sum.viewCount || 0,
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas do dashboard:', error);
    return res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
} 