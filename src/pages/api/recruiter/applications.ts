import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { UserRole, ApplicationStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Schema para atualização de status da candidatura
const applicationStatusSchema = z.object({
  applicationId: z.string().uuid(),
  status: z.nativeEnum(ApplicationStatus),
  feedback: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  // Verificar autenticação e papel do usuário
  if (!session || !session.user || session.user.role !== UserRole.RECRUITER) {
    return res.status(401).json({ message: 'Não autorizado' });
  }

  const userId = session.user.id;

  // GET: Obter todas as candidaturas para as vagas da empresa do recrutador
  if (req.method === 'GET') {
    try {
      // Verificar se o recrutador existe e obter ID da empresa
      const recruiter = await prisma.recruiter.findUnique({
        where: { userId },
        select: { companyId: true },
      });

      if (!recruiter || !recruiter.companyId) {
        return res.status(404).json({ message: 'Empresa não encontrada' });
      }

      const companyId = recruiter.companyId;

      // Filtros opcionais
      const { jobId, status } = req.query;
      
      const whereClause: any = {
        job: {
          companyId: companyId,
        },
      };

      // Aplicar filtros se fornecidos
      if (jobId) {
        whereClause.jobId = jobId as string;
      }

      if (status) {
        whereClause.status = status as ApplicationStatus;
      }

      // Buscar candidaturas
      const applications = await prisma.application.findMany({
        where: whereClause,
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
            },
          },
          job: {
            select: {
              id: true,
              title: true,
              location: true,
              type: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return res.status(200).json({ applications });
    } catch (error) {
      console.error('Erro ao obter candidaturas:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  // PATCH: Atualizar status de uma candidatura
  if (req.method === 'PATCH') {
    try {
      const validationResult = applicationStatusSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Dados inválidos', 
          errors: validationResult.error.format() 
        });
      }

      const { applicationId, status, feedback } = validationResult.data;

      // Verificar se o recrutador tem acesso a esta candidatura
      const recruiter = await prisma.recruiter.findUnique({
        where: { userId },
        select: { companyId: true },
      });

      if (!recruiter || !recruiter.companyId) {
        return res.status(404).json({ message: 'Empresa não encontrada' });
      }

      // Verificar se a candidatura pertence a uma vaga da empresa do recrutador
      const application = await prisma.application.findUnique({
        where: { id: applicationId },
        include: {
          job: {
            select: {
              companyId: true,
            },
          },
        },
      });

      if (!application) {
        return res.status(404).json({ message: 'Candidatura não encontrada' });
      }

      if (application.job.companyId !== recruiter.companyId) {
        return res.status(403).json({ message: 'Sem permissão para atualizar esta candidatura' });
      }

      // Atualizar o status da candidatura
      const updatedApplication = await prisma.application.update({
        where: { id: applicationId },
        data: {
          status,
          feedback,
          updatedAt: new Date(),
        },
        include: {
          candidate: {
            include: {
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
          job: {
            select: {
              title: true,
            },
          },
        },
      });

      // Você pode adicionar notificações ou envio de emails aqui
      // para informar o candidato sobre a atualização do status

      return res.status(200).json({ application: updatedApplication });
    } catch (error) {
      console.error('Erro ao atualizar status da candidatura:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  return res.status(405).json({ message: 'Método não permitido' });
} 