/**
 * Script para adicionar múltiplas fontes de vagas do Greenhouse no banco de dados.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Lista de empresas para adicionar (Nome, Board Token, Website)
const companiesToAdd: { name: string; boardToken: string; website: string }[] = [
  { name: 'Stripe', boardToken: 'stripe', website: 'https://stripe.com' },
  { name: 'Automattic', boardToken: 'automattic', website: 'https://automattic.com' },
  { name: 'Buffer', boardToken: 'buffer', website: 'https://buffer.com' },
  { name: 'GitLab', boardToken: 'gitlab', website: 'https://gitlab.com' },
  { name: 'CircleCI', boardToken: 'circleci', website: 'https://circleci.com' },
  { name: 'Auth0', boardToken: 'auth0', website: 'https://auth0.com' },
  { name: 'Zapier', boardToken: 'zapier', website: 'https://zapier.com' },
  { name: 'Miro', boardToken: 'miro', website: 'https://miro.com' },
  { name: 'HubSpot', boardToken: 'hubspot', website: 'https://hubspot.com' },
  { name: 'Mozilla', boardToken: 'mozilla', website: 'https://mozilla.org' }, // .org
  { name: 'Wikimedia Foundation', boardToken: 'wikimedia', website: 'https://wikimediafoundation.org' }, // .org
  { name: 'DuckDuckGo', boardToken: 'duckduckgo', website: 'https://duckduckgo.com' },
  { name: 'Toptal', boardToken: 'toptal', website: 'https://toptal.com' },
  { name: 'Remote', boardToken: 'remotecom', website: 'https://remote.com' }, // Adjusted website
  { name: 'Deel', boardToken: 'deel', website: 'https://deel.com' },
  { name: 'Coinbase', boardToken: 'coinbase', website: 'https://coinbase.com' },
  { name: 'Twilio', boardToken: 'twilio', website: 'https://twilio.com' },
  { name: 'Dropbox', boardToken: 'dropbox', website: 'https://dropbox.com' },
  { name: 'Reddit', boardToken: 'reddit', website: 'https://reddit.com' },
  { name: 'HashiCorp', boardToken: 'hashicorp', website: 'https://hashicorp.com' },
  { name: 'Vercel', boardToken: 'vercel', website: 'https://vercel.com' },
  { name: 'Plaid', boardToken: 'plaid', website: 'https://plaid.com' },
  { name: 'Figma', boardToken: 'figma', website: 'https://figma.com' },
  { name: 'Affirm', boardToken: 'affirm', website: 'https://affirm.com' },
  { name: 'Cloudflare', boardToken: 'cloudflare', website: 'https://cloudflare.com' },
  { name: 'Datadog', boardToken: 'datadog', website: 'https://datadoghq.com' }, // Adjusted website
  { name: 'Elastic', boardToken: 'elastic', website: 'https://elastic.co' }, // .co
  { name: 'Grafana Labs', boardToken: 'grafanalabs', website: 'https://grafana.com' }, // Adjusted website
  { name: 'PlanetScale', boardToken: 'planetscale', website: 'https://planetscale.com' },
  { name: 'Revolut', boardToken: 'revolut', website: 'https://revolut.com' },
  { name: 'Wise', boardToken: 'transferwise', website: 'https://wise.com' }, // Adjusted website
  { name: '1Password', boardToken: '1password', website: 'https://1password.com' },
  { name: 'Articulate', boardToken: 'articulate', website: 'https://articulate.com' },
];

async function main() {
  console.log(`🚀 Adicionando/Atualizando ${companiesToAdd.length} fontes de vagas do Greenhouse...`);
  console.log('----------------------------------------------------');

  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  try {
    for (const company of companiesToAdd) {
      // Verificar se a fonte já existe (por token é mais confiável)
      const existingSource = await prisma.jobSource.findFirst({
        where: {
          config: { path: ['boardToken'], equals: company.boardToken },
          type: "greenhouse"
        },
      });

      if (existingSource) {
        // Atualizar se existente
        await prisma.jobSource.update({
          where: { id: existingSource.id },
          data: {
            name: company.name,
            companyWebsite: company.website,
            isEnabled: true // Garantir que está ativa
          }
        });
        console.log(`🔄 Fonte "${company.name}" atualizada com website.`);
        updatedCount++;
      } else {
        // Criar nova fonte
        await prisma.jobSource.create({
          data: {
            name: company.name,
            type: "greenhouse",
            companyWebsite: company.website,
            isEnabled: true,
            config: {
              boardToken: company.boardToken,
            },
          },
        });
        console.log(`✅ Fonte "${company.name}" (token: ${company.boardToken}, site: ${company.website}) adicionada.`);
        addedCount++;
      }
    }

    console.log('\n----------------------------------------------------');
    console.log(`🏁 Processo concluído!`);
    console.log(`   - Fontes adicionadas: ${addedCount}`);
    console.log(`   - Fontes atualizadas: ${updatedCount}`);
    console.log(`   - Fontes puladas (sem alteração): ${skippedCount}`); // Skipped não é mais usado aqui
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