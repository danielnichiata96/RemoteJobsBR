import { useState } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import Layout from '@/components/common/Layout';
import WideJobCard from '@/components/jobs/WideJobCard';
import { Job, JobType, ExperienceLevel } from '@/types/models';

// Importando dados de exemplo da página inicial
import { MOCK_JOBS } from '@/pages/index';

interface JobsPageProps {
  jobs: Job[];
  totalJobs: number;
  page: number;
  totalPages: number;
  filters?: {
    search?: string;
    jobTypes?: string[];
    experienceLevels?: string[];
    locations?: string[];
    remote?: boolean;
  };
}

export default function JobsPage({ 
  jobs, 
  totalJobs, 
  page, 
  totalPages,
  filters = {}
}: JobsPageProps) {
  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>(filters.jobTypes || []);
  const [selectedExperienceLevels, setSelectedExperienceLevels] = useState<string[]>(filters.experienceLevels || []);
  const [isRemoteOnly, setIsRemoteOnly] = useState<boolean>(filters.remote || false);

  // Opções para os filtros
  const jobTypeOptions = [
    { value: 'FULL_TIME', label: 'Tempo Integral' },
    { value: 'PART_TIME', label: 'Meio Período' },
    { value: 'CONTRACT', label: 'Contrato' },
    { value: 'INTERNSHIP', label: 'Estágio' },
    { value: 'FREELANCE', label: 'Freelance' },
  ];

  const experienceLevelOptions = [
    { value: 'ENTRY', label: 'Júnior' },
    { value: 'MID', label: 'Pleno' },
    { value: 'SENIOR', label: 'Sênior' },
    { value: 'LEAD', label: 'Líder' },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Redirecionar para a própria página com os novos filtros
    const params = new URLSearchParams();
    
    if (searchTerm) params.append('search', searchTerm);
    if (selectedJobTypes.length) params.append('jobTypes', selectedJobTypes.join(','));
    if (selectedExperienceLevels.length) params.append('experienceLevels', selectedExperienceLevels.join(','));
    if (isRemoteOnly) params.append('remote', 'true');
    
    window.location.href = `/jobs?${params.toString()}`;
  };

  const handleFilterToggle = () => {
    setShowFilters(!showFilters);
  };

  const handleJobTypeChange = (value: string) => {
    setSelectedJobTypes(prev => 
      prev.includes(value) 
        ? prev.filter(type => type !== value)
        : [...prev, value]
    );
  };

  const handleExperienceLevelChange = (value: string) => {
    setSelectedExperienceLevels(prev => 
      prev.includes(value) 
        ? prev.filter(level => level !== value)
        : [...prev, value]
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedJobTypes([]);
    setSelectedExperienceLevels([]);
    setIsRemoteOnly(false);
  };

  return (
    <Layout title="Vagas Remotas - RemoteJobsBR">
      <Head>
        <meta name="description" content="Encontre vagas remotas em empresas internacionais para profissionais brasileiros" />
      </Head>

      <div className="bg-primary-50 py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Vagas Remotas Internacionais
          </h1>
          
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-grow">
                <input
                  type="text"
                  placeholder="Busque por cargo, tecnologia ou empresa..."
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button 
                type="submit"
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition duration-200"
              >
                Buscar
              </button>
              <button 
                type="button"
                onClick={handleFilterToggle}
                className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition duration-200 flex items-center"
              >
                <span>Filtros</span>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            {showFilters && (
              <div className="mt-4 bg-white p-6 rounded-lg shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Tipo de Contrato</h3>
                    <div className="space-y-2">
                      {jobTypeOptions.map(option => (
                        <label key={option.value} className="flex items-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 rounded"
                            checked={selectedJobTypes.includes(option.value)}
                            onChange={() => handleJobTypeChange(option.value)}
                          />
                          <span className="ml-2 text-gray-700">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Nível de Experiência</h3>
                    <div className="space-y-2">
                      {experienceLevelOptions.map(option => (
                        <label key={option.value} className="flex items-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 rounded"
                            checked={selectedExperienceLevels.includes(option.value)}
                            onChange={() => handleExperienceLevelChange(option.value)}
                          />
                          <span className="ml-2 text-gray-700">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Outras Opções</h3>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 rounded"
                          checked={isRemoteOnly}
                          onChange={() => setIsRemoteOnly(!isRemoteOnly)}
                        />
                        <span className="ml-2 text-gray-700">Apenas Vagas 100% Remotas</span>
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-gray-700 hover:text-gray-900 font-medium"
                  >
                    Limpar Filtros
                  </button>
                  <button
                    type="submit"
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md font-medium transition duration-200"
                  >
                    Aplicar Filtros
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10">
        <div className="flex justify-between items-center mb-6">
          <p className="text-gray-700">
            Exibindo <span className="font-medium">{jobs.length}</span> de <span className="font-medium">{totalJobs}</span> vagas
          </p>
          
          <div className="flex items-center">
            <label htmlFor="sort" className="mr-2 text-gray-700">Ordernar por:</label>
            <select
              id="sort"
              className="border border-gray-300 rounded-md py-1.5 pl-3 pr-8 text-gray-700 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="recent">Mais Recentes</option>
              <option value="salary-desc">Maior Salário</option>
              <option value="salary-asc">Menor Salário</option>
              <option value="relevance">Relevância</option>
            </select>
          </div>
        </div>
        
        {jobs.length > 0 ? (
          <div className="space-y-6">
            {jobs.map((job) => (
              <WideJobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-bold text-gray-700 mb-2">Nenhuma vaga encontrada</h2>
            <p className="text-gray-600 mb-6">
              Tente ajustar seus filtros ou realizar uma nova busca.
            </p>
            <button
              onClick={clearFilters}
              className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-md font-medium transition duration-200"
            >
              Limpar Filtros
            </button>
          </div>
        )}
        
        {totalPages > 1 && (
          <div className="flex justify-center mt-12">
            <nav className="inline-flex rounded-md shadow">
              <a
                href={`/jobs?page=${Math.max(1, page - 1)}`}
                className={`px-4 py-2 rounded-l-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 ${page === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Anterior
              </a>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                <a
                  key={pageNum}
                  href={`/jobs?page=${pageNum}`}
                  className={`px-4 py-2 border-t border-b border-gray-300 ${
                    pageNum === page
                      ? 'bg-primary-50 text-primary-600 font-medium border-primary-500'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </a>
              ))}
              
              <a
                href={`/jobs?page=${Math.min(totalPages, page + 1)}`}
                className={`px-4 py-2 rounded-r-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 ${page === totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Próxima
              </a>
            </nav>
          </div>
        )}
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  // Parâmetros da URL
  const page = Number(query.page) || 1;
  const search = query.search as string || '';
  const jobTypes = query.jobTypes ? (query.jobTypes as string).split(',') : [];
  const experienceLevels = query.experienceLevels ? (query.experienceLevels as string).split(',') : [];
  const remote = query.remote === 'true';

  // Em um cenário real, buscaríamos do banco de dados
  // através do Prisma com filtros e paginação
  
  // Simulação de filtragem
  let filteredJobs = [...MOCK_JOBS];
  
  if (search) {
    const searchLower = search.toLowerCase();
    filteredJobs = filteredJobs.filter(job => 
      job.title.toLowerCase().includes(searchLower) || 
      job.description.toLowerCase().includes(searchLower) ||
      job.company?.name.toLowerCase().includes(searchLower) ||
      job.skills.some(skill => skill.toLowerCase().includes(searchLower))
    );
  }
  
  if (jobTypes.length > 0) {
    filteredJobs = filteredJobs.filter(job => 
      jobTypes.includes(job.jobType)
    );
  }
  
  if (experienceLevels.length > 0) {
    filteredJobs = filteredJobs.filter(job => 
      experienceLevels.includes(job.experienceLevel)
    );
  }
  
  if (remote) {
    filteredJobs = filteredJobs.filter(job => 
      job.workplaceType === 'remote'
    );
  }

  // Simulação de paginação
  const totalJobs = filteredJobs.length;
  const itemsPerPage = 10;
  const totalPages = Math.ceil(totalJobs / itemsPerPage);
  
  // Garantir que a página está dentro dos limites
  const validPage = Math.min(Math.max(1, page), Math.max(1, totalPages));
  
  // Slice para paginação
  const startIndex = (validPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedJobs = filteredJobs.slice(startIndex, endIndex);
  
  return {
    props: {
      jobs: paginatedJobs,
      totalJobs,
      page: validPage,
      totalPages,
      filters: {
        search,
        jobTypes,
        experienceLevels,
        remote
      }
    },
  };
}; 