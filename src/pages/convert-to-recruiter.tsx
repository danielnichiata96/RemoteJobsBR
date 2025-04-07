// src/pages/api/user/convert-to-recruiter.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]'; // Caminho correto
import { prisma } from '@/lib/prisma'; // Ajuste o caminho se necessário
import { UserRole } from '@prisma/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Verificar a autenticação
    const session = await getServerSession(req, res, authOptions);

    if (!session || !session.user) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    // Verificar se o usuário já é um recrutador
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (user.role === UserRole.COMPANY) {
      return res.status(400).json({ error: 'Usuário já é um recrutador' });
    }

    // Converter o usuário para recrutador
    const updatedUser = await prisma.user.update({
      where: {
        id: session.user.id,
      },
      data: {
        role: UserRole.COMPANY,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Conta convertida para recrutador com sucesso',
    });
  } catch (error) {
    console.error('Erro ao converter conta:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}