import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '../../auth/[...nextauth]';
import { z } from 'zod';
import { ApplicationStatus } from '@prisma/client';

// Schema para atualização do status da candidatura
const updateApplicationSchema = z.object({
  status: z.nativeEnum(ApplicationStatus),
  feedback: z.string().optional(),
  internalNotes: z.string().optional(),
  interviewDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: 'Data de entrevista inválida' }
  ),
});

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

  const applicationId = req.query.id as string;
  
  // Verificar se a candidatura existe e pertence a uma vaga do recrutador
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      job: {
        companyId: user.id
      }
    },
    include: {
      job: {
        select: {
          id: true,
          title: true
        }
      },
      candidate: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true
            }
          }
        }
      }
    }
  });
  
  if (!application) {
    return res.status(404).json({ error: 'Candidatura não encontrada ou você não tem permissão para acessá-la' });
  }

  // Método GET - Obter detalhes da candidatura
  if (req.method === 'GET') {
    return res.status(200).json({ application });
  } 
  
  // Método PUT - Atualizar status da candidatura
  else if (req.method === 'PUT') {
    try {
      // Validar dados da atualização
      const validationResult = updateApplicationSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: validationResult.error.format()
        });
      }
      
      const updateData = validationResult.data;
      
      // Atualizar status da candidatura
      const updatedApplication = await prisma.application.update({
        where: { id: applicationId },
        data: {
          status: updateData.status,
          feedback: updateData.feedback,
          internalNotes: updateData.internalNotes,
          interviewDate: updateData.interviewDate ? new Date(updateData.interviewDate) : undefined,
          // Adicionar registros de histórico
          statusHistory: {
            create: {
              status: updateData.status,
              notes: `Status atualizado para ${updateData.status}`,
              changedByUserId: user.id
            }
          }
        },
        include: {
          job: {
            select: {
              id: true,
              title: true
            }
          },
          candidate: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          },
          statusHistory: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 10
          }
        }
      });
      
      // Se o status for alterado para algo que exige notificação, enviar email (implementação futura)
      if (['INTERVIEW', 'APPROVED', 'REJECTED'].includes(updateData.status)) {
        // TODO: Implementar envio de email de notificação
        console.log(`Notificação a ser enviada para: ${updatedApplication.candidate.user.email}`);
      }

      return res.status(200).json({ 
        success: true,
        message: 'Status da candidatura atualizado com sucesso',
        application: updatedApplication
      });
    } catch (error) {
      console.error('Erro ao atualizar candidatura:', error);
      return res.status(500).json({ error: 'Erro ao processar a solicitação' });
    }
  } 
  
  // Método DELETE - Excluir candidatura (apenas para candidaturas não processadas)
  else if (req.method === 'DELETE') {
    try {
      // Verificar se a candidatura está em um estado que pode ser excluído
      if (!['SUBMITTED', 'VIEWED'].includes(application.status)) {
        return res.status(400).json({ 
          error: 'Não é possível excluir candidaturas que já foram processadas'
        });
      }
      
      // Excluir a candidatura
      await prisma.application.delete({
        where: { id: applicationId }
      });
      
      // Decrementar contador de candidaturas na vaga
      await prisma.job.update({
        where: { id: application.jobId },
        data: { applicantCount: { decrement: 1 } }
      });
      
      return res.status(200).json({
        success: true,
        message: 'Candidatura excluída com sucesso'
      });
    } catch (error) {
      console.error('Erro ao excluir candidatura:', error);
      return res.status(500).json({ error: 'Erro ao processar a solicitação' });
    }
  }

  // Método não permitido
  return res.status(405).json({ error: 'Método não permitido' });
} 