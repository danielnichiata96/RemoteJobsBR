import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { JobStatus } from '@prisma/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Apenas método GET é permitido
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Obter ID da vaga
    const jobId = req.query.jobId as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
    
    if (!jobId) {
      return res.status(400).json({ error: 'ID da vaga não fornecido' });
    }

    // Buscar a vaga de referência
    const referenceJob = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        tags: true,
        skills: true,
        location: true,
        country: true,
        workplaceType: true,
        jobType: true,
        experienceLevel: true,
        companyId: true
      }
    });
    
    if (!referenceJob) {
      return res.status(404).json({ error: 'Vaga não encontrada' });
    }

    // Buscar vagas similares baseadas em tags, localização e skills
    const similarJobs = await prisma.job.findMany({
      where: {
        id: { not: jobId }, // Excluir a vaga de referência
        status: JobStatus.ACTIVE, // Apenas vagas ativas
        OR: [
          // Vagas com tags semelhantes
          {
            tags: referenceJob.tags && referenceJob.tags.length > 0 
              ? { hasSome: referenceJob.tags } 
              : undefined
          },
          // Vagas com skills semelhantes
          {
            skills: referenceJob.skills && referenceJob.skills.length > 0 
              ? { hasSome: referenceJob.skills } 
              : undefined
          },
          // Vagas na mesma localização
          {
            location: referenceJob.location 
              ? { equals: referenceJob.location } 
              : undefined
          },
          // Vagas no mesmo país
          {
            country: referenceJob.country 
              ? { equals: referenceJob.country } 
              : undefined
          },
          // Vagas com mesmo tipo de trabalho
          {
            workplaceType: referenceJob.workplaceType 
              ? { equals: referenceJob.workplaceType } 
              : undefined
          },
          // Vagas com mesmo tipo de contrato
          {
            jobType: referenceJob.jobType 
              ? { equals: referenceJob.jobType } 
              : undefined
          },
          // Vagas com mesmo nível de experiência
          {
            experienceLevel: referenceJob.experienceLevel 
              ? { equals: referenceJob.experienceLevel } 
              : undefined
          }
        ]
      },
      select: {
        id: true,
        title: true,
        companyId: true,
        company: {
          select: {
            name: true,
            logoUrl: true
          }
        },
        location: true,
        country: true,
        minSalary: true,
        maxSalary: true,
        currency: true,
        jobType: true,
        experienceLevel: true,
        workplaceType: true,
        tags: true,
        skills: true,
        createdAt: true,
        publishedAt: true,
        viewCount: true
      },
      orderBy: [
        // Priorizar vagas da mesma empresa
        {
          companyId: referenceJob.companyId 
            ? (referenceJob.companyId === referenceJob.companyId ? 'asc' : 'desc') 
            : 'asc'
        },
        { viewCount: 'desc' },  // Vagas populares
        { createdAt: 'desc' }   // Vagas mais recentes
      ],
      take: limit
    });

    // Calcular e retornar pontuação de relevância para cada vaga
    const jobsWithRelevanceScore = similarJobs.map(job => {
      let relevanceScore = 0;
      
      // Pontuação por tags semelhantes
      if (referenceJob.tags && referenceJob.tags.length > 0 && job.tags) {
        const matchingTags = referenceJob.tags.filter(tag => job.tags.includes(tag));
        relevanceScore += (matchingTags.length / referenceJob.tags.length) * 0.4; // 40% do peso
      }
      
      // Pontuação por skills semelhantes
      if (referenceJob.skills && referenceJob.skills.length > 0 && job.skills) {
        const matchingSkills = referenceJob.skills.filter(skill => job.skills.includes(skill));
        relevanceScore += (matchingSkills.length / referenceJob.skills.length) * 0.3; // 30% do peso
      }
      
      // Pontuação por localização
      if (job.location === referenceJob.location) {
        relevanceScore += 0.15; // 15% do peso
      }
      
      // Pontuação por país
      if (job.country === referenceJob.country) {
        relevanceScore += 0.1; // 10% do peso
      }
      
      // Pontuação por tipo de trabalho
      if (job.workplaceType === referenceJob.workplaceType) {
        relevanceScore += 0.05; // 5% do peso
      }
      
      return {
        ...job,
        relevanceScore: Math.min(1, relevanceScore) // Limitar a 1 (100%)
      };
    });

    return res.status(200).json({
      referenceJob: {
        id: referenceJob.id,
        title: referenceJob.title
      },
      similarJobs: jobsWithRelevanceScore.sort((a, b) => b.relevanceScore - a.relevanceScore)
    });
  } catch (error) {
    console.error('Erro ao buscar vagas similares:', error);
    return res.status(500).json({ error: 'Erro ao processar a solicitação' });
  }
} 