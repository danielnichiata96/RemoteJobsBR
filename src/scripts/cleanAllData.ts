/**
 * Script para limpar todas as fontes de vagas e jobs do banco de dados.
 * Este script remove todas as vagas e fontes de vagas, sem remover outros dados do sistema.
 * !!! ADICIONADO PROMPT DE CONFIRMAÇÃO PARA SEGURANÇA !!!
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Iniciando limpeza completa de dados de vagas...');
  console.log('⚠️ ESTE SCRIPT IRÁ REMOVER TODOS OS JOBS, JOBSOURCES, E EMPRESAS PLACEHOLDER.');
  console.log('   Outros dados (usuários, etc.) NÃO serão afetados.');
  console.log('\nTem certeza que deseja continuar? (y/n)');

  // Obter confirmação do usuário
  const response = await new Promise(resolve => {
    process.stdin.once('data', data => {
      resolve(data.toString().trim().toLowerCase());
    });
  });

  if (response !== 'y') {
    console.log('❌ Operação cancelada pelo usuário.');
    return;
  }

  console.log('\n🚀 Prosseguindo com a limpeza...');
  
  try {
    // 1. Limpar todas as vagas
    console.log('\n🚮 Removendo todas as vagas...');
    const deletedJobs = await prisma.job.deleteMany({});
    console.log(`✅ ${deletedJobs.count} vagas removidas do banco de dados.`);
    
    // 2. Limpar todas as fontes de vagas (JobSources)
    console.log('\n🚮 Removendo todas as fontes de vagas...');
    const deletedJobSources = await prisma.jobSource.deleteMany({});
    console.log(`✅ ${deletedJobSources.count} fontes de vagas removidas do banco de dados.`);
    
    // 3. Remover usuários do tipo empresa criados automaticamente (opcional)
    console.log('\n🚮 Removendo empresas placeholder (com email @greenhouse.example.com)...');
    // Ajuste para remover usuários com role COMPANY que não sejam admins ou candidatos.
    // Assume-se que usuários COMPANY sem email @greenhouse.example.com são legítimos.
    const deletedPlaceholderCompanies = await prisma.user.deleteMany({
      where: {
        role: 'COMPANY',
        email: {
          endsWith: '@greenhouse.example.com' // Targeting only the placeholder emails
        }
      }
    });
    console.log(`✅ ${deletedPlaceholderCompanies.count} empresas placeholder removidas do banco de dados.`);
    
    console.log('\n----------------------------------------------------');
    console.log('🎉 Limpeza completa realizada com sucesso!');
    console.log('\nPara adicionar novas fontes de vagas, execute:');
    console.log('npx ts-node src/scripts/addBulkJobSources.ts');
    console.log('\nPara buscar vagas, execute:');
    console.log('npm run fetch-jobs');
    
  } catch (error) {
    console.error('❌ Erro durante o processo de limpeza:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o script
main()
  .catch((error) => {
    console.error('Erro fatal:', error);
    process.exit(1);
  }); 