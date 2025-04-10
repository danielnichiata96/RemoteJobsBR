import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check user authentication
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  // Get job ID from the URL
  const { jobId } = req.query;
  
  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'ID da vaga é obrigatório' });
  }

  try {
    // Find the user ID by email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // POST: Save a job
    if (req.method === 'POST') {
      // Check if job exists
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: { id: true }
      });

      if (!job) {
        return res.status(404).json({ error: 'Vaga não encontrada' });
      }

      // Check if already saved (to prevent duplicates)
      const existingSavedJob = await prisma.savedJob.findUnique({
        where: {
          candidateId_jobId: {
            candidateId: user.id,
            jobId: jobId
          }
        }
      });

      if (existingSavedJob) {
        return res.status(200).json({ message: 'Vaga já está salva', isSaved: true });
      }

      // Save the job
      const savedJob = await prisma.savedJob.create({
        data: {
          candidateId: user.id,
          jobId: jobId
        }
      });

      return res.status(201).json({ 
        message: 'Vaga salva com sucesso',
        isSaved: true,
        savedJob 
      });
    }
    
    // DELETE: Remove a saved job
    if (req.method === 'DELETE') {
      const savedJob = await prisma.savedJob.findUnique({
        where: {
          candidateId_jobId: {
            candidateId: user.id,
            jobId: jobId
          }
        }
      });

      if (!savedJob) {
        return res.status(404).json({ error: 'Vaga salva não encontrada' });
      }

      // Delete the saved job
      await prisma.savedJob.delete({
        where: {
          candidateId_jobId: {
            candidateId: user.id,
            jobId: jobId
          }
        }
      });

      return res.status(200).json({ 
        message: 'Vaga removida dos salvos com sucesso',
        isSaved: false 
      });
    }

    // GET: Check if a job is saved
    if (req.method === 'GET') {
      const savedJob = await prisma.savedJob.findUnique({
        where: {
          candidateId_jobId: {
            candidateId: user.id,
            jobId: jobId
          }
        }
      });

      return res.status(200).json({ 
        isSaved: !!savedJob,
        savedJob 
      });
    }

    // Method not allowed
    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error) {
    console.error('Error managing saved job:', error);
    return res.status(500).json({ error: 'Erro ao processar a operação de vaga salva' });
  }
} 