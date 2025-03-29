import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { ApplicationStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Schema para validação da candidatura
const applicationSchema = z.object({
  resumeUrl: z.string().url('URL inválida para currículo').optional().nullable(),
  coverLetter: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Permitir apenas método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }
  
  // Verificar autenticação
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || !session.user) {
    return res.status(401).json({ message: 'Não autorizado. Por favor, faça login.' });
  }
  
  // Verificar se o usuário é um candidato
  if (session.user.role !== UserRole.CANDIDATE) {
    return res.status(403).json({ message: 'Acesso negado. Apenas candidatos podem se candidatar às vagas.' });
  }
  
  const userId = session.user.id;
  const jobId = req.query.id as string;
  
  try {
    // Verificar se a vaga existe e está ativa
    const job = await prisma.job.findUnique({
      where: { 
        id: jobId,
        status: 'ACTIVE'
      },
    });
    
    if (!job) {
      return res.status(404).json({ message: 'Vaga não encontrada ou não está ativa' });
    }
    
    // Verificar se o candidato já se candidatou a esta vaga
    const existingApplication = await prisma.application.findFirst({
      where: {
        jobId,
        candidate: {
          userId,
        },
      },
    });
    
    if (existingApplication) {
      return res.status(400).json({ message: 'Você já se candidatou a esta vaga' });
    }
    
    // Validar dados da candidatura
    const validationResult = applicationSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Dados inválidos',
        errors: validationResult.error.format() 
      });
    }
    
    const { resumeUrl, coverLetter } = validationResult.data;
    
    // Obter o candidato
    const candidate = await prisma.candidate.findUnique({
      where: { userId },
    });
    
    if (!candidate) {
      return res.status(404).json({ message: 'Perfil de candidato não encontrado' });
    }
    
    // Criar a candidatura
    const application = await prisma.application.create({
      data: {
        jobId,
        candidateId: candidate.id,
        resumeUrl,
        coverLetter,
        status: ApplicationStatus.SUBMITTED,
      },
      include: {
        job: {
          select: {
            title: true,
            company: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
    
    // Atualizar contador de candidaturas da vaga
    await prisma.job.update({
      where: { id: jobId },
      data: { applicantCount: { increment: 1 } },
    });
    
    // Registrar atividade do usuário
    await prisma.userActivityLog.create({
      data: {
        userId,
        actionType: 'JOB_APPLICATION',
        details: JSON.stringify({
          action: 'Candidatura enviada',
          jobId,
          jobTitle: job.title,
          applicationId: application.id,
        }),
      },
    });
    
    // Responder com sucesso
    return res.status(201).json({
      message: 'Candidatura enviada com sucesso',
      applicationId: application.id,
      jobTitle: application.job.title,
      companyName: application.job.company?.name,
    });
    
  } catch (error) {
    console.error('Erro ao processar candidatura:', error);
    return res.status(500).json({ 
      message: 'Erro ao processar candidatura',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
} 