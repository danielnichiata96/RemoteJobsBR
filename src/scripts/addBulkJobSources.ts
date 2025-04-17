/**
 * Script para adicionar múltiplas fontes de vagas (Greenhouse, Ashby, etc.) no banco de dados.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Defina tipos específicos para cada entrada
type GreenhouseSourceInput = { name: string; type: 'greenhouse'; boardToken: string; website?: string | null; logoUrl?: string | null };
// type AshbySourceInput = { name: string; type: 'ashby'; config: { jobBoardName: string }; companyWebsite?: string | null; logoUrl?: string | null };
type LeverSourceInput = { name: string; type: 'lever'; companyIdentifier: string; website?: string | null; logoUrl?: string | null };

// Use um tipo de união
const sourcesToAddOrUpdate: (GreenhouseSourceInput | LeverSourceInput)[] = [
    // // --- Ashby Sources ---
    // {
    //     name: 'Zapier',
    //     type: 'ashby',
    //     config: { jobBoardName: 'zapier' },
    //     companyWebsite: 'https://zapier.com/',
    //     logoUrl: null
    // },
    // --- Greenhouse Sources ---
    { name: 'Affirm', type: 'greenhouse', boardToken: 'affirm' },
    { name: 'Auth0', type: 'greenhouse', boardToken: 'auth0' },
    { name: 'Automattic', type: 'greenhouse', boardToken: 'automattic' },
    { name: 'Brave', type: 'greenhouse', boardToken: 'brave' },
    { name: 'Buffer', type: 'greenhouse', boardToken: 'buffer' },
    { name: 'Canonical', type: 'greenhouse', boardToken: 'canonical' },
    { name: 'CircleCI', type: 'greenhouse', boardToken: 'circleci' },
    { name: 'Cloudflare', type: 'greenhouse', boardToken: 'cloudflare' },
    { name: 'Coinbase', type: 'greenhouse', boardToken: 'coinbase' },
    { name: 'Datadog', type: 'greenhouse', boardToken: 'datadog' },
    { name: 'Dropbox', type: 'greenhouse', boardToken: 'dropbox' },
    { name: 'DuckDuckGo', type: 'greenhouse', boardToken: 'duckduckgo' },
    { name: 'Elastic', type: 'greenhouse', boardToken: 'elastic' },
    { name: 'Figma', type: 'greenhouse', boardToken: 'figma' },
    { name: 'GitLab', type: 'greenhouse', boardToken: 'gitlab' },
    { name: 'Grafana Labs', type: 'greenhouse', boardToken: 'grafanalabs' },
    { name: 'HashiCorp', type: 'greenhouse', boardToken: 'hashicorp' },
    { name: 'HubSpot', type: 'greenhouse', boardToken: 'hubspot' },
    { name: 'Mozilla', type: 'greenhouse', boardToken: 'mozilla' },
    { name: 'Reddit', type: 'greenhouse', boardToken: 'reddit' },
    { name: 'Remote', type: 'greenhouse', boardToken: 'remotecom' },
    { name: 'Stripe', type: 'greenhouse', boardToken: 'stripe' },
    { name: 'Twilio', type: 'greenhouse', boardToken: 'twilio' },
    { name: 'Valtech', type: 'greenhouse', boardToken: 'valtechgreenhouse' },
    { name: 'Vercel', type: 'greenhouse', boardToken: 'vercel' },
    { name: 'Wikimedia Foundation', type: 'greenhouse', boardToken: 'wikimedia' },

    // --- Lever Sources ---
    { name: 'Superside', type: 'lever', companyIdentifier: 'superside', website: 'https://superside.com/' },
    { name: 'Black & White Zebra', type: 'lever', companyIdentifier: 'Black-White-Zebra', website: 'https://www.blackandwhitezebra.com/' },
    { name: 'Remofirst', type: 'lever', companyIdentifier: 'remofirst', website: 'https://www.remofirst.com/' },
    { name: 'Blue Coding', type: 'lever', companyIdentifier: 'bluecoding', website: 'https://www.bluecoding.com/' },
    { name: 'Anagram', type: 'lever', companyIdentifier: 'anagram', website: 'https://anagram.care/' }, 
];

async function main() {
    console.log(`🚀 Adicionando/Atualizando ${sourcesToAddOrUpdate.length} fontes de vagas...`);
    console.log('----------------------------------------------------');

    let addedCount = 0;
    let updatedCount = 0;

    try {
        for (const sourceInput of sourcesToAddOrUpdate) {
            let existingSource;
            let sourceConfig: any;

            // Encontra a fonte existente baseado no tipo e prepara a config
            if (sourceInput.type === 'greenhouse') {
                sourceConfig = { boardToken: sourceInput.boardToken };
                existingSource = await prisma.jobSource.findFirst({
                    where: {
                        type: 'greenhouse',
                        config: { path: ['boardToken'], equals: sourceInput.boardToken }, // Correct way to query JSON
                    },
                });
                // Fallback check by name if config doesn't match (e.g., during transition)
                if (!existingSource) {
                    existingSource = await prisma.jobSource.findUnique({
                        where: { name_type: { name: sourceInput.name, type: sourceInput.type } },
                    });
                }
            } else if (sourceInput.type === 'lever') {
                sourceConfig = { companyIdentifier: sourceInput.companyIdentifier };
                existingSource = await prisma.jobSource.findFirst({
                    where: {
                        type: 'lever',
                        config: { path: ['companyIdentifier'], equals: sourceInput.companyIdentifier }, // Correct way to query JSON
                    },
                });
                 // Fallback check by name
                if (!existingSource) {
                    existingSource = await prisma.jobSource.findUnique({
                        where: { name_type: { name: sourceInput.name, type: sourceInput.type } },
                    });
                }
            } 
             else {
                const unknownSource = sourceInput as any;
                console.warn(`⚠️ Tipo de fonte desconhecido: ${unknownSource?.type}. Pulando ${unknownSource?.name ?? '(nome indisponível)'}`);
                continue;
            }


            // Dados comuns para criar/atualizar
            const commonData = {
                name: sourceInput.name,
                type: sourceInput.type,
                // Use optional chaining and nullish coalescing for website/logo
                companyWebsite: sourceInput.website ?? null,
                logoUrl: sourceInput.logoUrl ?? null,
                isEnabled: true,
                config: sourceConfig, // Use the prepared config
            };

            if (existingSource) {
                await prisma.jobSource.update({
                    where: { id: existingSource.id },
                    data: {
                        name: commonData.name,
                        companyWebsite: commonData.companyWebsite,
                        logoUrl: commonData.logoUrl,
                        config: commonData.config, 
                        isEnabled: true 
                    }
                });
                console.log(`🔄 Fonte "${sourceInput.name}" (${sourceInput.type}) atualizada.`);
                updatedCount++;
            } else {
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