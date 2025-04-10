import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Get user session
  const session = await getServerSession(req, res, authOptions);

  // Check if user is authenticated
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const userEmail = session.user.email;

  // Handle GET request (fetch user profile)
  if (req.method === 'GET') {
    try {
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
      });

      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      // Remove sensitive information
      const { password, ...userWithoutPassword } = user;
      return res.status(200).json(userWithoutPassword);
    } catch (error) {
      console.error('Erro ao buscar dados do usuário:', error);
      return res.status(500).json({ error: 'Erro ao buscar dados do usuário' });
    }
  }

  // Handle PUT request (update user profile)
  if (req.method === 'PUT') {
    try {
      const {
        name,
        title,
        bio,
        location,
        phone,
        linkedinUrl,
        githubUrl,
        portfolioUrl,
        resumeUrl,
        desiredSalary,
        availableForWork,
        yearsOfExperience,
        experienceLevel,
        skills,
        preferredWorkTypes,
        preferredLocations,
      } = req.body;

      // Find user first to ensure they exist
      const existingUser = await prisma.user.findUnique({
        where: { email: userEmail },
      });

      if (!existingUser) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      // Update user profile
      const updatedUser = await prisma.user.update({
        where: { email: userEmail },
        data: {
          name,
          title,
          bio,
          location,
          phone,
          linkedinUrl,
          githubUrl,
          portfolioUrl,
          resumeUrl,
          desiredSalary,
          availableForWork,
          yearsOfExperience,
          experienceLevel,
          skills,
          preferredWorkTypes,
          preferredLocations,
          updatedAt: new Date(),
        },
      });

      // Remove sensitive information
      const { password, ...userWithoutPassword } = updatedUser;
      return res.status(200).json(userWithoutPassword);
    } catch (error) {
      console.error('Erro ao atualizar perfil do usuário:', error);
      return res.status(500).json({ error: 'Erro ao atualizar perfil do usuário' });
    }
  }

  // Handle unsupported HTTP methods
  return res.status(405).json({ error: 'Método não permitido' });
} 