import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { token, email } = req.query;
    
    if (!email || typeof email !== 'string' || !token || typeof token !== 'string') {
      return res.redirect(`/auth/error?error=Verification&message=${encodeURIComponent('Token ou email inválido na URL')}`);
    }

    // Verificar se o token existe e é válido
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: email,
        token: token,
        expires: {
          gt: new Date()
        }
      }
    });

    if (!verificationToken) {
      return res.redirect(`/auth/error?error=Verification&message=${encodeURIComponent('Token inválido ou expirado')}`);
    }
    
    // Buscar o usuário pelo email
    const user = await prisma.user.findUnique({
      where: { email },
    });
    
    if (!user) {
      // Criar usuário se não existir
      try {
        await prisma.user.create({
          data: {
            email,
            name: email.split('@')[0] || 'Recrutador',
            role: UserRole.COMPANY,
            emailVerified: new Date(),
            isActive: true,
          }
        });
      } catch (error) {
        console.error('Erro ao criar usuário:', error);
        return res.redirect(`/auth/error?error=Default&message=${encodeURIComponent('Erro ao criar usuário: ' + error.message)}`);
      }
    } else {
      // Atualizar usuário existente
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { 
            emailVerified: new Date(),
          },
        });
      } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        return res.redirect(`/auth/error?error=Default&message=${encodeURIComponent('Erro ao atualizar usuário: ' + error.message)}`);
      }
    }
    
    // Remover o token usado
    try {
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: email,
            token: token
          }
        }
      });
    } catch (error) {
      console.error('Erro ao deletar token usado:', error);
      // Continuar o fluxo mesmo se falhar ao deletar o token
    }
    
    // Redirecionar para o dashboard com uma mensagem de sucesso
    return res.redirect('/recruiter/dashboard?verified=true');
  } catch (error) {
    console.error('Erro ao verificar email:', error);
    return res.redirect(`/auth/error?error=Default&message=${encodeURIComponent('Erro inesperado durante a verificação: ' + error.message)}`);
  }
} 