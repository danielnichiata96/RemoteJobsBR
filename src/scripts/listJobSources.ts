/**
 * Script para listar fontes de vagas cadastradas no banco de dados
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Listando fontes de vagas cadastradas:');
  console.log('---------------------------------------');

  try {
    // Buscar todas as fontes ordenadas por isEnabled (ativas primeiro) e nome
    const sources = await prisma.jobSource.findMany({
      orderBy: [
        { isEnabled: 'desc' },
        { name: 'asc' }
      ]
    });

    if (sources.length === 0) {
      console.log('⚠️ Nenhuma fonte de vagas cadastrada.');
      console.log('\nPara adicionar uma fonte de vagas, execute:');
      console.log('npx ts-node src/scripts/addJobSource.ts');
      return;
    }

    // Mostrar totais
    const activeSources = sources.filter(source => source.isEnabled);
    console.log(`Total: ${sources.length} fontes (${activeSources.length} ativas)`);
    console.log('');

    // Mostrar detalhes de cada fonte
    sources.forEach((source, index) => {
      console.log(`[${index + 1}] ${source.name} (${source.type})`);
      console.log(`   ID: ${source.id}`);
      console.log(`   Status: ${source.isEnabled ? '✅ Ativa' : '❌ Inativa'}`);
      
      // Mostrar config se for Greenhouse
      if (source.type === 'greenhouse') {
        // Assumindo que config é um objeto JSON com boardToken
        const config = source.config as any;
        console.log(`   Board Token: ${config?.boardToken || 'N/A'}`);
      }
      
      console.log('');
    });

    console.log('Para importar vagas destas fontes, execute:');
    console.log('npm run fetch-jobs');
    
  } catch (error) {
    console.error('❌ Erro ao listar fontes de vagas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o script
main()
  .catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
  }); 