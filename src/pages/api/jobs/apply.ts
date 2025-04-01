import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '../auth/[...nextauth]';
import { z } from 'zod';
import { ApplicationStatus } from '@prisma/client';

// Schema para validação da candidatura
const applicationSchema = z.object({
  jobId: z.string().uuid(),
  coverLetter: z.string().optional(),
  resumeUrl: z.string().url().optional(),
  answers: z.record(z.string()).optional(), // Respostas para perguntas personalizadas
  phone: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  portfolioUrl: z.string().url().optional(),
  gitHubUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
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

  // Apenas método POST é permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Validar dados da requisição
    const validationResult = applicationSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: validationResult.error.format()
      });
    }

    const applicationData = validationResult.data;
    const { jobId } = applicationData;
    
    // Verificar se a vaga existe e está ativa
    const job = await prisma.job.findFirst({
      where: { 
        id: jobId,
        status: 'ACTIVE'
      }
    });
    
    if (!job) {
      return res.status(404).json({ error: 'Vaga não encontrada ou não está disponível' });
    }

    // Verificar se o usuário já se candidatou a esta vaga
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
      include: {
        candidate: {
          include: {
            applications: {
              where: { jobId }
            }
          }
        }
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Verificar se o usuário é um candidato
    if (!user.candidate) {
      // Criar perfil de candidato se não existir
      await prisma.candidate.create({
        data: {
          userId: user.id
        }
      });
    }
    
    // Verificar duplicidade de candidatura
    if (user.candidate?.applications.length > 0) {
      return res.status(409).json({ 
        error: 'Você já se candidatou a esta vaga',
        application: user.candidate.applications[0]
      });
    }

    // Criar a candidatura
    const application = await prisma.application.create({
      data: {
        job: { connect: { id: jobId } },
        candidate: { 
          connect: { 
            userId: user.id 
          } 
        },
        status: ApplicationStatus.SUBMITTED,
        coverLetter: applicationData.coverLetter,
        resumeUrl: applicationData.resumeUrl,
        answers: applicationData.answers || {},
        contactInfo: {
          email: user.email as string,
          phone: applicationData.phone,
          linkedinUrl: applicationData.linkedinUrl,
          portfolioUrl: applicationData.portfolioUrl,
          gitHubUrl: applicationData.gitHubUrl,
          websiteUrl: applicationData.websiteUrl,
        }
      }
    });
    
    // Incrementar contador de candidaturas na vaga
    await prisma.job.update({
      where: { id: jobId },
      data: { applicantCount: { increment: 1 } }
    });
    
    // Enviar notificação para o recrutador (implementação futura)
    
    return res.status(201).json({
      success: true,
      message: 'Candidatura enviada com sucesso',
      applicationId: application.id
    });
  } catch (error) {
    console.error('Erro ao processar candidatura:', error);
    return res.status(500).json({ error: 'Erro ao processar a candidatura' });
  }
} 
