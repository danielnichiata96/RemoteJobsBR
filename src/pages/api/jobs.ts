import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { 
        search = '', 
        jobTypes = [], 
        experienceLevels = [],
        industries = [],
        locations = [],
        page = '1', 
        limit = '10' 
      } = req.query;
      
      // Convert params
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;
      
      // Build filter conditions
      const searchFilter = search
        ? {
            OR: [
              { title: { contains: search as string, mode: 'insensitive' } },
              { description: { contains: search as string, mode: 'insensitive' } },
              { skills: { hasSome: search.split(' ') } },
              { company: { name: { contains: search as string, mode: 'insensitive' } } }
            ]
          }
        : {};
      
      // Job type filter
      const jobTypeFilter = (jobTypes as string[])?.length > 0
        ? { jobType: { in: (jobTypes as string[]) } }
        : {};
        
      // Experience level filter
      const experienceLevelFilter = (experienceLevels as string[])?.length > 0
        ? { experienceLevel: { in: (experienceLevels as string[]) } }
        : {};

      // Industry filter (using tags as proxy)
      const industryFilter = (industries as string[])?.length > 0
        ? { tags: { hasSome: (industries as string[]) } }
        : {};
      
      // Location filter (using custom logic)
      const locationFilter = (locations as string[])?.length > 0
        ? buildLocationFilter(locations as string[])
        : {};
        
      // Only active jobs
      const statusFilter = { status: 'ACTIVE' };
        
      // Combine all filters
      const where = {
        ...searchFilter,
        ...jobTypeFilter,
        ...experienceLevelFilter,
        ...industryFilter,
        ...locationFilter,
        ...statusFilter,
      };
      
      // Verificar se temos exatamente o ID da vaga que queremos debugar
      const debugJobId = req.query.debug_id as string;
      if (debugJobId) {
        where.id = debugJobId;
      }
      
      // Garantir que incluímos o relacionamento com a empresa corretamente
      const includeCompany = {
        company: {
          select: {
            id: true,
            name: true,
            logo: true,
            industry: true,
            isVerified: true
          }
        }
      };

      // IMPLEMENTAÇÃO DO SISTEMA DE PRIORIDADE PARA VAGAS DIRETAS
      
      let jobs = [];
      let totalJobs = 0;
      
      // Apenas na primeira página damos destaque para vagas diretas
      if (pageNum === 1) {
        // 1. Buscar até 10 vagas diretas, que terão prioridade
        const directJobs = await prisma.job.findMany({
          where: {
            ...where,
            source: 'direct',
            // Garantir que não pega vagas com IDs do Greenhouse
            id: {
              not: { startsWith: 'greenhouse_' }
            }
          },
          include: includeCompany,
          orderBy: [
            { publishedAt: 'desc' },
            { createdAt: 'desc' }
          ],
          take: 10
        });
        
        // 2. Calcular quantas vagas ainda precisamos para completar o limite da página
        const remainingSlots = limitNum - directJobs.length;
        
        // 3. Buscar vagas de outras fontes para completar a página
        const otherSourceJobs = remainingSlots > 0 ? 
          await prisma.job.findMany({
            where: {
              ...where,
              OR: [
                { source: { not: 'direct' } },
                { 
                  // Incluir também vagas que são erroneamente marcadas como 'direct' mas têm ID do Greenhouse
                  source: 'direct',
                  id: { startsWith: 'greenhouse_' }
                }
              ]
            },
            include: includeCompany,
            orderBy: [
              { publishedAt: 'desc' },
              { createdAt: 'desc' }
            ],
            take: remainingSlots
          }) : [];
        
        // 4. Combinar os resultados, com vagas diretas primeiro
        jobs = [...directJobs, ...otherSourceJobs];
      } else {
        // Para páginas subsequentes, precisamos ajustar a paginação
        // Contar quantas vagas diretas existem no total
        const totalDirectJobs = await prisma.job.count({
          where: {
            ...where,
            source: 'direct'
          }
        });
        
        // Contar vagas de outras fontes
        const totalOtherJobs = await prisma.job.count({
          where: {
            ...where,
            source: { not: 'direct' }
          }
        });
        
        // Se temos menos de 10 vagas diretas, então a primeira página tem todas elas
        // mais algumas vagas de outras fontes
        const directJobsOnFirstPage = Math.min(totalDirectJobs, 10);
        
        // Vagas de outras fontes na primeira página
        const otherJobsOnFirstPage = Math.min(limitNum - directJobsOnFirstPage, totalOtherJobs);
        
        // Total de vagas na primeira página
        const totalOnFirstPage = directJobsOnFirstPage + otherJobsOnFirstPage;
        
        // Ajustar o cálculo de skip
        // A página 2 começa após todas as vagas da página 1
        const adjustedSkip = (pageNum === 2) ? totalOnFirstPage : 
                             (pageNum > 2) ? totalOnFirstPage + (pageNum - 2) * limitNum : 
                             skip;
        
        // Buscar vagas normalmente com skip ajustado
        jobs = await prisma.job.findMany({
          where,
          include: includeCompany,
          orderBy: [
            { publishedAt: 'desc' },
            { createdAt: 'desc' }
          ],
          skip: adjustedSkip,
          take: limitNum
        });
      }
      
      // Calcular o total geral de vagas para paginação
      totalJobs = await prisma.job.count({ where });
      
      // Format the jobs for the frontend
      const formattedJobs = jobs.map(job => ({
        id: job.id,
        title: job.title,
        company: job.company.name,
        companyLogo: job.company.logo || null,
        companyVerified: job.company.isVerified,
        location: job.location,
        description: truncateDescription(job.description),
        jobType: formatJobType(job.jobType),
        experienceLevel: formatExperienceLevel(job.experienceLevel),
        tags: job.skills,
        salary: job.showSalary && job.minSalary && job.maxSalary 
          ? formatSalary(job.minSalary, job.maxSalary, job.currency, job.salaryCycle) 
          : null,
        createdAt: job.createdAt,
        publishedAt: job.publishedAt,
        applicationUrl: job.applicationUrl,
        industry: job.company.industry || 'tech',
        regionType: determineRegionType(job.location, job.country),
        source: job.source,
        sourceUrl: job.sourceUrl,
        sourceLogo: job.sourceLogo
      }));
      
      // Return response with pagination
      return res.status(200).json({
        jobs: formattedJobs,
        pagination: {
          total: totalJobs,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(totalJobs / limitNum)
        }
      });
    } catch (error) {
      console.error('Error fetching jobs:', error);
      return res.status(500).json({ error: 'Failed to fetch jobs' });
    }
  } else {
    // Only allow GET method
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// Helper functions
function truncateDescription(description: string): string {
  const maxLength = 200;
  if (description.length <= maxLength) return description;
  return description.substring(0, maxLength) + '...';
}

function formatJobType(jobType: string): string {
  const mapping: Record<string, string> = {
    'FULL_TIME': 'full-time',
    'PART_TIME': 'part-time',
    'CONTRACT': 'contract',
    'INTERNSHIP': 'internship',
    'FREELANCE': 'freelance'
  };
  return mapping[jobType] || jobType.toLowerCase();
}

function formatExperienceLevel(level: string): string {
  const mapping: Record<string, string> = {
    'ENTRY': 'entry-level',
    'MID': 'mid-level',
    'SENIOR': 'senior-level',
    'LEAD': 'lead-level'
  };
  return mapping[level] || level.toLowerCase();
}

function formatSalary(min: number, max: number, currency: string | null, cycle: string | null): string {
  const currencySymbol = getCurrencySymbol(currency || 'USD');
  const formattedMin = Math.round(min).toLocaleString();
  const formattedMax = Math.round(max).toLocaleString();
  const period = cycle ? `/${cycle.toLowerCase()}` : '';
  
  return `${currencySymbol} ${formattedMin} - ${formattedMax}${period}`;
}

function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'BRL': 'R$'
  };
  return symbols[currency] || currency;
}

