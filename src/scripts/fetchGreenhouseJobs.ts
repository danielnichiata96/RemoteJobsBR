const axios = require('axios');
const { prisma: db } = require('../lib/prisma');
const pMap = require('p-map');
const pino = require('pino');

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
      messageFormat: '{msg}',
      levelFirst: false
    }
  },
  base: undefined
});

interface GreenhouseJob {
  id: number;
  title: string;
  updated_at: string;
  location: {
    name: string;
  };
  content: string;
  absolute_url: string;
  metadata: Array<{
    id: number;
    name: string;
    value: string | string[];
  }>;
  departments: Array<{
    name: string;
  }>;
}

interface Company {
  name: string;
  boardToken: string;
}

const companies: Company[] = [
  { name: '10up', boardToken: '10up' },
  { name: 'Asana', boardToken: 'asana' },
  { name: 'Canonical', boardToken: 'canonical' },
  { name: 'CircleCI', boardToken: 'circleci' },
  { name: 'Cloudflare', boardToken: 'cloudflare' },
  { name: 'Coinbase', boardToken: 'coinbase' },
  { name: 'Datadog', boardToken: 'datadog' },
  { name: 'Discord', boardToken: 'discord' },
  { name: 'Dropbox', boardToken: 'dropbox' },
  { name: 'Elastic', boardToken: 'elastic' },
  { name: 'Figma', boardToken: 'figma' },
  { name: 'GitLab', boardToken: 'gitlab' },
  { name: 'Gusto', boardToken: 'gusto' },
  { name: 'HashiCorp', boardToken: 'hashicorp' },
  { name: 'Instacart', boardToken: 'instacart' },
  { name: 'Intercom', boardToken: 'intercom' },
  { name: 'MongoDB', boardToken: 'mongodb' },
  { name: 'Mozilla', boardToken: 'mozilla' },
  { name: 'Netlify', boardToken: 'netlify' },
  { name: 'New Relic', boardToken: 'newrelic' },
  { name: 'Notion', boardToken: 'notion' },
  { name: 'Okta', boardToken: 'okta' },
  { name: 'PagerDuty', boardToken: 'pagerduty' },
  { name: 'Reddit', boardToken: 'reddit' },
  { name: 'Remote.com', boardToken: 'remotecom' },
  { name: 'Robinhood', boardToken: 'robinhood' },
  { name: 'Snyk', boardToken: 'snyk' },
  { name: 'Squarespace', boardToken: 'squarespace' },
  { name: 'Stripe', boardToken: 'stripe' },
  { name: 'Twilio', boardToken: 'twilio' },
  { name: 'Twitch', boardToken: 'twitch' },
  { name: 'Wikimedia', boardToken: 'wikimedia' }
];

const BAD_KEYWORDS = [
  // Restrições dos EUA
  'us only',
  'united states only',
  'usa only',
  'remote (usa',
  'remote (us)',
  'remote usa',
  'remote us',
  'remote - usa',
  'remote - us',
  'usa remote',
  'us remote',

  // Restrições de timezone
  'europe timezone',
  'european timezone',
  'est timezone',
  'pst timezone',
  'gmt timezone',
  'cet timezone',
  'timezone overlap',
  'timezone requirement',
  'time zone overlap',
  'time zone requirement',
  
  // Restrições de localização
  'must reside in',
  'must be located in',
  'must be based in',
  'must live in',
  'must be eligible to work in',
  'must have work authorization in',
  'authorized to work in',
  'work authorization',
  'employment eligibility',
  
  // Restrições baseadas em região
  'us-based',
  'uk-based',
  'eu-based',
  'europe-based',
  'india-based',
  'based in the us',
  'based in the uk',
  'based in europe',
  'based in india',
  
  // Localizações específicas que indicam restrição
  'remote - india',
  'remote - united kingdom',
  'remote - singapore',
  'remote - canada',
  'remote - mexico',
  'remote, mexico',
  'mexico - remote',
  'india - remote',
  'canada - remote',
  'uk - remote',
  
  // Cidades/Estados específicos com remoto
  ', ca - remote',
  ', ny - remote',
  ', co - remote',
  ', ga - remote',
  'san francisco',
  'new york',
  'denver',
  'atlanta',
  
  // Outras restrições
  'north america',
  'north american',
  'domestic only',
  'local only',
  'onsite required',
  'hybrid'
];

