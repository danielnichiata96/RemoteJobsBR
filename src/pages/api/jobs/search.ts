import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { JobStatus, JobType, ExperienceLevel } from '@prisma/client';

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
  remote?: boolean;
  sortBy?: 'newest' | 'salary' | 'relevance';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Apenas método GET é permitido
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
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

    // Buscar vagas com contagem total
    const [jobs, totalCount] = await Promise.all([
      prisma.job.findMany({
        where: whereClause,
        orderBy,
        skip,
        take: limit,
        select: {
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
          createdAt: true,
          publishedAt: true,
          viewCount: true,
          _count: {
            select: {
              savedBy: true
            }
          }
        }
      }),
      prisma.job.count({ where: whereClause })
    ]);

    // Calcular metadados da paginação
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return res.status(200).json({
      jobs,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        pageSize: limit,
        hasNextPage,
        hasPrevPage
      },
      filters: {
        ...filters,
        query
      }
    });
  } catch (error) {
    console.error('Erro na pesquisa de vagas:', error);
    return res.status(500).json({ error: 'Erro ao processar a solicitação' });
  }
} 
