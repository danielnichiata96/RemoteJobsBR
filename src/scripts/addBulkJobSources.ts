/**
 * Script para adicionar múltiplas fontes de vagas (Greenhouse, Ashby, etc.) no banco de dados.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Defina tipos específicos para cada entrada
type GreenhouseSourceInput = { name: string; type: 'greenhouse'; boardToken: string; website: string; logoUrl?: string | null };
type AshbySourceInput = { name: string; type: 'ashby'; config: { jobBoardName: string }; companyWebsite: string; logoUrl?: string | null };

// Use um tipo de união
const sourcesToAddOrUpdate: (GreenhouseSourceInput | AshbySourceInput)[] = [
    // Exemplos Greenhouse (adapte se necessário)
    // { name: 'Company A', type: 'greenhouse', boardToken: 'companya', website: 'https://companya.com' },

    // Fontes Ashby
    {
        name: 'Omniscient',
        type: 'ashby',
        config: { jobBoardName: 'omniscient' },
        companyWebsite: 'https://www.omniscient.com/', // Website estimado
        logoUrl: null
    },
    {
        name: 'Zapier',
        type: 'ashby',
        config: { jobBoardName: 'zapier' },
        companyWebsite: 'https://zapier.com/',
        logoUrl: null
    },
    {
        name: 'Deel',
        type: 'ashby',
        config: { jobBoardName: 'deel' },
        companyWebsite: 'https://www.deel.com/',
        logoUrl: null
    },
];

async function main() {
    console.log(`🚀 Adicionando/Atualizando ${sourcesToAddOrUpdate.length} fontes de vagas...`);
    console.log('----------------------------------------------------');

    let addedCount = 0;
    let updatedCount = 0;

    try {
        for (const sourceInput of sourcesToAddOrUpdate) {
            let existingSource;

            // Encontra a fonte existente baseado no tipo
            if (sourceInput.type === 'greenhouse') {
                existingSource = await prisma.jobSource.findFirst({
                    where: {
                        type: 'greenhouse',
                        // A busca por JSON exato pode ser complexa, vamos usar o boardToken como chave única assumida para Greenhouse
                        config: { path: ['boardToken'], equals: sourceInput.boardToken }, 
                    },
                });
            } else if (sourceInput.type === 'ashby') {
                existingSource = await prisma.jobSource.findFirst({
                    where: {
                        type: 'ashby',
                        // Usar jobBoardName como chave única assumida para Ashby
                        config: { path: ['jobBoardName'], equals: sourceInput.config.jobBoardName }, 
                    },
                });
            } else {
                // Explicitly cast to any to access properties, or handle the 'never' case differently
                const unknownSource = sourceInput as any;
                console.warn(`⚠️ Tipo de fonte desconhecido: ${unknownSource?.type}. Pulando ${unknownSource?.name ?? '(nome indisponível)'}`);
                continue; // Pula tipos não reconhecidos
            }


            // Dados comuns para criar/atualizar
            // Ajuste para pegar a propriedade correta de website/config dependendo do tipo
            const commonData = {
                name: sourceInput.name,
                type: sourceInput.type,
                companyWebsite: sourceInput.type === 'greenhouse' ? sourceInput.website : sourceInput.companyWebsite,
                logoUrl: sourceInput.logoUrl,
                isEnabled: true,
                config: sourceInput.type === 'greenhouse' ? { boardToken: sourceInput.boardToken } : sourceInput.config,
            };

            if (existingSource) {
                // Atualizar se existente (apenas campos relevantes)
                await prisma.jobSource.update({
                    where: { id: existingSource.id },
                    data: {
                        name: commonData.name,
                        companyWebsite: commonData.companyWebsite,
                        logoUrl: commonData.logoUrl,
                        config: commonData.config, // Atualiza config caso jobBoardName/boardToken mude
                        isEnabled: true // Garante que está ativa
                    }
                });
                console.log(`🔄 Fonte "${sourceInput.name}" (${sourceInput.type}) atualizada.`);
                updatedCount++;
            } else {
                // Criar nova fonte
                await prisma.jobSource.create({
                    data: commonData,
                });
                console.log(`✅ Fonte "${sourceInput.name}" (${sourceInput.type}) adicionada.`);
                addedCount++;
            }
        }

        console.log('\n----------------------------------------------------');
        console.log(`🏁 Processo concluído!`);
        console.log(`   - Fontes adicionadas: ${addedCount}`);
        console.log(`   - Fontes atualizadas: ${updatedCount}`);
        console.log('\nPara importar vagas destas fontes, execute:');
        console.log('npm run fetch-jobs');

    } catch (error) {
        console.error('❌ Erro ao adicionar/atualizar fontes de vagas em massa:', error);
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