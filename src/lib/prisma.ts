import { PrismaClient } from '@prisma/client';

// Usar uma simples variável global para manter uma única instância
let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // No desenvolvimento, usar uma variável global para evitar múltiplas instâncias
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
    });
  }
  prisma = global.prisma;
}

export { prisma }; 