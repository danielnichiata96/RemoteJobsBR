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
    // Obter ID da vaga da URL
    const jobId = req.query.id as string;
    
    console.log('Buscando vaga com ID:', jobId);
    
    if (!jobId) {
      return res.status(400).json({ error: 'ID da vaga não fornecido' });
    }

    // Verificar se o jobId é válido antes de consultar
    if (typeof jobId !== 'string' || jobId.trim() === '') {
      return res.status(400).json({ error: 'ID da vaga inválido' });
    }

    // Buscar vaga no banco de dados
    let job;
    try {
      job = await prisma.job.findUnique({
        where: { 
          id: jobId.startsWith('greenhouse_') ? jobId : `greenhouse_${jobId}`,
          status: JobStatus.ACTIVE // Apenas vagas ativas
        },
        include: {
          company: {
            select: {
              name: true,
              image: true,
              linkedinUrl: true,
              website: true,
            }
          }
        }
      });
      console.log('Job encontrado no banco:', job ? 'Sim' : 'Não');
    } catch (queryError) {
      console.error('Erro na consulta Prisma:', queryError);
      return res.status(500).json({ 
        error: 'Erro ao consultar o banco de dados',
        details: queryError instanceof Error ? queryError.message : 'Erro desconhecido'
      });
    }
    
    // Se não encontrar, retornar 404
    if (!job) {
      return res.status(404).json({ error: 'Vaga não encontrada' });
    }
    
    // Registrar visualização da vaga (incrementar contador)
    try {
      await prisma.job.update({
        where: { id: job.id },
        data: { viewCount: { increment: 1 } }
      });
    } catch (updateError) {
      // Apenas logar o erro, mas continuar com a resposta
      console.error('Erro ao incrementar visualizações:', updateError);
    }

    // Obter o logo da empresa
    // 1. Usar a imagem do banco se existir
    // 2. Tentar usar logo.dev com o site da empresa se disponível
    // 3. Usar fallback para primeira letra da empresa
    let companyLogo = job.company.image;
    
    if (!companyLogo && job.company.website) {
      const domain = extractDomain(job.company.website);
      if (domain) {
        // Usar API token se disponível
        const apiToken = process.env.LOGO_DEV_TOKEN || '';
        const tokenParam = apiToken ? `?token=${apiToken}` : '';
        companyLogo = `https://img.logo.dev/${domain}${tokenParam}`;
      }
    }

    // Formatar a resposta para o cliente
    const formattedJob = {
      id: job.id,
      title: job.title,
      company: job.company.name,
      companyLogo: companyLogo,
      companyWebsite: job.company.website,
      location: job.location,
      description: job.description,
      jobType: job.jobType,
      experienceLevel: job.experienceLevel,
      tags: job.tags || [],
      skills: job.skills || [],
      salary: job.showSalary 
        ? formatSalary(job.minSalary, job.maxSalary, job.currency, job.salaryCycle) 
        : null,
      createdAt: job.createdAt,
      publishedAt: job.publishedAt,
      applicationUrl: job.applicationUrl || job.company.linkedinUrl,
      responsibilities: job.responsibilities,
      requirements: job.requirements,
      benefits: job.benefits,
      workplaceType: job.workplaceType
    };

    return res.status(200).json(formattedJob);
  } catch (error) {
    console.error('Erro ao buscar detalhes da vaga:', error);
    return res.status(500).json({ 
      error: 'Erro ao processar a solicitação',
      details: error instanceof Error ? error.message : 'Erro desconhecido' 
    });
  }
}

// Função auxiliar para formatar salário
function formatSalary(min?: number | null, max?: number | null, currency = 'BRL', cycle?: string | null): string {
  if (!min && !max) return 'Não informado';
  
  const formatValue = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  let result = '';
  if (min && max) {
    result = `${formatValue(min)} - ${formatValue(max)}`;
  } else if (min) {
    result = `A partir de ${formatValue(min)}`;
  } else if (max) {
    result = `Até ${formatValue(max)}`;
  }
  
  if (cycle) {
    const cycleMap: Record<string, string> = {
      'hourly': '/hora',
      'monthly': '/mês',
      'yearly': '/ano'
    };
    result += ` ${cycleMap[cycle] || ''}`;
  }
  
  return result;
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