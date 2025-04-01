import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Apenas aceita método GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const token = req.query.token as string;

  if (!token) {
    return res.status(400).json({ error: 'Token não fornecido' });
  }

  try {
    // Buscar o token no banco de dados
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    // Verificar se o token existe e ainda não expirou
    if (!resetToken) {
      return res.status(400).json({ error: 'Token inválido' });
    }

    const now = new Date();
    if (resetToken.expiresAt < now) {
      return res.status(400).json({ error: 'Token expirado' });
    }

    if (resetToken.used) {
      return res.status(400).json({ error: 'Token já utilizado' });
    }

    // Token válido
    return res.status(200).json({
      valid: true,
      userId: resetToken.userId,
      email: resetToken.user.email,
    });
  } catch (error) {
    console.error('Erro ao verificar token de redefinição de senha:', error);
    return res.status(500).json({
      error: 'Erro ao verificar o token',
    });
  }
} 
