import { useState, useEffect } from 'react';
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import Head from 'next/head';
import Layout from '@/components/common/Layout';
import JobCard from '@/components/jobs/JobCard';
import SearchBar from '@/components/jobs/SearchBar';
import SimpleFilter from '@/components/jobs/SimpleFilter';
import { Job, JobType, ExperienceLevel } from '@/types/job';
import { prisma } from '@/lib/prisma';

// Dados de exemplo para a página inicial até termos integração com o backend
const MOCK_JOBS_DATA = [
  {
    id: '1',
    title: 'Desenvolvedor Frontend React',
    company: 'TechInova',
    companyLogo: 'https://via.placeholder.com/150',
    location: 'São Paulo (Remoto)',
    description: 'Estamos procurando um desenvolvedor frontend React experiente para trabalhar em projetos inovadores.',
    jobType: 'full-time',
    experienceLevel: 'mid-level',
    tags: ['React', 'TypeScript', 'Redux', 'CSS', 'Figma'],
    salary: 'R$ 8.000 - R$ 12.000',
    createdAt: '2025-02-15T10:00:00Z',
    applicationUrl: '/jobs/1',
    industry: 'tech',
    regionType: 'brazil'
  },
  {
    id: '2',
    title: 'UX/UI Designer para Projeto Internacional',
    company: 'GlobalFin',
    companyLogo: 'https://via.placeholder.com/150',
    location: 'Remoto (EUA)',
    description: 'Empresa dos EUA busca UX/UI Designer para trabalhar em projeto de fintech.',
    jobType: 'full-time',
    experienceLevel: 'senior-level',
    tags: ['Figma', 'UI Design', 'UX Research', 'Design Thinking', 'Adobe XD'],
    salary: 'US$ 6.000 - US$ 9.000',
    createdAt: '2025-03-01T10:00:00Z',
    applicationUrl: '/jobs/2',
    industry: 'finance',
    regionType: 'worldwide'
  },
  {
    id: '3',
    title: 'Desenvolvedor Backend Node.js',
    company: 'EuroTechDev',
    companyLogo: 'https://via.placeholder.com/150',
    location: 'Remoto (Alemanha)',
    description: 'Empresa europeia procura desenvolvedor Node.js para construir e manter APIs REST e microsserviços.',
    jobType: 'full-time',
    experienceLevel: 'mid-level',
    tags: ['Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'AWS'],
    salary: '€ 5.000 - € 7.000',
    createdAt: '2025-03-10T10:00:00Z',
    applicationUrl: '/jobs/3',
    industry: 'tech',
    regionType: 'worldwide'
  },
  {
    id: '4',
    title: 'Product Manager em Edtech',
    company: 'EdLearn',
    companyLogo: 'https://via.placeholder.com/150',
    location: 'Remoto (Argentina)',
    description: 'Buscamos Product Manager para liderar o desenvolvimento de produtos educacionais digitais.',
    jobType: 'full-time',
    experienceLevel: 'senior-level',
    tags: ['Agile', 'Product Management', 'Edtech', 'Scrum', 'Data Analysis'],
    salary: 'US$ 4.000 - US$ 6.500',
    createdAt: '2025-03-05T10:00:00Z',
    applicationUrl: '/jobs/4',
    industry: 'education',
    regionType: 'latam'
  },
  {
    id: '5',
    title: 'Desenvolvedor Mobile React Native',
    company: 'HealthApp',
    companyLogo: 'https://via.placeholder.com/150',
    location: 'Remoto (Brasil)',
    description: 'Procuramos desenvolvedor React Native para aplicativo de saúde em expansão internacional.',
    jobType: 'contract',
    experienceLevel: 'mid-level',
    tags: ['React Native', 'Mobile', 'JavaScript', 'Redux', 'App Development'],
    salary: 'R$ 7.000 - R$ 10.000',
    createdAt: '2025-03-12T10:00:00Z',
    applicationUrl: '/jobs/5',
    industry: 'healthcare',
    regionType: 'brazil'
  }
];

interface HomeProps {
  initialJobs: Job[];
}

export default function Home({ initialJobs }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    jobTypes: [] as string[],
    experienceLevels: [] as string[],
    industries: [] as string[],
    locations: [] as string[]
  });
  const [isLoading, setIsLoading] = useState(false);

  // Simula a busca de dados - em produção seria uma chamada de API real
  useEffect(() => {
    const fetchJobs = () => {
      setIsLoading(true);
      
      // Simulando uma chamada de API com setTimeout
      setTimeout(() => {
        let filteredJobs = [...initialJobs];
        
        // Filtragem por termo de busca
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          filteredJobs = filteredJobs.filter(job => 
            job.title.toLowerCase().includes(term) || 
            job.company.toLowerCase().includes(term) || 
            job.description.toLowerCase().includes(term) ||
            job.tags.some(tag => tag.toLowerCase().includes(term))
          );
        }
        
        // Filtragem por tipo de contrato
        if (filters.jobTypes.length > 0) {
          filteredJobs = filteredJobs.filter(job => 
            filters.jobTypes.includes(job.jobType)
          );
        }
        
        // Filtragem por nível de experiência
        if (filters.experienceLevels.length > 0) {
          filteredJobs = filteredJobs.filter(job => 
            filters.experienceLevels.includes(job.experienceLevel)
          );
        }
        
        // Filtragem por indústria/área
        if (filters.industries.length > 0) {
          filteredJobs = filteredJobs.filter(job => 
            job.industry && filters.industries.includes(job.industry)
          );
        }
        
        // Filtragem por localização/região
        if (filters.locations.length > 0) {
          filteredJobs = filteredJobs.filter(job => 
            job.regionType && filters.locations.includes(job.regionType)
          );
        }
        
        setJobs(filteredJobs);
        setIsLoading(false);
      }, 300); // Pequeno atraso para simular a chamada de API
    };
    
    fetchJobs();
  }, [searchTerm, filters, initialJobs]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const handleFilterChange = (newFilters: {
    jobTypes: string[];
    experienceLevels: string[];
    industries: string[];
    locations: string[];
  }) => {
    setFilters(newFilters);
  };

  return (
    <Layout>
      <Head>
        <title>RemoteJobsBR - Vagas Remotas Internacionais</title>
        <meta name="description" content="Encontre vagas remotas em empresas internacionais para profissionais brasileiros" />
      </Head>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Vagas Remotas Internacionais
          </h1>
          <p className="text-gray-600">
            Oportunidades em empresas estrangeiras para profissionais brasileiros
          </p>
        </div>

        {/* Barra de pesquisa */}
        <SearchBar onSearch={handleSearch} />

        {/* Filtros */}
        <SimpleFilter onFilterChange={handleFilterChange} />

        {/* Status e contagem de resultados */}
        <div className="mb-6 flex justify-between items-center">
          <p className="text-gray-600">
            Exibindo <span className="font-medium">{jobs.length}</span> vagas
          </p>
          
          {Object.values(filters).some(f => f.length > 0) && (
            <button
              onClick={() => setFilters({ jobTypes: [], experienceLevels: [], industries: [], locations: [] })}
              className="text-primary-600 hover:text-primary-800 text-sm font-medium flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Limpar todos os filtros
            </button>
          )}
        </div>

        {/* Lista de vagas */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
            </div>
          ) : jobs.length > 0 ? (
            jobs.map(job => (
              <div key={job.id} className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
                <JobCard job={job} />
              </div>
            ))
          ) : (
            <div className="text-center py-10">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-bold text-gray-700 mb-2">Nenhuma vaga encontrada</h2>
              <p className="text-gray-600">
                Tente ajustar seus filtros ou realizar uma nova busca.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  // Aqui faremos a integração com o Prisma e o banco de dados
  // Por enquanto, retornaremos os dados de exemplo
  
  // Exemplo de como seria com Prisma:
  // const jobsData = await prisma.job.findMany({
  //   where: { status: 'ACTIVE' },
  //   include: { company: true },
  //   orderBy: { createdAt: 'desc' },
  //   take: 10,
  // });
  // 
  // const initialJobs = jobsData.map(job => ({
  //   ...job,
  //   createdAt: job.createdAt.toISOString(),
  //   updatedAt: job.updatedAt.toISOString(),
  // }));
  
  // Usando dados de exemplo
  const initialJobs = MOCK_JOBS_DATA;
  
  return {
    props: {
      initialJobs,
    },
  };
}; 