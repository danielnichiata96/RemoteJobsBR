const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Verificando fontes de emprego (JobSources) no banco de dados...');
  
  try {
    // Buscar todas as fontes
    const allSources = await prisma.jobSource.findMany({
      orderBy: { name: 'asc' }
    });
    
    console.log(`Total de fontes: ${allSources.length}`);
    
    // Fontes ativas vs. inativas
    const enabledSources = allSources.filter(s => s.isEnabled);
    console.log(`Fontes ativas: ${enabledSources.length}`);
    console.log(`Fontes inativas: ${allSources.length - enabledSources.length}`);
    
    // Listar todas as fontes
    console.log('\nLista de fontes:');
    allSources.forEach(source => {
      const status = source.isEnabled ? '✅ ATIVA' : '❌ INATIVA';
      const lastFetched = source.lastFetched 
        ? new Date(source.lastFetched).toLocaleString() 
        : 'Nunca importada';
      const boardToken = source.config?.boardToken || 'N/A';
      
      console.log(`- ${source.name} (${status}) - Token: ${boardToken} - Última importação: ${lastFetched}`);
    });
    
    // Verificar vagas ativas por empresa
    console.log('\nVerificando vagas ativas no banco de dados...');
    
    const activeJobsByCompany = await prisma.job.groupBy({
      by: ['companyId'],
      where: { status: 'ACTIVE' },
      _count: { _all: true }
    });
    
    if (activeJobsByCompany.length === 0) {
      console.log('Não existem vagas ativas no banco de dados.');
    } else {
      // Buscar detalhes das empresas
      const companyIds = activeJobsByCompany.map(item => item.companyId);
      const companies = await prisma.user.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, name: true, role: true }
      });
      
      const companyMap = new Map(companies.map(c => [c.id, c]));
      
      console.log(`\nTotal de empresas com vagas ativas: ${activeJobsByCompany.length}`);
      activeJobsByCompany.forEach(item => {
        const company = companyMap.get(item.companyId);
        console.log(`- ${company?.name || item.companyId}: ${item._count._all} vagas ativas`);
      });
    }
    
    // Verificar status das importações
    console.log('\nContagem de vagas por status:');
    const jobsByStatus = await prisma.job.groupBy({
      by: ['status'],
      _count: { _all: true }
    });
    
    jobsByStatus.forEach(item => {
      console.log(`- ${item.status}: ${item._count._all} vagas`);
    });
    
  } catch (error) {
    console.error('Erro ao verificar fontes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 