const GOOD_KEYWORDS = [
  // Indicadores globais claros
  'worldwide',
  'global remote',
  'fully remote worldwide',
  'remote worldwide',
  'remote global',
  'work from anywhere',
  'anywhere in the world',
  'globally remote',
  
  // Indicadores específicos para América Latina
  'latin america',
  'latam',
  'south america',
  'americas',
  'brazil',
  'brasil',
  
  // Outros indicadores positivos
  'international',
  'remote-first',
  'fully distributed',
  'distributed team',
  'work from any location',
  'location agnostic'
];

const isRemoteJob = (job: GreenhouseJob): boolean => {
  const locationLower = job.location.name.toLowerCase();
  const descriptionLower = job.content?.toLowerCase() || '';
  const titleLower = job.title.toLowerCase();
  const fullText = `${locationLower} ${descriptionLower} ${titleLower}`;

  // Primeiro verifica se há palavras-chave ruins em qualquer lugar
  const hasRestrictiveRequirements = BAD_KEYWORDS.some(keyword => 
    fullText.includes(keyword.toLowerCase())
  );

  if (hasRestrictiveRequirements) {
    return false;
  }

  // Verifica se é uma localização específica com "remote"
  if (locationLower.includes('remote')) {
    // Se contém vírgula, pode ser uma localização específica (ex: "San Francisco, CA - Remote")
    if (locationLower.includes(',')) {
      return false;
    }
    
    // Se contém hífen, pode ser uma restrição de país/região (ex: "Remote - USA")
    if (locationLower.includes('-')) {
      return false;
    }
  }

  // Então verifica indicadores positivos
  const hasGoodKeyword = GOOD_KEYWORDS.some(keyword =>
    fullText.includes(keyword.toLowerCase())
  );

  // Se tem palavra-chave boa, aceita
  if (hasGoodKeyword) {
    return true;
  }

  // Se é só "Remote" sem qualificadores, verifica o conteúdo da vaga
  if (locationLower === 'remote') {
    // Procura por indicações de restrições no conteúdo
    const hasContentRestrictions = [
      'eligible to work in',
      'work authorization',
      'timezone requirement',
      'time zone requirement',
      'must be based',
      'must reside',
      'must be located'
    ].some(phrase => descriptionLower.includes(phrase));

    return !hasContentRestrictions;
  }

  return false;
};

async function processAndSaveJob(job: GreenhouseJob, jobDetails: any, company: Company) {
  // Extract skills from content
  const skills = new Set<string>();
  const content = jobDetails.content.toLowerCase();
  const commonSkills = ['javascript', 'python', 'java', 'react', 'node.js', 'typescript', 'aws', 'sql'];
  commonSkills.forEach(skill => {
    if (content.includes(skill.toLowerCase())) {
      skills.add(skill);
    }
  });

  // Create or update job in database
  await db.job.upsert({
    where: {
      id: `greenhouse_${job.id}`
    },
    update: {
      title: job.title,
      description: jobDetails.content,
      location: job.location.name,
      country: 'Worldwide',
      workplaceType: 'REMOTE',
      status: 'ACTIVE',
      company: {
        connectOrCreate: {
          where: {
            email: `${company.boardToken}@greenhouse.example.com`
          },
          create: {
            email: `${company.boardToken}@greenhouse.example.com`,
            name: company.name,
            role: 'COMPANY',
            isActive: true
          }
        }
      },
      skills: Array.from(skills),
      applicationUrl: job.absolute_url,
      updatedAt: new Date(job.updated_at),
      jobType: 'FULL_TIME',
      experienceLevel: 'MID',
      requirements: 'See job description',
      responsibilities: 'See job description'
    },
    create: {
      id: `greenhouse_${job.id}`,
      title: job.title,
      description: jobDetails.content,
      location: job.location.name,
      country: 'Worldwide',
      workplaceType: 'REMOTE',
      status: 'ACTIVE',
      company: {
        connectOrCreate: {
          where: {
            email: `${company.boardToken}@greenhouse.example.com`
          },
          create: {
            email: `${company.boardToken}@greenhouse.example.com`,
            name: company.name,
            role: 'COMPANY',
            isActive: true
          }
        }
      },
      skills: Array.from(skills),
      applicationUrl: job.absolute_url,
      jobType: 'FULL_TIME',
      experienceLevel: 'MID',
      requirements: 'See job description',
      responsibilities: 'See job description'
    }
  });
}

