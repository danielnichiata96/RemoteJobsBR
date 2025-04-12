const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Script para DELETAR empresas com falha na API do Greenhouse
 * Executar: node scripts/delete-failed-companies.js
 * ATENÇÃO: Este script faz DELETE permanente dos dados!
 */

async function deleteFailedCompanies() {
  console.log('⚠️ ATENÇÃO: Este script irá DELETAR permanentemente as empresas com falha na API do Greenhouse!');
  console.log('🚀 Iniciando exclusão de empresas com falha na API do Greenhouse...');
  
  // Lista de empresas com falha (as que retornaram 404 ou outros erros)
  const failedCompanies = [
    // Lista original
    { id: 'cm909fab9000012qeuoc6sl86', name: 'Automattic' },
    { id: 'cm909fabf000112qeyjoldzeb', name: 'Buffer' },
    { id: 'cm909fabv000412qecuctjij4', name: 'Auth0' },
    { id: 'cm909fac0000512qeqsk4ojgu', name: 'Zapier' },
    { id: 'cm909fac4000612qeg3zjohr3', name: 'Miro' },
    { id: 'cm909facl000a12qe2cvttu6r', name: 'DuckDuckGo' },
    { id: 'cm909facp000b12qeqmmn05ae', name: 'Toptal' },
    { id: 'cm909facy000d12qebubaguuo', name: 'Deel' },
    { id: 'cm909fadr000k12qe5ez4wr2h', name: 'Plaid' },
    { id: 'cm909faeh000r12qehi66e5vr', name: 'PlanetScale' },
    { id: 'cm909faet000u12qegx5ahlnt', name: '1Password' },
    { id: 'cm909faek000s12qecpsucbnl', name: 'Revolut' },
    { id: 'cm909faeq000t12qezynqtua6', name: 'Wise' },
    { id: 'cm909faex000v12qevv0v4vrw', name: 'Articulate' },
    
    // Adicionar fontes que falharam nos testes recentes
    // Nota: Os IDs precisam ser substituídos pelos corretos do seu banco de dados
    // Use o comando de busca para encontrar os IDs corretos:
    // SELECT * FROM "JobSource" WHERE name IN ('Miro', 'Toptal', 'Plaid', 'Revolut', 'Wise', '1Password', 'Articulate');
    { id: 'cm9epcl4h000136wunvkzad8h', name: 'Miro' },
    { id: 'cm9epcl4v000436wubzy8jcs4', name: 'Toptal' },
    { id: 'cm9epcl5d000836wut5gust15', name: 'Plaid' },
    { id: 'cm9epcl5x000d36wu7vhipmt5', name: 'Revolut' },
    { id: 'cm9epcl60000e36wuvi1tz975', name: 'Wise' },
    { id: 'cm9epcl64000f36wun5v3wt06', name: '1Password' },
    { id: 'cm9epcl69000g36wuqgaujydf', name: 'Articulate' },
    { id: 'cm9epcl5u000c36wu62a2ihb9', name: 'PlanetScale' }
  ];
  
  // Remover duplicatas baseadas no nome da empresa
  const uniqueCompanies = Array.from(
    new Map(failedCompanies.map(company => [company.name, company])).values()
  );
  
  // IDs para exclusão
  const companyIds = uniqueCompanies.map(company => company.id);
  const companyNames = uniqueCompanies.map(company => company.name);
  
  // Stats para o relatório
  const stats = {
    deletedJobs: 0,
    deletedJobSources: 0
  };
  
  try {
    // 1. Obter IDs das empresas correspondentes na tabela User
    const companies = await prisma.user.findMany({
      where: {
        name: { in: companyNames },
        role: 'COMPANY'
      },
      select: { id: true, name: true }
    });
    
    const companyUserIds = companies.map(company => company.id);
    console.log(`ℹ️ Encontradas ${companies.length} empresas correspondentes.`);
    
    // 2. Deletar as vagas dessas empresas primeiro
    if (companyUserIds.length > 0) {
      // Registrar contagem antes de deletar
      const jobCount = await prisma.job.count({
        where: {
          source: 'greenhouse',
          companyId: { in: companyUserIds }
        }
      });
      
      // Deletar todas as vagas
      const deleteJobsResult = await prisma.job.deleteMany({
        where: {
          source: 'greenhouse',
          companyId: { in: companyUserIds }
        }
      });
      
      stats.deletedJobs = deleteJobsResult.count;
      console.log(`🗑️ Deletadas ${deleteJobsResult.count} vagas (esperado: ${jobCount}).`);
    }
    
    // 3. Deletar os JobSources
    const deleteJobSourceResult = await prisma.jobSource.deleteMany({
      where: {
        id: { in: companyIds }
      }
    });
    
    stats.deletedJobSources = deleteJobSourceResult.count;
    console.log(`🗑️ Deletadas ${deleteJobSourceResult.count} fontes de trabalho.`);
    
    // Mostrar relatório resumido
    console.log('\n📊 RELATÓRIO DE EXCLUSÃO:');
    console.log('--------------------------------------------');
    console.log(`Total de fontes processadas: ${uniqueCompanies.length}`);
    console.log(`Fontes deletadas: ${stats.deletedJobSources}`);
    console.log(`Vagas deletadas: ${stats.deletedJobs}`);
    
    // Listar as empresas excluídas
    console.log('\nEmpresas excluídas do sistema:');
    uniqueCompanies.forEach((company, index) => {
      const matchedUser = companies.find(c => c.name === company.name);
      console.log(`${index + 1}. ${company.name} (ID: ${company.id})`);
      if (!matchedUser) {
        console.log(`   ⚠️ Aviso: Usuário correspondente não encontrado no banco de dados.`);
      }
    });
    
    console.log('\n✅ Processo de exclusão concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao excluir empresas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o script com confirmação
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('⚠️⚠️⚠️ ATENÇÃO: OPERAÇÃO DESTRUTIVA ⚠️⚠️⚠️');
console.log('Este script irá DELETAR PERMANENTEMENTE as empresas com falha e todas as suas vagas.');
rl.question('Digite "DELETAR" para confirmar a exclusão: ', (answer) => {
  if (answer === 'DELETAR') {
    console.log('Confirmação recebida. Iniciando processo de exclusão...');
    deleteFailedCompanies()
      .catch(e => {
        console.error('❌ Erro fatal:', e);
        process.exit(1);
      })
      .finally(() => rl.close());
  } else {
    console.log('Operação cancelada. Nenhum dado foi excluído.');
    rl.close();
  }
}); 