import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { JobStatus } from '@prisma/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Apenas GET é permitido
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'ID de vaga não fornecido ou inválido' });
    }

    const formattedId = id.startsWith('greenhouse_') ? id : `greenhouse_${id}`;
    
    // Buscar a vaga original para obter tags e skills
    const originalJob = await prisma.job.findUnique({
      where: { 
        id: formattedId,
        status: JobStatus.ACTIVE
      },
      select: {
        id: true,
        tags: true,
        skills: true,
        jobType: true,
        experienceLevel: true
      }
    });

    if (!originalJob) {
      return res.status(404).json({ error: 'Vaga original não encontrada' });
    }

    // Buscar vagas similares com base nas tags, skills e outros critérios
    const similarJobs = await prisma.job.findMany({
      where: {
        id: { not: originalJob.id }, // Excluir a vaga original
        status: JobStatus.ACTIVE,
        OR: [
          // Vagas com tags similares
          originalJob.tags && originalJob.tags.length > 0
            ? { tags: { hasSome: originalJob.tags } }
            : {},
          // Vagas com skills similares
          originalJob.skills && originalJob.skills.length > 0
            ? { skills: { hasSome: originalJob.skills } }
            : {},
          // Vagas com o mesmo tipo de trabalho
          { jobType: originalJob.jobType },
          // Vagas com o mesmo nível de experiência
          { experienceLevel: originalJob.experienceLevel }
        ]
      },
      include: {
        company: {
          select: {
            name: true,
            logo: true,
            website: true
          }
        }
      },
      take: 6 // Limitar a 6 vagas similares
    });

    // Mapear vagas para o formato correto
    const formattedSimilarJobs = similarJobs.map(job => {
      // Determinar o logo da empresa
      let companyLogo = job.company.logo;
      
      if (!companyLogo && job.company.website) {
        const domain = extractDomain(job.company.website);
        if (domain) {
          // Usar API token se disponível
          const apiToken = process.env.LOGO_DEV_TOKEN || '';
          const tokenParam = apiToken ? `?token=${apiToken}` : '';
          companyLogo = `https://img.logo.dev/${domain}${tokenParam}`;
        }
      }
      
      return {
        id: job.id,
        title: job.title,
        company: job.company.name,
        companyLogo: companyLogo,
        location: job.location,
        description: job.shortDescription || "",
        jobType: job.jobType,
        experienceLevel: job.experienceLevel,
        createdAt: job.createdAt,
        publishedAt: job.publishedAt
      };
    });

    return res.status(200).json(formattedSimilarJobs);
  } catch (error) {
    console.error('Erro ao buscar vagas similares:', error);
    return res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

// Função para extrair domínio de uma URL
function extractDomain(url: string): string | null {
  try {
    // Adicionar https:// se não existir
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    const domain = new URL(url).hostname;
    return domain;
  } catch (error) {
    console.error('Erro ao extrair domínio:', error);
    return null;
  }
} 