function determineRegionType(location: string, country: string): string {
  const locationLower = location.toLowerCase();
  const countryLower = country.toLowerCase();
  
  if (locationLower.includes('brazil') || countryLower.includes('brazil') || 
      locationLower.includes('brasil') || countryLower.includes('brasil')) {
    return 'brazil';
  }
  
  if (locationLower.includes('latin america') || locationLower.includes('latam') ||
      countryLower.includes('latin america') || countryLower.includes('latam') ||
      ['argentina', 'mexico', 'colombia', 'chile', 'peru'].some(
        country => locationLower.includes(country) || countryLower.includes(country)
      )) {
    return 'latam';
  }
  
  return 'worldwide';
}

function buildLocationFilter(locations: string[]): Record<string, any> {
  if (!locations || locations.length === 0) return {};
  
  const conditions = [];
  
  if (locations.includes('brazil')) {
    conditions.push(
      { location: { contains: 'Brazil', mode: 'insensitive' } },
      { location: { contains: 'Brasil', mode: 'insensitive' } },
      { country: { contains: 'Brazil', mode: 'insensitive' } },
      { country: { contains: 'Brasil', mode: 'insensitive' } }
    );
  }
  
  if (locations.includes('latam')) {
    conditions.push(
      { location: { contains: 'Latin America', mode: 'insensitive' } },
      { location: { contains: 'LATAM', mode: 'insensitive' } },
      { country: { contains: 'Latin America', mode: 'insensitive' } },
      { country: { contains: 'LATAM', mode: 'insensitive' } },
      { location: { contains: 'Argentina', mode: 'insensitive' } },
      { location: { contains: 'Mexico', mode: 'insensitive' } },
      { location: { contains: 'Colombia', mode: 'insensitive' } },
      { location: { contains: 'Chile', mode: 'insensitive' } },
      { location: { contains: 'Peru', mode: 'insensitive' } }
    );
  }
  
  if (locations.includes('worldwide')) {
    conditions.push(
      { location: { contains: 'Remote', mode: 'insensitive' } },
      { location: { contains: 'Worldwide', mode: 'insensitive' } },
      { location: { contains: 'Global', mode: 'insensitive' } },
      { country: { contains: 'Worldwide', mode: 'insensitive' } },
      { country: { contains: 'Global', mode: 'insensitive' } }
    );
  }
  
  return conditions.length > 0 ? { OR: conditions } : {};
} 