import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { GetStaticProps } from 'next';
import Layout from '@/components/common/Layout';
import WideJobCard from '@/components/jobs/WideJobCard';
import NewsletterSignup from '@/components/common/NewsletterSignup';
import { Job, JobType, ExperienceLevel } from '@/types/models';

// Dados de exemplo para a página inicial
export const MOCK_JOBS: Job[] = [
  {
    id: '1',
    companyId: '101',
    title: 'Desenvolvedor Frontend React',
    description: 'Estamos procurando um desenvolvedor frontend React experiente para trabalhar em projetos inovadores. Você irá colaborar com uma equipe internacional e participar de todo o ciclo de desenvolvimento.',
    requirements: 'React, TypeScript, CSS avançado',
    responsibilities: 'Desenvolver interfaces, colaborar com o design, implementar testes automatizados',
    benefits: 'Horário flexível, plano de saúde, 30 dias de férias',
    jobType: JobType.FULL_TIME,
    experienceLevel: ExperienceLevel.MID,
    skills: ['React', 'TypeScript', 'Redux', 'CSS', 'Figma'],
    tags: ['Frontend', 'JavaScript'],
    location: 'São Paulo (Remoto)',
    country: 'Brasil',
    workplaceType: 'remote',
    minSalary: 8000,
    maxSalary: 12000,
    currency: 'BRL',
    salaryCycle: 'monthly',
    showSalary: true,
    status: 'ACTIVE',
    visas: [],
    languages: ['Português', 'Inglês'],
    applicationUrl: '',
    applicationEmail: 'jobs@company.com',
    createdAt: new Date('2025-02-15T10:00:00Z'),
    updatedAt: new Date('2025-02-15T10:00:00Z'),
    publishedAt: new Date('2025-02-15T10:00:00Z'),
    expiresAt: new Date('2025-04-15T10:00:00Z'),
    viewCount: 145,
    applicantCount: 12,
    company: {
      id: '101',
      name: 'TechInova',
      email: 'contact@techinova.com',
      logo: 'https://via.placeholder.com/150',
      role: 'COMPANY',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      isActive: true,
    }
  },
  {
    id: '2',
    companyId: '102',
    title: 'UX/UI Designer para Projeto Internacional',
    description: 'Empresa dos EUA busca UX/UI Designer para trabalhar em projeto de fintech. O designer ideal será responsável por criar experiências de usuário intuitivas e atraentes para produtos financeiros digitais.',
    requirements: 'Figma, UX Research, Design Thinking',
    responsibilities: 'Criar wireframes, prototipar, realizar testes de usuário',
    benefits: 'Pagamento em dólar, equipe global, flexibilidade',
    jobType: JobType.FULL_TIME,
    experienceLevel: ExperienceLevel.SENIOR,
    skills: ['Figma', 'UI Design', 'Wireframing', 'Design Thinking', 'Adobe XD'],
    tags: ['Design', 'UX/UI'],
    location: 'Remoto (EUA)',
    country: 'Estados Unidos',
    workplaceType: 'remote',
    minSalary: 6000,
    maxSalary: 9000,
    currency: 'USD',
    salaryCycle: 'monthly',
    showSalary: true,
    status: 'ACTIVE',
    visas: [],
    languages: ['Inglês'],
    applicationUrl: '',
    applicationEmail: 'design@globalfin.com',
    createdAt: new Date('2025-03-01T10:00:00Z'),
    updatedAt: new Date('2025-03-01T10:00:00Z'),
    publishedAt: new Date('2025-03-01T10:00:00Z'),
    expiresAt: new Date('2025-05-01T10:00:00Z'),
    viewCount: 89,
    applicantCount: 7,
    company: {
      id: '102',
      name: 'GlobalFin',
      email: 'hr@globalfin.com',
      logo: 'https://via.placeholder.com/150',
      role: 'COMPANY',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      isActive: true,
    }
  },
  {
    id: '3',
    companyId: '103',
    title: 'Desenvolvedor Backend Node.js',
    description: 'Empresa europeia procura desenvolvedor Node.js para construir e manter APIs REST e microsserviços. Esta é uma oportunidade para quem deseja trabalhar em um ambiente internacional com práticas modernas de desenvolvimento.',
    requirements: 'Node.js, TypeScript, PostgreSQL, Docker',
    responsibilities: 'Desenvolver APIs, otimizar performance, documentar código',
    benefits: 'Plano de desenvolvimento de carreira, bônus anual, horário flexível',
    jobType: JobType.FULL_TIME,
    experienceLevel: ExperienceLevel.MID,
    skills: ['Node.js', 'Express', 'TypeScript', 'PostgreSQL', 'Docker', 'AWS'],
    tags: ['Backend', 'JavaScript'],
    location: 'Remoto (Alemanha)',
    country: 'Alemanha',
    workplaceType: 'remote',
    minSalary: 5000,
    maxSalary: 7000,
    currency: 'EUR',
    salaryCycle: 'monthly',
    showSalary: true,
    status: 'ACTIVE',
    visas: [],
    languages: ['Inglês'],
    applicationUrl: '',
    applicationEmail: 'careers@eurotechdev.com',
    createdAt: new Date('2025-03-10T10:00:00Z'),
    updatedAt: new Date('2025-03-10T10:00:00Z'),
    publishedAt: new Date('2025-03-10T10:00:00Z'),
    expiresAt: new Date('2025-05-10T10:00:00Z'),
    viewCount: 112,
    applicantCount: 9,
    company: {
      id: '103',
      name: 'EuroTechDev',
      email: 'info@eurotechdev.com',
      logo: 'https://via.placeholder.com/150',
      role: 'COMPANY',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      isActive: true,
    }
  }
];

