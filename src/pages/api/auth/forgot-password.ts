import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { sendEmail } from '@/lib/email';

// Schema de validação para solicitação de recuperação de senha
const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
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
    const validationResult = forgotPasswordSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: validationResult.error.format(),
      });
    }

    const { email } = validationResult.data;

    // Verificar se o usuário existe
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Mesmo que o usuário não exista, retornamos mensagem de sucesso por segurança
    if (!user) {
      return res.status(200).json({
        message: 'Se o email estiver registrado, enviaremos um link de recuperação',
      });
    }

    // Gerar token de recuperação
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token válido por 1 hora

    // Salvar token no banco de dados
    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    // Enviar email com link de recuperação
    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
    
    await sendEmail({
      to: email,
      subject: 'Recuperação de Senha - RemoteJobsBR',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Recuperação de Senha</h2>
          <p>Olá ${user.name},</p>
          <p>Recebemos uma solicitação para redefinir a senha da sua conta na RemoteJobsBR.</p>
          <p>Para criar uma nova senha, clique no link abaixo:</p>
          <p><a href="${resetUrl}" style="background-color: #4F46E5; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 10px 0;">Redefinir Senha</a></p>
          <p>O link é válido por 1 hora. Se você não solicitou a redefinição de senha, ignore este email.</p>
          <p>Atenciosamente,<br>Equipe RemoteJobsBR</p>
        </div>
      `,
    });

    return res.status(200).json({
      message: 'Se o email estiver registrado, enviaremos um link de recuperação',
    });
  } catch (error) {
    console.error('Erro ao processar recuperação de senha:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor ao processar a solicitação',
    });
  }
} 
