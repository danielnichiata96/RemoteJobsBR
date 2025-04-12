/**
 * Script para verificar quais fontes de vagas apresentam erros durante a busca
 * e desativá-las de forma organizada.
 */

import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import pMap from 'p-map';
import { GreenhouseFetcher } from '../lib/fetchers/GreenhouseFetcher';
import { JobProcessingAdapter } from '../lib/adapters/JobProcessingAdapter';

const prisma = new PrismaClient();
const jobProcessorAdapter = new JobProcessingAdapter();

// Configurar logger
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    },
  },
  level: 'info',
});

// Configurações
const DELETE_SOURCES_WITH_ERROR = true; // Alterado para true para DELETAR fontes com erro
const CONCURRENCY = 2; // Número baixo para não sobrecarregar as APIs

async function main() {
  logger.info('🔍 Verificando fontes de vagas do Greenhouse...');
  
  try {
    // Buscar todas as fontes ativas do tipo greenhouse
    const sources = await prisma.jobSource.findMany({
      where: {
        type: 'greenhouse',
        isEnabled: true
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    logger.info(`📋 Encontradas ${sources.length} fontes ativas do tipo 'greenhouse'`);
    
    if (sources.length === 0) {
      logger.info('Nenhuma fonte ativa para verificar.');
      return;
    }
    
    // Instanciar fetcher
    const fetcher = new GreenhouseFetcher(prisma, jobProcessorAdapter);
    
    // Arrays para armazenar os resultados
    const sourcesWithError: typeof sources = [];
    const sourcesOk: typeof sources = [];
    
    // Testar cada fonte com concorrência controlada
    logger.info(`🔄 Testando fontes (concorrência: ${CONCURRENCY})...`);
    
    await pMap(sources, async (source) => {
      const sourceLogger = logger.child({ source: source.name, sourceId: source.id });
      sourceLogger.info(`Testando fonte...`);
      
      try {
        // Apenas buscar a lista de vagas, sem processar completamente
        // Extraindo configuração do Greenhouse
        const config = source.config as any;
        if (!config || !config.boardToken) {
          throw new Error('Configuração inválida: boardToken não encontrado');
        }
        
        const boardToken = config.boardToken;
        const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=false`;
        
        // Chamar diretamente a API para verificar se é possível obter vagas
        const axios = require('axios');
        const response = await axios.get(apiUrl, { timeout: 15000 });
        
        if (!response.data || !Array.isArray(response.data.jobs)) {
          throw new Error(`Resposta inválida: formato dos dados não é o esperado`);
        }
        
        // Se chegou aqui, a fonte está funcionando
        sourceLogger.info({ jobCount: response.data.jobs.length }, `✅ Fonte OK - ${response.data.jobs.length} vagas encontradas`);
        sourcesOk.push(source);
        
      } catch (error: any) {
        const errorMessage = error.message || 'Erro desconhecido';
        const statusCode = error.response?.status;
        const errorDetails = statusCode 
          ? `Status HTTP ${statusCode}: ${errorMessage}`
          : errorMessage;
        
        sourceLogger.error({ error: errorDetails }, `❌ Erro ao testar fonte`);
        sourcesWithError.push(source);
      }
    }, { concurrency: CONCURRENCY, stopOnError: false });
    
    // Mostrar resumo
    logger.info('\n----- RESUMO DA VERIFICAÇÃO -----');
    logger.info(`✅ Fontes OK: ${sourcesOk.length}`);
    logger.info(`❌ Fontes com erro: ${sourcesWithError.length}`);
    
    // Listar fontes com erro
    if (sourcesWithError.length > 0) {
      logger.info('\nFontes com erro:');
      sourcesWithError.forEach((source, index) => {
        logger.info(`${index + 1}. ${source.name} (ID: ${source.id})`);
      });
      
      // Desativar fontes com erro se configurado
      if (DELETE_SOURCES_WITH_ERROR && sourcesWithError.length > 0) {
        logger.warn(`\n⚠️ DELETANDO ${sourcesWithError.length} fontes com erro... (Ação irreversível!)`);
        
        const sourceIds = sourcesWithError.map(s => s.id);
        // Alterado de updateMany para deleteMany
        await prisma.jobSource.deleteMany({
          where: { id: { in: sourceIds } }
        });
        
        logger.info(`✅ ${sourcesWithError.length} fontes DELETADAS com sucesso.`);
      } else if (sourcesWithError.length > 0) {
        logger.info(`\n⚠️ Para DELETAR automaticamente as fontes com erro, defina DELETE_SOURCES_WITH_ERROR = true no script.`);
        logger.info(`⚠️ Alternativamente, utilize o seguinte comando SQL para deletá-las manualmente:`);
        
        const sourceIdsStr = sourcesWithError.map(s => `'${s.id}'`).join(', ');
        // Alterado SQL de UPDATE para DELETE
        logger.info(`\n-- SQL:
DELETE FROM "JobSource" WHERE id IN (${sourceIdsStr});`);
      }
    } else {
      logger.info('🎉 Todas as fontes estão funcionando corretamente!');
    }
    
  } catch (error) {
    logger.error(error, '❌ Erro durante a verificação de fontes:');
  } finally {
    await prisma.$disconnect();
  }
}

// Executar script
main()
  .then(() => {
    logger.info('Script concluído.');
    process.exit(0);
  })
  .catch((e) => {
    logger.error(e, 'Erro fatal:');
    process.exit(1);
  }); 