import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { UserRole, ExperienceLevel } from '@prisma/client';
import bcrypt from 'bcrypt';

// Validação do corpo da requisição para atualização de perfil
const updateProfileSchema = z.object({
  name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres').optional(),
  title: z.string().min(2, 'O título profissional deve ter pelo menos 2 caracteres').optional(),
  location: z.string().min(2, 'A localização deve ter pelo menos 2 caracteres').optional(),
  phone: z.string().optional(),
  bio: z.string().max(1000, 'A bio deve ter no máximo 1000 caracteres').optional(),
  linkedinUrl: z.string().url('URL do LinkedIn inválida').optional().or(z.literal('')),
  githubUrl: z.string().url('URL do GitHub inválida').optional().or(z.literal('')),
  portfolioUrl: z.string().url('URL do portfólio inválida').optional().or(z.literal('')),
  yearsOfExperience: z.number().min(0, 'Valor inválido').optional(),
  experienceLevel: z.nativeEnum(ExperienceLevel).optional(),
  desiredSalary: z.number().min(0, 'Valor inválido').optional(),
  availableForWork: z.boolean().optional(),
});

// Validação para alterar senha
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string().min(6, 'A nova senha deve ter pelo menos 6 caracteres'),
});

// Validação para atualizar currículo
const updateResumeSchema = z.object({
  resumeUrl: z.string().url('URL do currículo inválida').optional().nullable(),
});

// Validação para atualizar habilidades
const updateSkillsSchema = z.object({
  skills: z.array(z.string()),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificar autenticação
  console.log('API /candidate/profile chamada com método:', req.method);
  
  try {
    const session = await getServerSession(req, res, authOptions);
    
    console.log('Sessão atual:', 
      session ? { 
        userId: session.user?.id, 
        email: session.user?.email,
        role: session.user?.role 
      } : 'Sem sessão'
    );
    
    if (!session) {
      console.log('Sem sessão de autenticação');
      return res.status(401).json({ message: 'Não autorizado' });
    }

    // Verificar se é um candidato
    if (session.user.role !== UserRole.CANDIDATE) {
      console.log('Usuário não é um candidato. Role:', session.user.role);
      return res.status(403).json({ message: 'Acesso negado. Apenas candidatos podem acessar este recurso.' });
    }

    const userId = session.user.id;
    console.log('ID do usuário autenticado:', userId);

    // GET - Obter perfil do candidato
    if (req.method === 'GET') {
      try {
        console.log('Buscando perfil para o usuário ID:', userId);
        
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            title: true,
            bio: true,
            location: true,
            phone: true,
            resumeUrl: true,
            linkedinUrl: true,
            githubUrl: true,
            portfolioUrl: true,
            desiredSalary: true,
            availableForWork: true,
            preferredWorkTypes: true,
            preferredLocations: true,
            yearsOfExperience: true,
            experienceLevel: true,
            skills: true,
            languages: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        if (!user) {
          console.log('Usuário não encontrado na base de dados');
          return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        console.log('Perfil encontrado, retornando dados');
        return res.status(200).json(user);
      } catch (error) {
        console.error('Erro detalhado ao buscar perfil:', error);
        return res.status(500).json({ message: 'Erro ao buscar perfil', error: String(error) });
      }
    }

    // PUT - Atualizar perfil do candidato
    if (req.method === 'PUT') {
      try {
        const data = updateProfileSchema.parse(req.body);

        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data,
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            title: true,
            bio: true,
            location: true,
            phone: true,
            resumeUrl: true,
            linkedinUrl: true,
            githubUrl: true,
            portfolioUrl: true,
            desiredSalary: true,
            availableForWork: true,
            preferredWorkTypes: true,
            preferredLocations: true,
            yearsOfExperience: true,
            experienceLevel: true,
            skills: true,
            languages: true,
            updatedAt: true,
          },
        });

        // Registrar alteração no histórico (opcional)
        await prisma.userActivityLog.create({
          data: {
            userId: userId,
            actionType: 'PROFILE_UPDATE',
            details: JSON.stringify({
              action: 'Atualização de perfil',
              fields: Object.keys(data),
            }),
          },
        });

        return res.status(200).json(updatedUser);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
        }
        
        console.error('Erro ao atualizar perfil:', error);
        return res.status(500).json({ message: 'Erro ao atualizar perfil' });
      }
    }

    // PATCH - Para atualizações parciais (currículo, senha, skills, etc.)
    if (req.method === 'PATCH') {
      try {
        const { action } = req.query;

        // Alterar senha
        if (action === 'password') {
          const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { password: true },
          });

          if (!user || !user.password) {
            return res.status(400).json({ message: 'Usuário não possui senha cadastrada' });
          }

          const isValidPassword = await bcrypt.compare(currentPassword, user.password);
          if (!isValidPassword) {
            return res.status(400).json({ message: 'Senha atual incorreta' });
          }

          const hashedPassword = await bcrypt.hash(newPassword, 10);
          
          await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
          });

          // Registrar alteração no histórico
          await prisma.userActivityLog.create({
            data: {
              userId: userId,
              actionType: 'PASSWORD_CHANGE',
              details: JSON.stringify({
                action: 'Alteração de senha',
              }),
            },
          });

          return res.status(200).json({ message: 'Senha alterada com sucesso' });
        }

        // Atualizar currículo
        if (action === 'resume') {
          const { resumeUrl } = updateResumeSchema.parse(req.body);

          const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { resumeUrl },
            select: { resumeUrl: true },
          });

          // Registrar alteração no histórico
          await prisma.userActivityLog.create({
            data: {
              userId: userId,
              actionType: 'RESUME_UPDATE',
              details: JSON.stringify({
                action: resumeUrl ? 'Upload de currículo' : 'Remoção de currículo',
              }),
            },
          });

          return res.status(200).json(updatedUser);
        }

        // Atualizar habilidades
        if (action === 'skills') {
          const { skills } = updateSkillsSchema.parse(req.body);

          const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { skills },
            select: { skills: true },
          });

          // Registrar alteração no histórico
          await prisma.userActivityLog.create({
            data: {
              userId: userId,
              actionType: 'SKILLS_UPDATE',
              details: JSON.stringify({
                action: 'Atualização de habilidades',
                skillsCount: skills.length,
              }),
            },
          });

          return res.status(200).json(updatedUser);
        }

        return res.status(400).json({ message: 'Ação não suportada' });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
        }
        
        console.error('Erro ao processar requisição:', error);
        return res.status(500).json({ message: 'Erro ao processar requisição' });
      }
    }

    // DELETE - Excluir conta
    if (req.method === 'DELETE') {
      try {
        // Primeiro, obter dados para o log
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });

        // Registrar a exclusão no log
        await prisma.userActivityLog.create({
          data: {
            userId: userId,
            actionType: 'ACCOUNT_DELETION',
            details: JSON.stringify({
              action: 'Exclusão de conta',
              email: user?.email,
            }),
          },
        });

        // Excluir o usuário
        await prisma.user.delete({
          where: { id: userId },
        });

        return res.status(200).json({ message: 'Conta excluída com sucesso' });
      } catch (error) {
        console.error('Erro ao excluir conta:', error);
        return res.status(500).json({ message: 'Erro ao excluir conta' });
      }
    }

    return res.status(405).json({ message: 'Método não permitido' });
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return res.status(500).json({ message: 'Erro ao processar requisição' });
  }
} 