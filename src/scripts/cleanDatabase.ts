const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDatabase() {
  console.log('Cleaning database...');
  
  try {
    // Primeiro deletar as vagas pois elas têm referência para companies
    const deletedJobs = await prisma.job.deleteMany({
      where: {
        source: 'greenhouse'
      }
    });
    console.log(`✓ ${deletedJobs.count} vagas do Greenhouse deletadas`);

    // Depois deletar as companies criadas pelo script
    const deletedCompanies = await prisma.user.deleteMany({
      where: {
        email: {
          endsWith: '@greenhouse.example.com'
        }
      }
    });
    console.log(`✓ ${deletedCompanies.count} empresas do Greenhouse deletadas`);

    console.log('Database cleaned successfully!');
  } catch (error) {
    console.error('Error cleaning database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDatabase(); 