import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Schema para validação do registro de visualização
const viewSchema = z.object({
  jobId: z.string().uuid(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Apenas método POST é permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Validar dados da requisição
    const validationResult = viewSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: validationResult.error.format()
      });
    }

    const { jobId } = validationResult.data;
    
    // Verificar se a vaga existe
    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });
    
    if (!job) {
      return res.status(404).json({ error: 'Vaga não encontrada' });
    }

    // Obter o usuário atual (opcional)
    const session = await getServerSession(req, res, authOptions);
    const userId = session?.user ? 
      (await prisma.user.findUnique({ where: { email: session.user.email as string } }))?.id : 
      null;
    
    // Obter o IP do cliente (para limitar múltiplas visualizações)
    const clientIp = req.headers['x-forwarded-for'] || 
                     req.socket.remoteAddress || 
                     'unknown';
                     
    // Verificar se já houve visualização recente do mesmo IP ou usuário
    const recentView = await prisma.jobView.findFirst({
      where: {
        jobId,
        OR: [
          { 
            ipAddress: clientIp as string,
            createdAt: {
              gte: new Date(new Date().getTime() - 4 * 60 * 60 * 1000) // 4 horas
            }
          },
          userId ? {
            userId,
            createdAt: {
              gte: new Date(new Date().getTime() - 24 * 60 * 60 * 1000) // 24 horas
            }
          } : {}
        ]
      }
    });
    
    // Se não houver visualização recente, registrar nova visualização
    if (!recentView) {
      // Registrar visualização
      await prisma.jobView.create({
        data: {
          job: { connect: { id: jobId } },
          user: userId ? { connect: { id: userId } } : undefined,
          ipAddress: clientIp as string,
        }
      });
      
      // Incrementar contador de visualizações na vaga
      await prisma.job.update({
        where: { id: jobId },
        data: { viewCount: { increment: 1 } }
      });
    }

    return res.status(200).json({ 
      success: true,
      message: 'Visualização registrada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao registrar visualização:', error);
    return res.status(500).json({ error: 'Erro ao processar a solicitação' });
  }
} 