import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import { JobType, ExperienceLevel, Currency, JobStatus } from '@prisma/client'; // Import enums

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { 
        page = '1', 
        limit = '20',
        search = '',
        jobTypes = [],
        experienceLevels = [],
        industries = [],
        locations = []
      } = req.query;
      
      // Convert params
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;
      
      // Build search filter
      const searchFilter = search 
        ? {
            OR: [
              { title: { contains: search as string, mode: 'insensitive' } },
              { description: { contains: search as string, mode: 'insensitive' } },
              { skills: { has: search as string } },
              { company: { name: { contains: search as string, mode: 'insensitive' } } }
            ]
          }
        : {};

      // Build job type filter
      const jobTypeFilter = jobTypes && Array.isArray(jobTypes) && jobTypes.length > 0
        ? {
            jobType: {
              in: jobTypes.map(type => {
                // Map frontend value to enum value if needed
                switch(type) {
                  case 'full-time': return JobType.FULL_TIME;
                  case 'part-time': return JobType.PART_TIME;
                  case 'contract': return JobType.CONTRACT;
                  case 'internship': return JobType.INTERNSHIP;
                  case 'freelance': return JobType.FREELANCE;
                  default: return type as JobType;
                }
              })
            }
          }
        : {};

      // Build experience level filter
      const experienceLevelFilter = experienceLevels && Array.isArray(experienceLevels) && experienceLevels.length > 0
        ? {
            experienceLevel: {
              in: experienceLevels.map(level => {
                // Map frontend value to enum value if needed
                switch(level) {
                  case 'entry-level': return ExperienceLevel.ENTRY;
                  case 'mid-level': return ExperienceLevel.MID;
                  case 'senior-level': return ExperienceLevel.SENIOR;
                  case 'lead': return ExperienceLevel.LEAD;
                  default: return level as ExperienceLevel;
                }
              })
            }
          }
        : {};

      // Build industry filter
      const industryFilter = industries && Array.isArray(industries) && industries.length > 0
        ? {
            company: {
              industry: {
                in: industries as string[]
              }
            }
          }
        : {};

      // Build location filter using helper
      const locationFilter = locations && Array.isArray(locations) && locations.length > 0
        ? buildLocationFilter(locations as string[])
        : {};
      
      // Combine all filters
      const where = {
        status: JobStatus.ACTIVE,
        ...searchFilter,
        ...jobTypeFilter,
        ...experienceLevelFilter,
        ...industryFilter,
        ...locationFilter,
      };
      
      // Fetching with combined where clause
      const totalJobs = await prisma.job.count({ where });

      // Debug: Verificar a distribuição de empresas
      console.log('Verificando distribuição de empresas entre vagas ativas:');
      const companyDistribution = await prisma.job.groupBy({
        by: ['companyId'],
        where: { status: JobStatus.ACTIVE },
        _count: { _all: true }
      });
      
      // Buscar nomes das empresas para o log
      const companyIds = companyDistribution.map(item => item.companyId);
      const companies = await prisma.user.findMany({
        where: { id: { in: companyIds }, role: 'COMPANY' },
        select: { id: true, name: true }
      });
      
      // Criar mapa de ID -> nome
      const companyMap = new Map(companies.map(c => [c.id, c.name]));
      
      // Logar distribuição
      companyDistribution.forEach(item => {
        console.log(`Empresa: ${companyMap.get(item.companyId) || item.companyId}, Vagas ativas: ${item._count._all}`);
      });

      const jobs = await prisma.job.findMany({
        where,
        orderBy: [
          // Ordenação por data (mais recente primeiro)
          { publishedAt: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: skip,
        take: limitNum,
        select: {
          id: true,
          source: true,
          sourceId: true,
          companyId: true,
          title: true,
          description: true,
          requirements: true,
          responsibilities: true,
          benefits: true,
          jobType: true,
          experienceLevel: true,
          skills: true,
          location: true,
          country: true,
          workplaceType: true,
          minSalary: true,
          maxSalary: true,
          currency: true,
          salaryCycle: true,
          showSalary: true,
          status: true,
          visas: true,
          languages: true,
          applicationUrl: true,
          applicationEmail: true,
          createdAt: true,
          updatedAt: true,
          publishedAt: true,
          expiresAt: true,
          viewCount: true,
          applicantCount: true,
          applications: {
            select: {
              id: true
            }
          },
          company: {
            select: {
              id: true,
              name: true,
              logo: true,
              industry: true,
              isVerified: true
            }
          },
          savedBy: {
            select: {
              id: true
            }
          }
        }
      });
      
      // Format the jobs for the frontend
      const formattedJobs = jobs.map(job => {
        // Clean up the location data - override US-specific locations with general "Remote" indication
        let cleanedLocation = job.location;
        if (cleanedLocation && (
            cleanedLocation.includes("US-") || 
            cleanedLocation.includes("United States") ||
            cleanedLocation.includes("Seattle") ||
            cleanedLocation.includes("San Francisco") ||
            cleanedLocation.includes("New York") ||
            cleanedLocation.includes("Chicago")
        )) {
          cleanedLocation = job.country === 'LATAM' ? 'Remote - Latin America' : 'Remote - Worldwide';
        }
        
        // Add debug info for company
        console.log(`Processing job ${job.id} for company: ${JSON.stringify(job.company)}`);
        
        return {
          id: job.id,
          title: job.title,
          company: job.company.name || 'Empresa',
          companyLogo: job.company.logo || null,
          companyVerified: job.company.isVerified,
          location: cleanedLocation,
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
          regionType: determineRegionType(cleanedLocation, job.country),
          source: job.source,
          workplaceType: job.workplaceType
        };
      });
      
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
      if (error instanceof Error) {
           console.error(error.message);
           if ('code' in error) { 
               console.error(`Prisma Error Code: ${error.code}`);
           }
       }
      return res.status(500).json({ error: 'Failed to fetch jobs' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// Helper functions
function truncateDescription(description: string | null): string {
    if (!description) return '';
    const maxLength = 200;
    if (description.length <= maxLength) return description;
    return description.substring(0, maxLength) + '...';
}

function formatJobType(jobType: JobType | null): string {
    if (!jobType) return '-';
    const mapping: Record<JobType, string> = {
        [JobType.FULL_TIME]: 'Tempo Integral',
        [JobType.PART_TIME]: 'Meio Período',
        [JobType.CONTRACT]: 'Contrato',
        [JobType.INTERNSHIP]: 'Estágio',
        [JobType.FREELANCE]: 'Freelance'
    };
    return mapping[jobType] || jobType;
}

function formatExperienceLevel(level: ExperienceLevel | null): string {
    if (!level) return '-';
    const mapping: Record<ExperienceLevel, string> = {
        [ExperienceLevel.ENTRY]: 'Júnior',
        [ExperienceLevel.MID]: 'Pleno',
        [ExperienceLevel.SENIOR]: 'Sênior',
        [ExperienceLevel.LEAD]: 'Líder'
    };
    return mapping[level] || level;
}

function formatSalary(min: number, max: number, currency: Currency | null, cycle: string | null): string {
    const currencySymbol = getCurrencySymbol(currency || Currency.USD); // Default to USD
    const formattedMin = Math.round(min).toLocaleString('pt-BR'); // Use locale for formatting
    const formattedMax = Math.round(max).toLocaleString('pt-BR');
    const period = cycle ? `/${cycle.toLowerCase()}` : '';
    return `${currencySymbol} ${formattedMin} - ${formattedMax}${period}`;
}

function getCurrencySymbol(currency: Currency): string {
    const symbols: Record<Currency, string> = {
        [Currency.USD]: '$',
        [Currency.EUR]: '€',
        [Currency.BRL]: 'R$'
    };
    return symbols[currency] || currency;
}

function determineRegionType(location: string, country: string): string {
  const locationLower = location?.toLowerCase() || '';
  const countryLower = country?.toLowerCase() || '';
  
  if (locationLower.includes('brazil') || countryLower.includes('brazil') || 
      locationLower.includes('brasil') || countryLower.includes('brasil')) {
    return 'brazil';
  }
  
  if (locationLower.includes('latin america') || locationLower.includes('latam') ||
      countryLower.includes('latin america') || countryLower.includes('latam') ||
      ['argentina', 'mexico', 'colombia', 'chile', 'peru'].some(
        c => locationLower.includes(c) || countryLower.includes(c)
      )) {
    return 'latam';
  }
  
  return 'worldwide';
}

function buildLocationFilter(locations: string[]): Record<string, any> {
  if (!locations || locations.length === 0) return {};
  
  const conditions: any[] = []; // Explicitly type as any[] or a more specific type
  
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
  
  // If only worldwide is selected, we might want to exclude explicitly LATAM/Brazil jobs?
  // Example: if (locations.length === 1 && locations[0] === 'worldwide') { ... add NOT condition ... }
  // For now, keep it simple: OR condition for all selected.
  
  return conditions.length > 0 ? { OR: conditions } : {};
} 