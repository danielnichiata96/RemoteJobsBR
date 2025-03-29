import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Apenas permitir solicitações POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    // Obter todos os tokens
    const allTokens = await prisma.verificationToken.findMany();
    
    console.log(`Encontrados ${allTokens.length} tokens no banco`);
    
    // Determinar quais tokens deletar
    const now = new Date();
    
    // Se forceAll=true, deletar todos os tokens
    // Se forceEmail está definido, deletar todos os tokens para aquele email
    const forceAll = req.query.forceAll === 'true';
    const forceEmail = req.query.email as string | undefined;
    
    let tokensToDelete = [];
    
    if (forceAll) {
      tokensToDelete = allTokens;
      console.log(`Forçando deleção de todos os ${allTokens.length} tokens`);
    } else if (forceEmail) {
      tokensToDelete = allTokens.filter(token => token.identifier === forceEmail);
      console.log(`Forçando deleção de ${tokensToDelete.length} tokens para o email ${forceEmail}`);
    } else {
      // Comportamento padrão: apenas tokens expirados
      tokensToDelete = allTokens.filter(token => now > token.expires);
      console.log(`${tokensToDelete.length} tokens estão expirados`);
    }
    
    // Deletar tokens
    let deletedCount = 0;
    
    for (const token of tokensToDelete) {
      try {
        // Tentar deletar usando a chave composta
        await prisma.verificationToken.delete({
          where: {
            identifier_token: {
              identifier: token.identifier,
              token: token.token
            }
          }
        });
        deletedCount++;
      } catch (error) {
        console.error(`Erro ao deletar token ${token.token.substring(0, 10)}...`, error);
        
        // Tentar com SQL raw
        try {
          await prisma.$executeRaw`DELETE FROM "VerificationToken" WHERE "token" = ${token.token}`;
          deletedCount++;
        } catch (sqlError) {
          console.error(`Erro ao deletar token com SQL raw`, sqlError);
        }
      }
    }
    
    // Criar um novo token de teste se solicitado
    let newToken = null;
    if (req.query.createTest === 'true' && req.query.email) {
      const email = req.query.email as string;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      try {
        newToken = await prisma.verificationToken.create({
          data: {
            identifier: email,
            token: `test-${Date.now()}`,
            expires: tomorrow
          }
        });
        
        console.log('Novo token de teste criado para', email);
      } catch (error) {
        console.error('Erro ao criar token de teste:', error);
      }
    }
    
    return res.status(200).json({
      success: true,
      totalCount: allTokens.length,
      tokensToDeleteCount: tokensToDelete.length,
      deletedCount,
      newToken: newToken ? {
        identifier: newToken.identifier,
        tokenPreview: newToken.token.substring(0, 10) + '...',
        expires: newToken.expires
      } : null
    });
  } catch (error) {
    console.error('Erro ao limpar tokens:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
} 