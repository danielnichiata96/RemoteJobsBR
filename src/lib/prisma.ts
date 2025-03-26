const { PrismaClient } = require('@prisma/client');

// Use a simple variable to maintain a single instance
let prismaInstance;

function getPrismaInstance() {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return prismaInstance;
}

// Export the prisma instance
const prisma = getPrismaInstance();

module.exports = { prisma }; 