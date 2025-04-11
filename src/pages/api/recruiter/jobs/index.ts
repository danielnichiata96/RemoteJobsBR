import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { JobStatus, JobType, ExperienceLevel, Currency, Prisma, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Schema para validação da vaga (ajustado para corresponder ao formulário)
const jobSchema = z.object({
  title: z.string().min(5, 'Título deve ter pelo menos 5 caracteres'),
  description: z.string().min(30, 'Descrição deve ter pelo menos 30 caracteres'),
  requirements: z.string().min(30, 'Requisitos devem ter pelo menos 30 caracteres'),
  responsibilities: z.string().min(30, 'Responsabilidades devem ter pelo menos 30 caracteres').optional(),
  benefits: z.string().optional(),
  jobType: z.nativeEnum(JobType),
  experienceLevel: z.nativeEnum(ExperienceLevel),
  skills: z.array(z.string()),
  tags: z.array(z.string()).optional().default([]),
  location: z.string(),
  country: z.string(),
  workplaceType: z.string(),
  minSalary: z.number().optional(),
  maxSalary: z.number().optional(),
  currency: z.nativeEnum(Currency).optional(),
  salaryCycle: z.string().optional(),
  showSalary: z.boolean().optional().default(false),
  status: z.nativeEnum(JobStatus).optional().default(JobStatus.DRAFT),
  visas: z.array(z.string()).optional().default([]),
  languages: z.array(z.string()).optional().default([]),
  applicationUrl: z.string().url('URL de aplicação inválida').optional().nullable(),
  applicationEmail: z.string().email('Email de aplicação inválido').optional().nullable(),
}).refine(data => {
  // Se o status é ACTIVE, então é necessário ter pelo menos applicationUrl ou applicationEmail
  if (data.status === JobStatus.ACTIVE) {
    return !!data.applicationUrl || !!data.applicationEmail;
  }
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

  // Verificar se o usuário é um recrutador com role COMPANY
  const user = await prisma.user.findUnique({
    where: { 
      email: session.user.email as string,
    }
  });

  if (!user || (user.role !== UserRole.COMPANY && user.role !== 'COMPANY')) {
    return res.status(403).json({ error: 'Acesso apenas para recrutadores' });
  }

  // Verificar método da requisição
  if (req.method === 'GET') {
    try {
      // Parâmetros de paginação e filtros
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as JobStatus | undefined;
      const search = req.query.search as string | undefined;
      
      // Construir query base
      const where: Prisma.JobWhereInput = {
        companyId: user.id,
        ...(status ? { status } : {})
      };
      
      // Adicionar condição de busca se necessário
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
          { description: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
          { skills: { has: search } }
        ];
      }
      
      // Contar total de vagas
      const totalJobs = await prisma.job.count({ where });
      
      // Buscar vagas com paginação
      const jobs = await prisma.job.findMany({
        where,
        select: {
          id: true,
          title: true,
          location: true,
          country: true,
          workplaceType: true,
          jobType: true,
          experienceLevel: true,
          skills: true,
          status: true,
          createdAt: true,
          publishedAt: true,
          minSalary: true,
          maxSalary: true,
          currency: true,
          viewCount: true,
          applicantCount: true,
          clickCount: true,
          _count: {
            select: {
              applications: true,
            }
          }
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      });

      return res.status(200).json({ 
        jobs,
        pagination: {
          page,
          limit,
          totalJobs,
          totalPages: Math.ceil(totalJobs / limit)
        }
      });
    } catch (error) {
      console.error('Erro ao buscar vagas:', error);
      return res.status(500).json({ error: 'Erro ao processar a solicitação' });
    }
  } else if (req.method === 'POST') {
    try {
      console.log('Dados recebidos:', JSON.stringify(req.body, null, 2));
      
      // Validar dados da nova vaga
      const validationResult = jobSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        console.error('Erros de validação:', validationResult.error.format());
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: validationResult.error.format()
        });
      }
      
      let jobData = validationResult.data;
      
      // Normalizar a applicationUrl antes de salvar
      if (jobData.applicationUrl && !jobData.applicationUrl.startsWith('http://') && !jobData.applicationUrl.startsWith('https://')) {
          if (!jobData.applicationUrl.includes('.')) { // Verificação muito básica se parece um domínio
              // Se não parece um domínio válido, talvez limpar ou lançar erro?
              // Por ora, vamos apenas limpar para evitar salvar dados inválidos.
              console.warn(`URL de aplicação inválida fornecida e não prefixada: ${jobData.applicationUrl}`);
              jobData = { ...jobData, applicationUrl: null }; // Limpar URL inválida
          } else {
              console.log(`Prefixando URL de aplicação: ${jobData.applicationUrl}`);
              jobData = { ...jobData, applicationUrl: `https://${jobData.applicationUrl}` };
          }
      }
      
      // Se responsabilidades não for fornecido, usar uma string padrão
      const responsibilities = jobData.responsibilities || 'Responsabilidades a definir';
      
      // Normalizar a data de publicação para vagas ativas
      let publishedAt = null;
      if (jobData.status === JobStatus.ACTIVE) {
        publishedAt = new Date();
        console.log('Nova vaga ativa, definindo publishedAt:', publishedAt.toISOString());
      }
      
      // Criar nova vaga
      const newJob = await prisma.job.create({
        data: {
          ...jobData,
          responsibilities,
          companyId: user.id,
          publishedAt,
          source: 'direct' // Garantir que vagas criadas pelo recrutador são marcadas como diretas
        },
      });

      return res.status(201).json({ 
        success: true,
        message: 'Vaga criada com sucesso',
        job: newJob 
      });
    } catch (error: any) {
      console.error('Erro ao criar vaga:', error);
      return res.status(500).json({ 
        error: 'Erro ao processar a solicitação', 
        details: error.message 
      });
    }
  } else if (req.method === 'PUT') {
    return res.status(400).json({ 
      error: 'Para atualizar uma vaga específica, utilize o endpoint /api/recruiter/jobs/[id]' 
    });
  }

  // Método não permitido
  return res.status(405).json({ error: 'Método não permitido' });
} 
