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
  benefits: z.string().optional().nullable(),
  jobType: z.nativeEnum(JobType).optional(),
  experienceLevel: z.nativeEnum(ExperienceLevel).optional(),
  skills: z.array(z.string()).optional(),
  location: z.string().optional(),
  country: z.string().optional(),
  workplaceType: z.string().optional(),
  minSalary: z.number().optional().nullable(),
  maxSalary: z.number().optional().nullable(),
  currency: z.nativeEnum(Currency).optional(),
  salaryCycle: z.string().optional(),
  showSalary: z.boolean().optional(),
  status: z.nativeEnum(JobStatus).optional(),
  visas: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  applicationUrl: z.string().url('URL de aplicação inválida').optional().nullable(),
  applicationEmail: z.string().email('Email de aplicação inválido').optional().nullable(),
  publishedAt: z.union([z.date(), z.string()]).optional().nullable(),
}).refine(async (data) => {
  // Se o status está sendo alterado para ACTIVE, verificar se há applicationUrl ou applicationEmail
  if (data.status === JobStatus.ACTIVE) {
    // Se applicationUrl ou applicationEmail está definido nos dados, basta verificar
    if (data.applicationUrl || data.applicationEmail) return true;
    
    // Se não estiver nos dados da requisição, precisamos verificar se já existe no banco
    // Como isso é uma função async, será resolvido antes da validação final
    if (typeof data.id === 'string') {
      const existingJob = await prisma.job.findUnique({
        where: { id: data.id },
        select: { applicationUrl: true, applicationEmail: true }
      });
      
      return existingJob && (!!existingJob.applicationUrl || !!existingJob.applicationEmail);
    }
    
    // Se não temos dados para verificar, falhar validação
    return false;
  }
  
  // Se não está alterando para ACTIVE, nenhuma validação adicional
  return true;
}, {
  message: "Uma vaga ativa precisa ter pelo menos uma URL de aplicação ou um email de aplicação definido",
  path: ["applicationUrl"]
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
      let jobData = req.body; // Usar let para permitir modificação
      
      console.log('Received job update data:', JSON.stringify(jobData, null, 2));
      
      const validatedData = jobUpdateSchema.safeParse(jobData);
      
      if (!validatedData.success) {
        console.error('Validation error:', validatedData.error.format());
        return res.status(400).json({ error: 'Invalid job data', details: validatedData.error.format() });
      }

      let data = validatedData.data; // Usar let para permitir modificação
      
      // --- Adicionar Normalização da applicationUrl --- 
      if (data.applicationUrl && !data.applicationUrl.startsWith('http://') && !data.applicationUrl.startsWith('https://')) {
          if (!data.applicationUrl.includes('.')) { 
              console.warn(`URL de aplicação inválida fornecida na atualização e não prefixada: ${data.applicationUrl}`);
              data = { ...data, applicationUrl: null }; // Limpar URL inválida
          } else {
              console.log(`Prefixando URL de aplicação na atualização: ${data.applicationUrl}`);
              data = { ...data, applicationUrl: `https://${data.applicationUrl}` };
          }
      }
      // --- Fim da Normalização ---

      // Verificar mudança de status para publicação
      const publishData = {};
      
      // If the client specified a publishedAt value, use it
      if (data.publishedAt !== undefined) {
        // Normalize date format, ensuring we get a valid JS Date object
        // This handles different regional date formats by using UTC
        let publishedAt;
        
        try {
          // Try to parse the date if it's a string
          if (typeof data.publishedAt === 'string') {
            publishedAt = new Date(data.publishedAt);
            
            // Check if date is valid
            if (isNaN(publishedAt.getTime())) {
              // If it's not valid, use current date
              console.warn('Invalid date format detected, using current date instead');
              publishedAt = new Date();
            }
          } else {
            // If it's already a Date object, use it
            publishedAt = data.publishedAt;
          }
          
          // Verify the year to catch potential date format confusion
          const year = publishedAt.getFullYear();
          if (year > 2030 || year < 2020) {
            console.warn(`Suspicious year detected: ${year}, using current date instead`);
            publishedAt = new Date();
          }
        } catch (e) {
          console.error('Error parsing date:', e);
          publishedAt = new Date();
        }
        
        Object.assign(publishData, { publishedAt });
        
        // Debug logging
        console.log('Normalized publishedAt date:', {
          original: data.publishedAt,
          normalized: publishedAt,
          timestamp: publishedAt.toISOString()
        });
      } 
      // Otherwise, set publishedAt automatically when job becomes active
      else if (data.status === JobStatus.ACTIVE && job.status !== JobStatus.ACTIVE) {
        const publishedAt = new Date();
        Object.assign(publishData, { publishedAt });
        
        // Debug logging
        console.log('Setting new publishedAt for newly activated job:', publishedAt);
      }

      // For sorting on homepage, ensure all active jobs have a publishedAt date
      if (data.status === JobStatus.ACTIVE && !job.publishedAt && !publishData.publishedAt) {
        Object.assign(publishData, { publishedAt: new Date() });
      }
      
      // Log for debugging
      console.log('Updating job:', { 
        id: jobId, 
        oldStatus: job.status,
        newStatus: data.status,
        oldPublishedAt: job.publishedAt,
        newPublishedAt: publishData.publishedAt || 'unchanged'
      });
      
      // Atualizar a vaga
      const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: {
          ...data,
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
  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
} 