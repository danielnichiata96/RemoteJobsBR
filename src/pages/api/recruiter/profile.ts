import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

// Schema de validação para informações da empresa
const companyInfoSchema = z.object({
  companyName: z.string().min(1, 'Nome da empresa é obrigatório'),
  companyEmail: z.string().email('Email inválido'),
  description: z.string().optional(),
  industry: z.string().optional(),
  website: z.string().url('URL inválida').optional().nullable(),
  location: z.string().optional(),
  companySize: z.string().optional(),
  foundedYear: z.number().optional().nullable(),
  contactName: z.string().optional(),
  contactEmail: z.string().email('Email de contato inválido').optional(),
  contactPhone: z.string().optional(),
  linkedinUrl: z.string().url('URL do LinkedIn inválida').optional().nullable(),
  twitterUrl: z.string().url('URL do Twitter inválida').optional().nullable(),
});

// Schema para mudança de senha
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string().min(8, 'Nova senha deve ter pelo menos 8 caracteres'),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  // Verificar autenticação e papel do usuário
  if (!session || !session.user || session.user.role !== UserRole.RECRUITER) {
    return res.status(401).json({ message: 'Não autorizado' });
  }

  const userId = session.user.id;

  // GET: Obter dados do perfil
  if (req.method === 'GET') {
    try {
      const userWithProfile = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          recruiter: {
            include: {
              company: true,
            },
          },
        },
      });

      if (!userWithProfile) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      // Limpar dados sensíveis
      const { password, ...userData } = userWithProfile;

      return res.status(200).json(userData);
    } catch (error) {
      console.error('Erro ao obter perfil do recrutador:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  // PUT: Atualizar informações da empresa
  if (req.method === 'PUT') {
    try {
      const validationResult = companyInfoSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Dados inválidos', 
          errors: validationResult.error.format() 
        });
      }

      const data = validationResult.data;

      // Verificar se o recrutador existe
      const recruiter = await prisma.recruiter.findUnique({
        where: { userId },
        include: { company: true },
      });

      if (!recruiter) {
        return res.status(404).json({ message: 'Perfil de recrutador não encontrado' });
      }

      // Atualizar ou criar a empresa associada ao recrutador
      const companyId = recruiter.companyId;

      let updatedRecruiter;

      if (companyId) {
        // Atualizar empresa existente
        updatedRecruiter = await prisma.recruiter.update({
          where: { userId },
          data: {
            company: {
              update: {
                name: data.companyName,
                email: data.companyEmail,
                description: data.description,
                industry: data.industry,
                website: data.website,
                location: data.location,
                size: data.companySize,
                foundedYear: data.foundedYear,
                contactName: data.contactName,
                contactEmail: data.contactEmail,
                contactPhone: data.contactPhone,
                linkedinUrl: data.linkedinUrl,
                twitterUrl: data.twitterUrl,
              },
            },
          },
          include: {
            company: true,
          },
        });
      } else {
        // Criar nova empresa
        updatedRecruiter = await prisma.recruiter.update({
          where: { userId },
          data: {
            company: {
              create: {
                name: data.companyName,
                email: data.companyEmail,
                description: data.description,
                industry: data.industry,
                website: data.website,
                location: data.location,
                size: data.companySize,
                foundedYear: data.foundedYear,
                contactName: data.contactName,
                contactEmail: data.contactEmail,
                contactPhone: data.contactPhone,
                linkedinUrl: data.linkedinUrl,
                twitterUrl: data.twitterUrl,
              },
            },
          },
          include: {
            company: true,
          },
        });
      }

      return res.status(200).json(updatedRecruiter);
    } catch (error) {
      console.error('Erro ao atualizar perfil do recrutador:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  // PATCH: Alterações específicas (senha)
  if (req.method === 'PATCH') {
    const { action } = req.query;

    // Alteração de senha
    if (action === 'password') {
      try {
        const validationResult = passwordChangeSchema.safeParse(req.body);

        if (!validationResult.success) {
          return res.status(400).json({ 
            message: 'Dados inválidos', 
            errors: validationResult.error.format() 
          });
        }

        const { currentPassword, newPassword } = validationResult.data;

        // Verificar usuário
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { password: true },
        });

        if (!user) {
          return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        // Verificar senha atual
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password as string);

        if (!isPasswordValid) {
          return res.status(400).json({ message: 'Senha atual incorreta' });
        }

        // Hash nova senha
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Atualizar senha
        await prisma.user.update({
          where: { id: userId },
          data: { password: hashedPassword },
        });

        return res.status(200).json({ message: 'Senha alterada com sucesso' });
      } catch (error) {
        console.error('Erro ao alterar senha:', error);
        return res.status(500).json({ message: 'Erro interno do servidor' });
      }
    }

    return res.status(400).json({ message: 'Ação não suportada' });
  }

  // DELETE: Excluir conta
  if (req.method === 'DELETE') {
    try {
      // Obter recrutador e empresa relacionada
      const recruiter = await prisma.recruiter.findUnique({
        where: { userId },
        select: { id: true, companyId: true },
      });

      if (!recruiter) {
        return res.status(404).json({ message: 'Perfil de recrutador não encontrado' });
      }

      // Excluir em cascata
      await prisma.$transaction([
        // Excluir dados relacionados se necessário
        
        // Excluir recrutador
        prisma.recruiter.delete({
          where: { userId },
        }),
        
        // Excluir usuário
        prisma.user.delete({
          where: { id: userId },
        }),
      ]);

      return res.status(200).json({ message: 'Conta excluída com sucesso' });
    } catch (error) {
      console.error('Erro ao excluir conta:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  return res.status(405).json({ message: 'Método não permitido' });
} 