interface HomeProps {
  featuredJobs: Job[];
}

export default function Home({ featuredJobs }: HomeProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Redirecionar para a página de busca com o termo
    window.location.href = `/jobs?search=${encodeURIComponent(searchTerm)}`;
  };

  return (
    <Layout>
      <Head>
        <title>RemoteJobsBR - Vagas Remotas Internacionais para Brasileiros</title>
        <meta name="description" content="Encontre as melhores vagas remotas em empresas internacionais para profissionais brasileiros" />
      </Head>

      <section className="py-16 bg-gradient-to-b from-primary-50 to-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Vagas Remotas Internacionais para Brasileiros
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Conectamos talentos brasileiros a oportunidades de trabalho remoto em empresas internacionais.
              Encontre sua próxima vaga com salários em dólar e euro.
            </p>
            
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="flex flex-col sm:flex-row shadow-lg rounded-lg overflow-hidden">
                <input
                  type="text"
                  placeholder="Busque por cargo, tecnologia ou empresa..."
                  className="flex-grow px-6 py-4 border-0 focus:ring-0 focus:outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button 
                  type="submit"
                  className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-4 font-medium transition duration-200"
                >
                  Buscar
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
      
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Vagas em Destaque</h2>
            <Link 
              href="/jobs" 
              className="text-primary-600 hover:text-primary-800 font-medium flex items-center"
            >
              Ver todas as vagas
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
          
          <div className="space-y-6">
            {featuredJobs.map((job) => (
              <WideJobCard key={job.id} job={job} />
            ))}
          </div>
          
          <div className="mt-12 text-center">
            <Link
              href="/jobs"
              className="inline-block bg-primary-600 hover:bg-primary-700 text-white py-3 px-8 rounded-md font-medium transition duration-200"
            >
              Ver Todas as Vagas
            </Link>
          </div>
        </div>
      </section>
      
      <section className="py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">Como Funciona</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-primary-100 w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a4 4 0 00-3.446 6.032l-2.261 2.26a1 1 0 101.414 1.415l2.261-2.261A4 4 0 1011 5z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">1. Encontre Vagas</h3>
              <p className="text-gray-600">
                Busque entre centenas de vagas remotas em empresas internacionais que correspondam às suas habilidades.
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-primary-100 w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">2. Candidate-se</h3>
              <p className="text-gray-600">
                Aplique diretamente pelo site com apenas alguns cliques e acompanhe o status das suas candidaturas.
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-primary-100 w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zm3 14a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">3. Conecte-se</h3>
              <p className="text-gray-600">
                Se seu perfil for compatível, a empresa entrará em contato para as próximas etapas do processo seletivo.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      <section className="py-12">
        <div className="container mx-auto px-4">
          <NewsletterSignup />
        </div>
      </section>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  // Em um cenário real, buscaríamos do banco de dados
  // através do Prisma
  const featuredJobs = MOCK_JOBS;
  
  return {
    props: {
      featuredJobs,
    },
    // Revalidar a cada 1 hora
    revalidate: 3600,
  };
}; 