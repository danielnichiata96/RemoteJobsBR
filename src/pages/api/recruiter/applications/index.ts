import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { ApplicationStatus } from '@prisma/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticação
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  // Verificar se o usuário é um recrutador
  const user = await prisma.user.findUnique({
    where: { 
      email: session.user.email as string,
      role: 'COMPANY'
    }
  });

  if (!user) {
    return res.status(403).json({ error: 'Acesso apenas para recrutadores' });
  }

  // Apenas método GET é permitido
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Extrair parâmetros de filtro e paginação
    const jobId = req.query.jobId as string | undefined;
    const status = req.query.status as ApplicationStatus | undefined;
    const search = req.query.search as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const sortBy = req.query.sortBy as string || 'createdAt';
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'desc';
    
    // Calcular o offset para paginação
    const skip = (page - 1) * limit;
    
    // Construir a cláusula where
    const whereClause: any = {
      job: {
        companyId: user.id
      }
    };
    
    // Filtrar por vaga específica
    if (jobId) {
      whereClause.jobId = jobId;
    }
    
    // Filtrar por status
    if (status) {
      whereClause.status = status;
    }
    
    // Filtrar por termo de busca (nome do candidato ou título da vaga)
    if (search) {
      whereClause.OR = [
        {
          candidate: {
            user: {
              name: {
                contains: search,
                mode: 'insensitive'
              }
            }
          }
        },
        {
          job: {
            title: {
              contains: search,
              mode: 'insensitive'
            }
          }
        }
      ];
    }

    // Determinar a ordenação
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;
    
    // Buscar candidaturas com contagem total
    const [applications, totalCount] = await Promise.all([
      prisma.application.findMany({
        where: whereClause,
        include: {
          job: {
            select: {
              id: true,
              title: true,
              location: true,
              country: true,
              workplaceType: true,
              status: true
            }
          },
          candidate: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true
                }
              }
            }
          },
          _count: {
            select: {
              statusHistory: true
            }
          }
        },
        orderBy,
        skip,
        take: limit
      }),
      prisma.application.count({ where: whereClause })
    ]);

    // Contar candidaturas por status
    const statusCounts = await prisma.application.groupBy({
      by: ['status'],
      where: {
        job: {
          companyId: user.id
        }
      },
      _count: {
        status: true
      }
    });
    
    // Formatar contagens por status
    const countsByStatus = statusCounts.reduce((acc: Record<string, number>, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {});

    // Calcular metadados de paginação
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return res.status(200).json({
      applications,
      countsByStatus,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        pageSize: limit,
        hasNextPage,
        hasPrevPage
      },
      filters: {
        jobId,
        status,
        search
      }
    });
  } catch (error) {
    console.error('Erro ao buscar candidaturas:', error);
    return res.status(500).json({ error: 'Erro ao processar a solicitação' });
  }
} 