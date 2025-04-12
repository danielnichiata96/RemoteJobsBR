/**
 * Script para remover fontes de vagas específicas e seus jobs associados do banco de dados.
 */

import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

// Lista de board tokens das empresas para remover
const tokensToRemove = [
  'deel',
];

async function main() {
  console.log(`🚀 Removendo ${tokensToRemove.length} fontes de vagas específicas e seus jobs...`);
  console.log('----------------------------------------------------');

  let sourcesRemovedCount = 0;
  let jobsRemovedCount = 0;
  let sourcesNotFoundCount = 0;
  let usersNotFoundCount = 0;
  let errorCount = 0;

  try {
    for (const boardToken of tokensToRemove) {
      try {
        // 1. Encontrar a JobSource pelo boardToken
        const source = await prisma.jobSource.findFirst({
          where: {
            config: { path: ['boardToken'], equals: boardToken },
            type: "greenhouse"
          },
          select: {
            id: true,
            name: true // Precisamos do nome para encontrar o User (Company)
          }
        });

        if (!source) {
          console.log(`⚠️ Fonte com token "${boardToken}" não encontrada.`);
          sourcesNotFoundCount++;
          continue; // Pular para o próximo token
        }

        console.log(`🔍 Encontrada fonte "${source.name}" (token: ${boardToken}, id: ${source.id}). Buscando empresa correspondente...`);

        // 2. Encontrar o User (Company) associado pelo nome
        // Isso assume que o nome da JobSource corresponde ao nome do User com role COMPANY
        const companyUser = await prisma.user.findFirst({
          where: {
            name: source.name,
            role: UserRole.COMPANY
          },
          select: { id: true }
        });

        let deletedJobsCount = 0;
        if (companyUser) {
          console.log(`   ↳ Empresa encontrada (ID: ${companyUser.id}). Removendo jobs associados...`);
          // 3. Remover Jobs associados a esta empresa e fonte
          const deleteJobsResult = await prisma.job.deleteMany({
            where: {
              companyId: companyUser.id,
              source: "greenhouse" // Garantir que estamos removendo apenas jobs desta fonte
            }
          });
          deletedJobsCount = deleteJobsResult.count;
          jobsRemovedCount += deletedJobsCount;
          console.log(`   ↳ ✅ ${deletedJobsCount} vagas associadas removidas.`);
        } else {
          console.log(`   ↳ ⚠️ Empresa "${source.name}" (User com role COMPANY) não encontrada. Não foi possível remover jobs por companyId.`);
          usersNotFoundCount++;
          // Poderíamos tentar remover jobs por sourceId se soubéssemos o padrão,
          // mas é mais seguro remover pela companyId quando possível.
        }

        // 4. Remover a JobSource
        await prisma.jobSource.delete({
          where: { id: source.id }
        });
        sourcesRemovedCount++;
        console.log(`🗑️ Fonte "${source.name}" (token: ${boardToken}) removida com sucesso.`);

      } catch (error) {
        console.error(`❌ Erro ao processar fonte com token "${boardToken}":`, error);
        errorCount++;
      }
    }

    console.log('\n----------------------------------------------------');
    console.log(`🏁 Processo de remoção concluído!`);
    console.log(`   - Fontes removidas: ${sourcesRemovedCount}`);
    console.log(`   - Vagas removidas: ${jobsRemovedCount}`);
    console.log(`   - Fontes não encontradas: ${sourcesNotFoundCount}`);
    console.log(`   - Empresas (User) não encontradas: ${usersNotFoundCount}`);
    console.log(`   - Erros: ${errorCount}`);

  } catch (error) {
    console.error('❌ Erro fatal durante a remoção:', error);
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