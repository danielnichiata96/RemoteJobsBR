import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { JobStatus, JobType, ExperienceLevel, Prisma } from '@prisma/client';
import NodeCache from 'node-cache';

// --- Cache Setup ---
// stdTTL: default time-to-live in seconds for cache items (1 hour)
// checkperiod: interval in seconds to check for expired items (10 minutes)
const CACHE_TTL = 3600; // 1 hour in seconds
const searchCache = new NodeCache({ 
  stdTTL: CACHE_TTL, 
  checkperiod: 600 // 10 minutes
});

// Helper function to generate a stable cache key from query parameters
const generateCacheKey = (query: NodeJS.Dict<string | string[]>): string => {
    // Sort keys to ensure consistent order
    const sortedKeys = Object.keys(query).sort();
    // Build a stable string representation
    const keyParts = sortedKeys.map(key => `${key}=${JSON.stringify(query[key])}`);
    // Prefix for easy identification/clearing
    return `search:${keyParts.join('&')}`;
};

// Define a interface para os parâmetros de pesquisa
interface SearchParams {
  query?: string;
  page?: number;
  limit?: number;
  jobType?: JobType[];
  experienceLevel?: ExperienceLevel[];
  location?: string;
  country?: string;
  workplaceType?: string;
  minSalary?: number;
  tags?: string[];
  visas?: string[];
  languages?: string[];
  technologies?: string[];
  remote?: boolean;
  sortBy?: 'newest' | 'salary' | 'relevance';
}

// Define type for aggregation results
interface FilterAggregations {
  jobTypes: { [key in JobType]?: number };
  experienceLevels: { [key in ExperienceLevel]?: number };
  technologies: { [key: string]: number }; // Keyed by technology name
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const cacheKey = generateCacheKey(req.query);
  console.log(`[Cache] Generated Key: ${cacheKey}`); // Log for debugging

  try {
    // --- Check Cache --- 
    const cachedData = searchCache.get(cacheKey);
    if (cachedData) {
      console.log(`[Cache] HIT for key: ${cacheKey}`);
      // Important: Set cache header for client/CDN caching control
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=240'); // Example: Cache for 1 min, revalidate in background for next 4 mins
      return res.status(200).json(cachedData);
    }
    console.log(`[Cache] MISS for key: ${cacheKey}`);
    // -------------------

    // Extrair e transformar parâmetros de pesquisa
    const searchParams: SearchParams = {
      query: req.query.q as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      jobType: req.query.jobType ? (req.query.jobType as string).split(',') as JobType[] : undefined,
      experienceLevel: req.query.experienceLevel ? (req.query.experienceLevel as string).split(',') as ExperienceLevel[] : undefined,
      location: req.query.location as string,
      country: req.query.country as string,
      workplaceType: req.query.workplaceType as string,
      minSalary: req.query.minSalary ? parseInt(req.query.minSalary as string) : undefined,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      visas: req.query.visas ? (req.query.visas as string).split(',') : undefined,
      languages: req.query.languages ? (req.query.languages as string).split(',') : undefined,
      technologies: req.query.technologies ? (req.query.technologies as string).split(',').filter(Boolean) : undefined,
      remote: req.query.remote === 'true',
      sortBy: (req.query.sortBy as 'newest' | 'salary' | 'relevance') || 'newest'
    };

    // Preparar parâmetros para o Prisma
    const { query, page, limit, ...filters } = searchParams;
    const skip = (page - 1) * limit;
    
    // Construir o objeto de filtros
    const whereClause: any = {
      status: JobStatus.ACTIVE, // Apenas vagas ativas
    };
    
    // Filtro de texto (busca em título, descrição, requisitos)
    if (query) {
      whereClause.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { requirements: { contains: query, mode: 'insensitive' } },
        { tags: { hasSome: [query] } }
      ];
    }
    
    // Aplicar filtros adicionais
    if (filters.jobType) {
      whereClause.jobType = { in: filters.jobType };
    }
    
    if (filters.experienceLevel) {
      whereClause.experienceLevel = { in: filters.experienceLevel };
    }
    
    if (filters.location) {
      whereClause.location = { contains: filters.location, mode: 'insensitive' };
    }
    
    if (filters.country) {
      whereClause.country = { equals: filters.country };
    }
    
    if (filters.workplaceType) {
      whereClause.workplaceType = { equals: filters.workplaceType };
    }
    
    if (filters.minSalary) {
      whereClause.minSalary = { gte: filters.minSalary };
    }
    
    if (filters.tags && filters.tags.length > 0) {
      whereClause.tags = { hasSome: filters.tags };
    }
    
    if (filters.technologies && filters.technologies.length > 0) {
      whereClause.technologies = {
        some: {
          name: {
            in: filters.technologies,
            mode: 'insensitive'
          }
        }
      };
    }
    
