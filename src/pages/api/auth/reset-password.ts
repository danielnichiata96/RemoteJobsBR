import { NextApiRequest, NextApiResponse } from 'next';
import { hash } from 'bcrypt';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// Schema de validação para redefinição de senha
const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Apenas aceita método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Validar dados do corpo da requisição
    const validationResult = resetPasswordSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: validationResult.error.format(),
      });
    }

    const { token, password } = validationResult.data;

    // Buscar o token no banco de dados
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
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

    // Criptografar a nova senha
    const hashedPassword = await hash(password, 10);

    // Atualizar a senha do usuário
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    });

    // Marcar o token como utilizado
    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    });

    return res.status(200).json({
      success: true,
      message: 'Senha redefinida com sucesso',
    });
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor ao processar a redefinição de senha',
    });
  }
} 