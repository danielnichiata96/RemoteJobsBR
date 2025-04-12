import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { JobStatus, JobType, ExperienceLevel, HiringRegion, Prisma } from '@prisma/client';
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
  company?: string;
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
  hiringRegion?: HiringRegion;
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
      company: req.query.company as string,
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
      sortBy: (req.query.sortBy as 'newest' | 'salary' | 'relevance') || 'newest',
      hiringRegion: req.query.hiringRegion && Object.values(HiringRegion).includes(req.query.hiringRegion as HiringRegion)
                    ? req.query.hiringRegion as HiringRegion
                    : undefined
    };

    // Preparar parâmetros para o Prisma
    const { query, company, page, limit, ...filters } = searchParams;
    const skip = (page - 1) * limit;
    
    // Default to ACTIVE status and include LATAM, WORLDWIDE, or unspecified regions
    const whereClause: Prisma.JobWhereInput = {
      status: JobStatus.ACTIVE,
      OR: [
        { hiringRegion: HiringRegion.LATAM },
        { hiringRegion: HiringRegion.WORLDWIDE }, // Include WORLDWIDE
        { hiringRegion: null }                    // Include jobs with unspecified region
      ]
    };
    const andConditions: Prisma.JobWhereInput[] = [];
    
    // Filtro de texto (busca em título, descrição, requisitos)
    if (query) {
      const textSearchCondition: Prisma.JobWhereInput = { OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { requirements: { contains: query, mode: 'insensitive' } },
        { tags: { hasSome: [query] } }
      ]};
      andConditions.push(textSearchCondition);
    }
    
    // Company Name Filter
    if (company) {
      const companyCondition: Prisma.JobWhereInput = { company: {
        name: { contains: company, mode: 'insensitive' }
      }};
      andConditions.push(companyCondition);
    }
    
    // Aplicar filtros adicionais
    if (filters.jobType && filters.jobType.length > 0) {
      andConditions.push({ jobType: { in: filters.jobType } });
    }
    
    if (filters.experienceLevel && filters.experienceLevel.length > 0) {
      andConditions.push({ experienceLevel: { in: filters.experienceLevel } });
    }
    
    if (filters.location) {
      andConditions.push({ location: { contains: filters.location, mode: 'insensitive' } });
    }
    
    if (filters.country) {
      andConditions.push({ country: { equals: filters.country } });
    }
    
    if (filters.workplaceType) {
      andConditions.push({ workplaceType: { equals: filters.workplaceType } });
    }
    
    if (filters.minSalary) {
      andConditions.push({ minSalary: { gte: filters.minSalary } });
    }
    
    if (filters.tags && filters.tags.length > 0) {
      andConditions.push({ tags: { hasSome: filters.tags } });
    }
    
    if (filters.technologies && filters.technologies.length > 0) {
      const techCondition: Prisma.JobWhereInput = { technologies: {
        some: {
          name: {
            in: filters.technologies,
            mode: 'insensitive'
          }
        }
      }};
      andConditions.push(techCondition);
    }
    
    if (filters.visas && filters.visas.length > 0) {
      andConditions.push({ visas: { hasSome: filters.visas } });
    }
    
    if (filters.languages && filters.languages.length > 0) {
      andConditions.push({ languages: { hasSome: filters.languages } });
    }
    
    // Hiring Region Filter (Handles explicit override, though default is LATAM)
    // Note: Currently, the only hiringRegion handled besides the default LATAM is WORLDWIDE,
    // but the core goal is LATAM, so overriding might not be desired.
    if (filters.hiringRegion && filters.hiringRegion !== HiringRegion.LATAM) {
      // If an explicit, non-LATAM region is requested, find whereClause.AND or initialize it
      let currentAnd = whereClause.AND ? (Array.isArray(whereClause.AND) ? whereClause.AND : [whereClause.AND]) : [];
      
      // Remove the default LATAM filter if present in the base whereClause
      delete whereClause.hiringRegion;

      // Add the explicitly requested region filter
      if (filters.hiringRegion === HiringRegion.WORLDWIDE) {
        currentAnd.push({ 
          OR: [
            { hiringRegion: HiringRegion.WORLDWIDE },
            { hiringRegion: null } // Include jobs where region couldn't be determined
          ]
        });
      } else {
        // If other regions were supported, they'd go here
        // For now, only WORLDWIDE override is considered
        // currentAnd.push({ hiringRegion: filters.hiringRegion });
         console.warn(`Requested hiringRegion ${filters.hiringRegion} is not explicitly handled beyond LATAM/WORLDWIDE.`);
      }
      
      // Re-assign the AND conditions
      if (currentAnd.length > 0) {
           whereClause.AND = currentAnd;
      } else {
           delete whereClause.AND; // Remove AND if it became empty
      }      
    }

    // Combine *other* filters using AND
    if (andConditions.length > 0) {
      // If whereClause.AND already exists (from hiringRegion override), merge;
      // otherwise, assign andConditions.
      if (whereClause.AND) {
         // Ensure it's an array and merge
         const existingAnd = Array.isArray(whereClause.AND) ? whereClause.AND : [whereClause.AND];
         whereClause.AND = [...existingAnd, ...andConditions];
      } else {
         whereClause.AND = andConditions;
      }
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
