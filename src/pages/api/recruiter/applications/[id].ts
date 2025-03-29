import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import prisma from '@/lib/prisma';
import { ApplicationStatus } from '@prisma/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticação
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  // Verificar se o usuário é um recrutador
  const user = await prisma.user.findUnique({
    where: { email: session.user.email as string },
    include: { recruiter: true },
  });

  if (!user?.recruiter) {
    return res.status(403).json({ error: 'Acesso apenas para recrutadores' });
  }

  const applicationId = req.query.id as string;

  // Verificar método da requisição
  if (req.method === 'PATCH') {
    try {
      // Validar o corpo da requisição
      const { status } = req.body;

      if (!status || !Object.values(ApplicationStatus).includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
      }

      // Verificar se a aplicação existe e pertence a uma vaga da empresa do recrutador
      const application = await prisma.application.findUnique({
        where: { id: applicationId },
        include: {
          job: {
            include: {
              company: true,
            },
          },
        },
      });

      if (!application) {
        return res.status(404).json({ error: 'Candidatura não encontrada' });
      }

      // Verificar se a vaga pertence à empresa do recrutador
      if (application.job.companyId !== user.recruiter.companyId) {
        return res.status(403).json({ error: 'Acesso negado a esta candidatura' });
      }

      // Atualizar o status da candidatura
      const updatedApplication = await prisma.application.update({
        where: { id: applicationId },
        data: { status: status as ApplicationStatus },
      });

      return res.status(200).json({ application: updatedApplication });
    } catch (error) {
      console.error('Erro ao atualizar candidatura:', error);
      return res.status(500).json({ error: 'Erro ao processar a solicitação' });
    }
  } else if (req.method === 'GET') {
    try {
      // Buscar detalhes da candidatura
      const application = await prisma.application.findUnique({
        where: { id: applicationId },
        include: {
          candidate: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
              profile: true,
            },
          },
          job: {
            include: {
              company: {
                select: {
                  id: true,
                  name: true,
                  logo: true,
                },
              },
            },
          },
        },
      });

      if (!application) {
        return res.status(404).json({ error: 'Candidatura não encontrada' });
      }

      // Verificar se a vaga pertence à empresa do recrutador
      if (application.job.companyId !== user.recruiter.companyId) {
        return res.status(403).json({ error: 'Acesso negado a esta candidatura' });
      }

      return res.status(200).json({ application });
    } catch (error) {
      console.error('Erro ao buscar candidatura:', error);
      return res.status(500).json({ error: 'Erro ao processar a solicitação' });
    }
  }

  // Método não permitido
  return res.status(405).json({ error: 'Método não permitido' });
} 