import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

async function importAllCompanies() {
  try {
    console.log('Iniciando importação de todas as empresas...');
    
    // Buscar todas as fontes ativas
    const sources = await prisma.jobSource.findMany({
      where: { 
        type: 'greenhouse',
        isEnabled: true
      }
    });
    
    console.log(`Encontradas ${sources.length} fontes ativas para importação.`);
    
    // Executar o script de importação
    const { stdout, stderr } = await execAsync('npx ts-node src/scripts/fetchGreenhouseJobs.ts --verbose');
    
    console.log('Saída do script de importação:');
    console.log(stdout);
    
    if (stderr) {
      console.error('Erros durante a importação:');
      console.error(stderr);
    }
    
    console.log('Importação concluída!');
    
  } catch (error) {
    console.error('Erro ao executar importação:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o script
importAllCompanies(); 