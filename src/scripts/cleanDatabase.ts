const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDatabase() {
  console.log('Cleaning database...');
  
  try {
    // Primeiro deletar as vagas pois elas têm referência para companies
    await prisma.job.deleteMany({
      where: {
        id: {
          startsWith: 'greenhouse_'
        }
      }
    });
    console.log('✓ Jobs deleted');

    // Depois deletar as companies criadas pelo script
    await prisma.user.deleteMany({
      where: {
        email: {
          endsWith: '@greenhouse.example.com'
        }
      }
    });
    console.log('✓ Companies deleted');

    console.log('Database cleaned successfully!');
  } catch (error) {
    console.error('Error cleaning database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDatabase(); 