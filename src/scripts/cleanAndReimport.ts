import { exec } from 'child_process';
import { promisify } from 'util';
import { PrismaClient } from '@prisma/client';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Iniciando limpeza e reimportação completa...');
  
  try {
    // 1. Limpar o banco de dados
    console.log('\n🚮 Limpando banco de dados...');
    console.log('Deletando todas as vagas do Greenhouse...');
    const deletedJobs = await prisma.job.deleteMany({
      where: {
        source: 'greenhouse'
      }
    });
    console.log(`✅ ${deletedJobs.count} vagas deletadas.`);
    
    console.log('Deletando todas as empresas do Greenhouse...');
    const deletedCompanies = await prisma.user.deleteMany({
      where: {
        email: {
          endsWith: '@greenhouse.example.com'
        }
      }
    });
    console.log(`✅ ${deletedCompanies.count} empresas deletadas.`);
    
    // 2. Atualizar as fontes no banco de dados
    console.log('\n📌 Atualizando fontes de vagas...');
    try {
      console.log('Executando script addBulkJobSources.ts...');
      const { stdout: addOutput } = await execAsync('npx ts-node src/scripts/addBulkJobSources.ts');
      console.log(addOutput);
    } catch (error) {
      console.error('❌ Erro ao adicionar empresas:', error);
    }
    
    // 3. Reimportar todas as vagas
    console.log('\n🔄 Reimportando vagas...');
    try {
      console.log('Executando script fetchJobSources.ts...');
      const { stdout: importOutput } = await execAsync('npx ts-node src/scripts/fetchJobSources.ts');
      console.log(importOutput);
    } catch (error) {
      console.error('❌ Erro ao importar vagas:', error);
    }
    
    // 4. Verificar o resultado
    console.log('\n📊 Verificando resultado da importação...');
    
    const activeJobs = await prisma.job.count({
      where: { status: 'ACTIVE' }
    });
    
    const jobsByCompany = await prisma.job.groupBy({
      by: ['companyId'],
      where: { status: 'ACTIVE' },
      _count: { _all: true }
    });
    
    const companyIds = jobsByCompany.map(item => item.companyId);
    const companies = await prisma.user.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, name: true }
    });
    
    const companyMap = new Map(companies.map(c => [c.id, c.name]));
    
    console.log(`\n✅ Total de vagas ativas: ${activeJobs}`);
    console.log(`✅ Total de empresas com vagas: ${jobsByCompany.length}`);
    
    jobsByCompany.forEach(item => {
      console.log(`- ${companyMap.get(item.companyId) || item.companyId}: ${item._count._all} vagas`);
    });
    
    console.log('\n🎉 Processo de limpeza e reimportação concluído!');
    
  } catch (error) {
    console.error('❌ Erro durante o processo:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 