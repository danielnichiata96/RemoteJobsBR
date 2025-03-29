import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import prisma from '@/lib/prisma';

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
    where: { email: session.user.email as string },
    include: { recruiter: true },
  });

  if (!user?.recruiter) {
    return res.status(403).json({ error: 'Acesso apenas para recrutadores' });
  }

  // Verificar método da requisição
  if (req.method === 'GET') {
    try {
      // Buscar todas as vagas da empresa do recrutador
      const jobs = await prisma.job.findMany({
        where: {
          companyId: user.recruiter.companyId,
        },
        select: {
          id: true,
          title: true,
          location: true,
          salary: true,
          type: true,
          description: true,
          requirements: true,
          createdAt: true,
          updatedAt: true,
          isActive: true,
          _count: {
            select: {
              applications: true,
            }
          }
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return res.status(200).json({ jobs });
    } catch (error) {
      console.error('Erro ao buscar vagas:', error);
      return res.status(500).json({ error: 'Erro ao processar a solicitação' });
    }
  } else if (req.method === 'POST') {
    try {
      // Validar dados da nova vaga
      const { 
        title, 
        description, 
        requirements, 
        location, 
        salary, 
        type,
        isActive = true
      } = req.body;

      // Verificar campos obrigatórios
      if (!title || !description) {
        return res.status(400).json({ error: 'Título e descrição são obrigatórios' });
      }

      // Criar nova vaga
      const newJob = await prisma.job.create({
        data: {
          title,
          description,
          requirements,
          location,
          salary,
          type,
          isActive,
          company: {
            connect: {
              id: user.recruiter.companyId,
            },
          },
        },
      });

      return res.status(201).json({ job: newJob });
    } catch (error) {
      console.error('Erro ao criar vaga:', error);
      return res.status(500).json({ error: 'Erro ao processar a solicitação' });
    }
  }

  // Método não permitido
  return res.status(405).json({ error: 'Método não permitido' });
} 