async function fetchAndProcessCompanyJobs(company: Company) {
  try {
    logger.info({ company: company.name }, '→ Iniciando busca');
    
    const response = await axios.get(
      `https://boards-api.greenhouse.io/v1/boards/${company.boardToken}/jobs`
    );

    const allJobs = response.data.jobs;
    const remoteJobs = allJobs.filter(isRemoteJob);
    
    logger.info(
      { 
        company: company.name, 
        totalJobs: allJobs.length, 
        remoteJobs: remoteJobs.length,
        acceptanceRate: `${((remoteJobs.length / allJobs.length) * 100).toFixed(1)}%`
      },
      '+ Vagas encontradas'
    );

    // Processamento paralelo de jobs (sem logs individuais)
    await pMap(
      remoteJobs,
      async (job: GreenhouseJob) => {
        try {
          const jobDetails = await axios.get(
            `https://boards-api.greenhouse.io/v1/boards/${company.boardToken}/jobs/${job.id}`
          );
          await processAndSaveJob(job, jobDetails.data, company);
        } catch (error: any) {
          logger.error(
            { company: company.name, jobId: job.id, error: error?.message || 'Unknown error' },
            '❌ Erro ao processar vaga'
          );
        }
      },
      {
        concurrency: 5,
        stopOnError: false
      }
    );

    logger.info(
      { 
        company: company.name, 
        processedJobs: remoteJobs.length,
        acceptanceRate: `${((remoteJobs.length / allJobs.length) * 100).toFixed(1)}%`
      },
      '✓ Processamento finalizado'
    );
  } catch (error: any) {
    logger.error(
      { company: company.name, error: error?.message || 'Unknown error' },
      'x Erro ao buscar vagas'
    );
  }
}

async function main() {
  logger.info('>> Iniciando busca de vagas no Greenhouse');
  
  const stats = {
    startTime: new Date(),
    companiesProcessed: 0,
    totalCompanies: companies.length,
    totalJobs: 0,
    totalRemoteJobs: 0
  };

  // Processamento paralelo de empresas
  await pMap(
    companies,
    async (company: Company) => {
      await fetchAndProcessCompanyJobs(company);
      stats.companiesProcessed++;
    },
    {
      concurrency: 3,
      stopOnError: false
    }
  );

  const endTime = new Date();
  const duration = (endTime.getTime() - stats.startTime.getTime()) / 1000;

  // Buscar estatísticas finais do banco
  const finalStats = await db.$transaction([
    db.job.count({
      where: {
        id: {
          startsWith: 'greenhouse_'
        }
      }
    }),
    db.user.count({
      where: {
        email: {
          endsWith: '@greenhouse.example.com'
        }
      }
    })
  ]);

  logger.info(
    { 
      companiesProcessed: stats.companiesProcessed,
      totalCompanies: stats.totalCompanies,
      totalJobsSaved: finalStats[0],
      totalCompaniesCreated: finalStats[1],
      durationSeconds: duration,
      durationMinutes: (duration / 60).toFixed(1)
    },
    '== Processo finalizado =='
  );
}

main()
  .catch((error) => {
    logger.error(error, 'Error in main process');
  })
  .finally(async () => {
    await db.$disconnect();
  }); 