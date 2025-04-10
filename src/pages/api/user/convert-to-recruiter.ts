import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Get user session
  const session = await getServerSession(req, res, authOptions);

  // Check if user is authenticated
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const userEmail = session.user.email;

  try {
    // Update user role to COMPANY (formerly RECRUITER)
    const updatedUser = await prisma.user.update({
      where: { email: userEmail },
      data: {
        role: UserRole.COMPANY,
        updatedAt: new Date(),
      },
    });

    // Remove sensitive information
    const { password, ...userWithoutPassword } = updatedUser;
    return res.status(200).json({
      message: 'Perfil atualizado para empresa com sucesso',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Erro ao converter para empresa:', error);
    return res.status(500).json({ error: 'Erro ao atualizar perfil para empresa' });
  }
} 