    if (filters.visas && filters.visas.length > 0) {
      whereClause.visas = { hasSome: filters.visas };
    }
    
    if (filters.languages && filters.languages.length > 0) {
      whereClause.languages = { hasSome: filters.languages };
    }
    
    if (filters.remote) {
      whereClause.workplaceType = { equals: 'REMOTE' };
    }

    // Determinar ordenação
    let orderBy: any = {};
    switch (filters.sortBy) {
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'salary':
        orderBy = { maxSalary: 'desc' };
        break;
      case 'relevance':
      default:
        orderBy = [
          { viewCount: 'desc' },
          { createdAt: 'desc' }
        ];
        break;
    }

    // Define includes needed for job list (separate from aggregations)
    const jobSelectClause = {
      id: true,
      title: true,
      companyId: true,
      company: {
        select: {
          name: true,
          logo: true
        }
      },
      location: true,
      country: true,
      minSalary: true,
      maxSalary: true,
      currency: true,
      salaryCycle: true,
      jobType: true,
      experienceLevel: true,
      workplaceType: true,
      tags: true,
      visas: true,
      languages: true,
      technologies: {
        select: {
          id: true,
          name: true
        }
      },
      createdAt: true,
      publishedAt: true,
      viewCount: true,
      _count: {
        select: {
          savedBy: true
        }
      }
    };

    // Perform all queries concurrently
    const [jobs, totalCount, jobTypeCounts, experienceLevelCounts, technologyCountsResult] = await Promise.all([
      // 1. Fetch jobs for the current page
      prisma.job.findMany({
        where: whereClause,
        orderBy,
        skip,
        take: limit,
        select: jobSelectClause
      }),
      // 2. Get total count matching filters (for pagination)
      prisma.job.count({ where: whereClause }),
      // 3. Get counts for job types
      prisma.job.groupBy({
        by: ['jobType'],
        where: whereClause,
        _count: {
          jobType: true,
        },
        having: {
          jobType: { not: null } // Exclude nulls if jobType is optional
        }
      }),
      // 4. Get counts for experience levels
      prisma.job.groupBy({
        by: ['experienceLevel'],
        where: whereClause,
        _count: {
          experienceLevel: true,
        },
        having: {
          experienceLevel: { not: null } // Exclude nulls
        }
      }),
      // 5. Get counts for technologies (more complex due to many-to-many)
      prisma.technology.findMany({
        where: {
          jobs: { some: whereClause } // Find technologies linked to jobs matching the main filters
        },
        select: {
          name: true,
          _count: {
            select: {
              jobs: { where: whereClause } // Count jobs matching main filters for THIS technology
            }
          }
        }
      })
    ]);

    // Process aggregations into a structured object
    const aggregations: FilterAggregations = {
      jobTypes: jobTypeCounts.reduce((acc, item) => {
        if (item.jobType) {
           acc[item.jobType] = item._count.jobType;
        }
        return acc;
      }, {} as FilterAggregations['jobTypes']),
      experienceLevels: experienceLevelCounts.reduce((acc, item) => {
        if (item.experienceLevel) {
          acc[item.experienceLevel] = item._count.experienceLevel;
        }
        return acc;
      }, {} as FilterAggregations['experienceLevels']),
       technologies: technologyCountsResult.reduce((acc, item) => {
         if (item.name && item._count.jobs > 0) { // Only include techs with matching jobs
            acc[item.name] = item._count.jobs;
         }
         return acc;
       }, {} as FilterAggregations['technologies'])
    };

    // Construir resposta paginada
    const responseData = {
      jobs,
      pagination: {
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        pageSize: limit,
        hasNextPage: skip + limit < totalCount,
        hasPrevPage: page > 1,
      },
      aggregations
    };

    // --- Store in Cache --- 
    // Cache successful responses with a TTL of 1 hour (3600 seconds)
    searchCache.set(cacheKey, responseData, CACHE_TTL);
    // ----------------------

    // Set cache headers for client/CDN
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=240');
    
    return res.status(200).json(responseData);
  } catch (error: any) {
    // Ensure error is logged appropriately
    if (error && typeof error.code === 'string' && error.code.startsWith('P')) {
      // Handle known Prisma errors (e.g., P2021 Table does not exist, P2002 Unique constraint)
      console.error('Prisma Error Code:', error.code, error.message);
      // Consider returning a more specific error status/message depending on the code
      res.status(500).json({ error: 'Erro de banco de dados ao buscar vagas.', details: error.code });
    } else {
      // Handle unexpected errors
      console.error('Erro inesperado na busca de vagas:', error);
      res.status(500).json({ error: 'Erro ao buscar vagas' });
    }
  }
} 
