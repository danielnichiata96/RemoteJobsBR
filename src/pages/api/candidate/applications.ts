import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificar autenticação
  const session = await getServerSession(req, res, authOptions);
  
  if (!session) {
    return res.status(401).json({ message: 'Não autorizado' });
  }

  // Verificar se é um candidato
  if (session.user.role !== UserRole.CANDIDATE) {
    return res.status(403).json({ message: 'Acesso negado. Apenas candidatos podem acessar este recurso.' });
  }

  const userId = session.user.id;

  // GET - Obter candidaturas do candidato
  if (req.method === 'GET') {
    try {
      const applications = await prisma.application.findMany({
        where: { candidateId: userId },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              company: {
                select: {
                  name: true,
                  logo: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.status(200).json({ applications });
    } catch (error) {
      console.error('Erro ao buscar candidaturas:', error);
      return res.status(500).json({ message: 'Erro ao buscar candidaturas' });
    }
  }

  return res.status(405).json({ message: 'Método não permitido' });
} 