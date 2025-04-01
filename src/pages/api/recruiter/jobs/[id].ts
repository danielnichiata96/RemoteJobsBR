import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { JobStatus, JobType, ExperienceLevel, Currency, Prisma, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Schema para validação da atualização da vaga
const jobUpdateSchema = z.object({
  title: z.string().min(5, 'Título deve ter pelo menos 5 caracteres').optional(),
  description: z.string().min(30, 'Descrição deve ter pelo menos 30 caracteres').optional(),
  requirements: z.string().min(30, 'Requisitos devem ter pelo menos 30 caracteres').optional(),
  responsibilities: z.string().min(30, 'Responsabilidades devem ter pelo menos 30 caracteres').optional(),
  benefits: z.string().optional(),
  jobType: z.nativeEnum(JobType).optional(),
  experienceLevel: z.nativeEnum(ExperienceLevel).optional(),
  skills: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  location: z.string().optional(),
  country: z.string().optional(),
  workplaceType: z.string().optional(),
  minSalary: z.number().optional(),
  maxSalary: z.number().optional(),
  currency: z.nativeEnum(Currency).optional(),
  salaryCycle: z.string().optional(),
  showSalary: z.boolean().optional(),
  status: z.nativeEnum(JobStatus).optional(),
  visas: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  applicationUrl: z.string().url().optional(),
  applicationEmail: z.string().email().optional(),
});

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
    where: { 
      email: session.user.email as string,
    }
  });

  if (!user || (user.role !== UserRole.COMPANY && user.role !== 'COMPANY')) {
    return res.status(403).json({ error: 'Acesso apenas para recrutadores' });
  }

  // Obter ID da vaga da URL
  const jobId = req.query.id as string;
  
  // Verificar se a vaga existe e pertence ao recrutador
  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      companyId: user.id
    }
  });
  
  if (!job) {
    return res.status(404).json({ error: 'Vaga não encontrada ou você não tem permissão para acessá-la' });
  }

  // Método GET - Obter detalhes da vaga
  if (req.method === 'GET') {
    try {
      const jobDetails = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          _count: {
            select: {
              applications: true,
              savedBy: true
            }
          },
          applications: {
            select: {
              id: true,
              createdAt: true,
              status: true,
              candidate: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            },
            take: 10
          }
        }
      });
      
      // Estatísticas simplificadas
      const stats = {
        viewsToday: job.viewCount > 0 ? Math.floor(Math.random() * 10) : 0, // Valor simulado para teste
        views7Days: job.viewCount, // Usando o campo existente viewCount
        applicationsByDay: await prisma.application.groupBy({
          by: ['createdAt'],
          where: { jobId },
          _count: true,
          orderBy: {
            createdAt: 'asc'
          },
          take: 30
        })
      };

      return res.status(200).json({ 
        job: jobDetails,
        stats
      });
    } catch (error) {
      console.error('Erro ao obter detalhes da vaga:', error);
      return res.status(500).json({ error: 'Erro ao processar a solicitação' });
    }
  } 
  
  // Método PUT - Atualizar vaga
  else if (req.method === 'PUT') {
    try {
      // Validar dados da atualização
      const validationResult = jobUpdateSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: validationResult.error.format()
        });
      }
      
      const updateData = validationResult.data;
      
      // Verificar mudança de status para publicação
      const publishData = {};
      if (updateData.status === JobStatus.ACTIVE && job.status !== JobStatus.ACTIVE) {
        Object.assign(publishData, { publishedAt: new Date() });
      }
      
      // Atualizar a vaga
      const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: {
          ...updateData,
          ...publishData
        }
      });

      return res.status(200).json({ 
        success: true,
        message: 'Vaga atualizada com sucesso',
        job: updatedJob
      });
    } catch (error) {
      console.error('Erro ao atualizar vaga:', error);
      return res.status(500).json({ error: 'Erro ao processar a solicitação' });
    }
  } 
  
  // Método DELETE - Excluir vaga
  else if (req.method === 'DELETE') {
    try {
      // Se houver candidaturas, apenas marcar como fechada
      const applicationsCount = await prisma.application.count({
        where: { jobId }
      });
      
      if (applicationsCount > 0) {
        const closedJob = await prisma.job.update({
          where: { id: jobId },
          data: { status: JobStatus.CLOSED }
        });
        
        return res.status(200).json({
          success: true,
          message: 'Vaga fechada com sucesso (não foi excluída pois possui candidaturas)',
          job: closedJob
        });
      }
      
      // Se não houver candidaturas, excluir completamente
      await prisma.job.delete({
        where: { id: jobId }
      });
      
      return res.status(200).json({
        success: true,
        message: 'Vaga excluída com sucesso'
      });
    } catch (error) {
      console.error('Erro ao excluir vaga:', error);
      return res.status(500).json({ error: 'Erro ao processar a solicitação' });
    }
  }

  // Método não permitido
  return res.status(405).json({ error: 'Método não permitido' });
} 