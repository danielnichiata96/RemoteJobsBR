/**
 * Script temporário para testar o filtro do GreenhouseFetcher com logs detalhados
 * Executa o fetcher para uma ou mais fontes específicas e grava logs detalhados
 * para análise posterior.
 */

import { PrismaClient, JobSource } from '@prisma/client';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { GreenhouseFetcher } from '../lib/fetchers/GreenhouseFetcher';
import { JobProcessingAdapter } from '../lib/adapters/JobProcessingAdapter';

// Configuração 
const LOG_TO_FILE = true; // Se true, grava logs em um arquivo
const DETAILED_LOGS = true; // Se true, ativa logs trace/debug
const TEST_ALL_SOURCES = false; // Se true, testa todas as fontes ativas
const TARGET_SOURCES = ['Canonical']; // Alterado para testar GitLab
const SKIP_SAVING = true; // Se true, não salva as vagas no banco (apenas simula)

// Configurar logger
const logLevel = DETAILED_LOGS ? 'trace' : 'info';
const logFilePath = path.resolve(process.cwd(), 'filter-test-logs.txt');

let logger: pino.Logger;

if (LOG_TO_FILE) {
  // Logger para arquivo
  logger = pino({
    level: logLevel,
    transport: {
      target: 'pino/file',
      options: { destination: logFilePath }
    }
  });
} else {
  // Logger para console
  logger = pino({
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
    level: logLevel,
  });
}

// Inicialização
const prisma = new PrismaClient();

// Versão do JobProcessingAdapter que apenas simula o processamento se SKIP_SAVING=true
class TestJobProcessingAdapter extends JobProcessingAdapter {
  async processRawJob(sourceType: string, rawJob: any, source: JobSource): Promise<boolean> {
    if (SKIP_SAVING) {
      // Apenas simular o processamento sem salvar
      logger.info({ 
        jobId: rawJob.id, 
        jobTitle: rawJob.title, 
        location: rawJob.location?.name,
        sourceType,
        sourceName: source.name,
      }, '💾 [SIMULAÇÃO] Job seria processado/salvo (SKIP_SAVING=true)');
      return true;
    } else {
      // Processar e salvar normalmente
      return super.processRawJob(sourceType, rawJob, source);
    }
  }
}

async function main() {
  logger.info('🚀 Iniciando teste do filtro do GreenhouseFetcher com logs detalhados...');
  
  try {
    // Configurar fetcher
    const testAdapter = new TestJobProcessingAdapter();
    const greenhouseFetcher = new GreenhouseFetcher(prisma, testAdapter);
    
    // Buscar fontes para testar
    let sourcesToTest: JobSource[] = [];
    
    if (TEST_ALL_SOURCES) {
      sourcesToTest = await prisma.jobSource.findMany({
        where: { 
          type: 'greenhouse',
          isEnabled: true
        }
      });
      logger.info(`🔍 Encontradas ${sourcesToTest.length} fontes ativas do tipo 'greenhouse'`);
    } else {
      sourcesToTest = await prisma.jobSource.findMany({
        where: { 
          type: 'greenhouse',
          name: { in: TARGET_SOURCES }
        }
      });
      logger.info(`🔍 Buscando fontes específicas: ${TARGET_SOURCES.join(', ')}`);
      logger.info(`✓ Encontradas ${sourcesToTest.length} fontes para testar`);
    }
    
    if (sourcesToTest.length === 0) {
      logger.error(`❌ Nenhuma fonte encontrada para testar. Verifique os nomes ou critérios.`);
      return;
    }
    
    // Testar cada fonte
    logger.info('----- INICIANDO TESTES DE FILTRO -----');
    
    for (const source of sourcesToTest) {
      logger.info(`\n\n========== TESTANDO FONTE: ${source.name} (ID: ${source.id}) ==========`);
      
      const result = await greenhouseFetcher.processSource(source, logger);
      
      logger.info({
        source: source.name,
        found: result.stats.found,
        relevant: result.stats.relevant,
        processed: result.stats.processed,
        errors: result.stats.errors
      }, `✅ Teste para ${source.name} concluído`);
    }
    
    logger.info('\n----- TESTES DE FILTRO CONCLUÍDOS -----');
    
    if (LOG_TO_FILE) {
      logger.info(`📝 Logs detalhados foram gravados em: ${logFilePath}`);
      console.log(`📝 Logs detalhados foram gravados em: ${logFilePath}`);
    }
    
  } catch (error) {
    logger.error(error, '❌ Erro durante o teste do filtro:');
  } finally {
    await prisma.$disconnect();
  }
}

// Executar script
main()
  .then(() => {
    console.log('Script concluído.');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Erro fatal:', e);
    process.exit(1);
  }); 