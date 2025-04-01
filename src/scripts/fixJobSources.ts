const { PrismaClient } = require('@prisma/client');
const pino = require('pino');

const prisma = new PrismaClient();
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    }
  }
});

async function main() {
  logger.info('Iniciando correção de fontes de vagas...');
  
  try {
    // 1. Identificar vagas do Greenhouse que estão com fonte incorreta
    const incorrectGreenhouseJobs = await prisma.job.findMany({
      where: {
        id: {
          startsWith: 'greenhouse_'
        },
        source: {
          not: 'greenhouse'
        }
      },
      select: {
        id: true,
        source: true,
        title: true
      }
    });
    
    logger.info(`Encontradas ${incorrectGreenhouseJobs.length} vagas do Greenhouse com fonte incorreta`);
    
    // 2. Corrigir as fontes incorretas
    if (incorrectGreenhouseJobs.length > 0) {
      for (const job of incorrectGreenhouseJobs) {
        logger.info(`Corrigindo vaga: ${job.id} - ${job.title} (fonte atual: ${job.source})`);
        
        await prisma.job.update({
          where: { id: job.id },
          data: { source: 'greenhouse' }
        });
      }
      
      logger.info('Vagas do Greenhouse corrigidas com sucesso');
    }
    
    // 3. Verificar vagas que são diretas mas não têm sourceId
    const directJobsWithoutSourceId = await prisma.job.findMany({
      where: {
        source: 'direct',
        sourceId: null
      },
      select: {
        id: true,
        title: true
      }
    });
    
    logger.info(`Encontradas ${directJobsWithoutSourceId.length} vagas diretas sem sourceId`);
    
    // 4. Atualizar sourceId para vagas diretas
    if (directJobsWithoutSourceId.length > 0) {
      for (const job of directJobsWithoutSourceId) {
        logger.info(`Atualizando sourceId para vaga: ${job.id} - ${job.title}`);
        
        await prisma.job.update({
          where: { id: job.id },
          data: { sourceId: job.id }
        });
      }
      
      logger.info('Vagas diretas atualizadas com sucesso');
    }
    
    // 5. Estatísticas finais
    const stats = await prisma.$transaction([
      prisma.job.count({ where: { source: 'direct' } }),
      prisma.job.count({ where: { source: 'greenhouse' } }),
      prisma.job.count()
    ]);
    
    logger.info('Estatísticas após correção:');
    logger.info(`- Vagas diretas: ${stats[0]}`);
    logger.info(`- Vagas do Greenhouse: ${stats[1]}`);
    logger.info(`- Total de vagas: ${stats[2]}`);
    
  } catch (error) {
    logger.error('Erro durante a correção:', error);
  } finally {
    await prisma.$disconnect();
    logger.info('Processo de correção finalizado');
  }
}

main().catch(error => {
  logger.error('Erro fatal:', error);
  process.exit(1);
}); 