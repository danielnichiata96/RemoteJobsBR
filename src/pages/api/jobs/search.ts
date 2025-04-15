import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { JobStatus, JobType, ExperienceLevel, HiringRegion, Prisma } from '@prisma/client';
// Import cache utilities from the new shared file
import { searchCache, generateCacheKey } from '@/lib/cache/searchCache'; // Adjust path if necessary

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
    
    // Build the main whereClause (including status: ACTIVE)
    const whereClause: Prisma.JobWhereInput = {
      status: JobStatus.ACTIVE,
      // Default to LATAM, WORLDWIDE, or NULL hiring region
      OR: [
        { hiringRegion: HiringRegion.LATAM },
        { hiringRegion: HiringRegion.WORLDWIDE },
        { hiringRegion: null }
      ]
    };
    // Initialize array for additional AND conditions
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
    
    // --- Corrected Hiring Region Filter --- 
    // If a specific hiringRegion is requested, add it as an AND condition.
    // This works *in addition* to the base OR condition (LATAM/WORLDWIDE/null)
    // meaning if hiringRegion=BRAZIL is passed, it finds jobs that are
    // (LATAM or WORLDWIDE or null) AND (BRAZIL).
    // If the goal is to *only* find BRAZIL, the base OR would need modification.
    // Assuming current goal is to filter *within* the generally allowed regions.
    if (filters.hiringRegion) {
        andConditions.push({ hiringRegion: filters.hiringRegion });
    }
    // --- End Corrected Hiring Region Filter ---

    // Combine all additional filters using AND
    if (andConditions.length > 0) {
      whereClause.AND = andConditions;
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

    // Executar TODAS as consultas (findMany, count, aggregations) em paralelo usando a MESMA whereClause
    const transactionResults = await prisma.$transaction([
      prisma.job.findMany({
        where: whereClause, // Uses the fully constructed whereClause
        select: jobSelectClause,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.job.count({
        where: whereClause, // CORRECTED: Use the EXACT same whereClause for counting
      }),
      prisma.job.groupBy({ // Aggregation query for jobType, experienceLevel
        by: ['jobType', 'experienceLevel'],
        where: whereClause, // Also use the same clause for relevant aggregations
        _count: { _all: true },
        having: {
          jobType: { not: null },
          experienceLevel: { not: null }
        },
      }),
      // Raw query for Technology aggregation (skills array)
      // TODO: Simplify WHERE clause for tech aggregation to avoid SQL syntax errors from dynamic filters.
      //       Currently aggregates across ALL active jobs, ignoring other filters for this specific aggregation.
      //       Consider a safer/more precise filtering method if needed later.
      prisma.$queryRaw<Array<{ technology: string, count: bigint }>>`
         SELECT unnest(skills) as technology, count(*)
         FROM "Job"
         -- Filter for active jobs AND jobs with non-empty skills arrays BEFORE grouping/unnesting
         WHERE "status" = 'ACTIVE' AND skills IS NOT NULL AND array_length(skills, 1) > 0
         GROUP BY unnest(skills) -- Use the original expression
         -- Keep only skills that appear at least once
         HAVING count(*) > 0 
         ORDER BY count(*) DESC -- Use count(*)
         LIMIT 20;`
    ]);
    
    // Process results
    const [jobs, totalCount, jobTypeExperienceAggs, technologyAggs] = transactionResults;
    
    // Process aggregations
    const processedAggregations: FilterAggregations = {
       jobTypes: {},
       experienceLevels: {},
       technologies: {}
    };

    // Process groupBy results for jobTypes and experienceLevels
    (jobTypeExperienceAggs as Array<{ jobType: JobType | null, experienceLevel: ExperienceLevel | null, _count: { _all: number }}>).forEach(group => {
        if (group.jobType) {
            processedAggregations.jobTypes[group.jobType] = (processedAggregations.jobTypes[group.jobType] || 0) + group._count._all;
        }
        if (group.experienceLevel) {
            processedAggregations.experienceLevels[group.experienceLevel] = (processedAggregations.experienceLevels[group.experienceLevel] || 0) + group._count._all;
        }
    });

     // Process raw query results for technologies
     if (technologyAggs) {
         technologyAggs.forEach(tech => {
             if (tech.technology && typeof tech.technology === 'string') { // Basic validation
                 processedAggregations.technologies[tech.technology] = Number(tech.count); 
             }
         });
     }

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
      aggregations: processedAggregations
    };

    // --- Store in Cache --- 
    // Cache successful responses with a TTL of 1 hour (3600 seconds)
    searchCache.set(cacheKey, responseData, 3600);
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

// Helper function to attempt converting Prisma WhereInput to SQL WHERE conditions
// WARNING: This is a simplified helper and might not cover all Prisma operators or nested structures.
// It's intended for basic filtering used in aggregations.
function getWhereConditionsForRawQuery(where: Prisma.JobWhereInput): string {
    const conditions: string[] = [];

    // ALWAYS ADD STATUS ACTIVE
    conditions.push(`"status" = 'ACTIVE'`);

    // --- Add other filters based on 'whereClause' structure ---

    // Handle base OR for hiringRegion
    if (Array.isArray(where.OR) && where.OR.length > 0) {
        const regionConditions = where.OR
            .map(cond => {
                if (cond.hiringRegion === null) return `"hiringRegion" IS NULL`;
                if (cond.hiringRegion) return `"hiringRegion" = '${cond.hiringRegion}'`;
                return null; // Should not happen if OR structure is correct
            })
            .filter(c => c !== null) // Filter out potential nulls
            .join(' OR ');
        if (regionConditions) {
             conditions.push(`(${regionConditions})`);
        }
    }

    // Handle AND conditions
    if (Array.isArray(where.AND) && where.AND.length > 0) {
        where.AND.forEach(cond => {
            // Text search (simplified example)
            if ('OR' in cond && Array.isArray(cond.OR)) {
                 const textOrConditions = cond.OR.map(textCond => {
                     if (textCond.title?.contains) return `"title" ILIKE '%${textCond.title.contains}%'`;
                     if (textCond.description?.contains) return `"description" ILIKE '%${textCond.description.contains}%'`;
                     // Add other text fields if needed
                     return null;
                 }).filter(c => c !== null).join (' OR ');
                 if (textOrConditions) conditions.push(`(${textOrConditions})`);
            }
            // Company filter (simplified example)
            else if (cond.company?.name?.contains) {
                conditions.push(`"companyId" IN (SELECT id FROM "User" WHERE name ILIKE '%${cond.company.name.contains}%' AND role = 'COMPANY')`);
            }
            // JobType filter
            else if (cond.jobType?.in && Array.isArray(cond.jobType.in)) {
                 const types = cond.jobType.in.map(t => `'${t}'`).join(',');
                 conditions.push(`"jobType" IN (${types})`);
            }
            // ExperienceLevel filter
            else if (cond.experienceLevel?.in && Array.isArray(cond.experienceLevel.in)) {
                 const levels = cond.experienceLevel.in.map(l => `'${l}'`).join(',');
                 conditions.push(`"experienceLevel" IN (${levels})`);
            }
             // Add more filters here mirroring the structure of 'andConditions' build logic
             // Example: Technology filter (omitted for simplicity as per TODO)
             // else if (cond.technologies?.some?.name?.in) { ... complex logic ... }
        });
    }

    return conditions.length > 0 ? conditions.join(' AND ') : 'TRUE'; // Return TRUE if no conditions generated (should not happen due to status)
}
