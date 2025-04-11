import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/common/Layout';
import Link from 'next/link';
import Head from 'next/head';
import WideJobCard from '@/components/jobs/WideJobCard';
import ErrorMessage from '@/components/common/ErrorMessage';
import JobListSkeleton from '@/components/jobs/JobListSkeleton';
import { useJobsSearch } from '@/hooks/useJobsSearch';
import { Job } from '@/types/models';
import CustomSelect from '@/components/common/CustomSelect';

// Define valid sort options type (copied from jobs/index.tsx)
type SortByType = 'newest' | 'salary' | 'relevance';

// Define options for the CustomSelect
const sortOptions = [
  { value: 'newest', label: 'Mais Recentes' },
  { value: 'salary', label: 'Maior Salário' },
  { value: 'relevance', label: 'Relevância' },
];

export default function Home(props) {
  const router = useRouter();

  // State variables (copied from jobs/index.tsx)
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const [selectedExperienceLevels, setSelectedExperienceLevels] = useState<string[]>([]);
  const [isRemoteOnly, setIsRemoteOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortByType>('newest');

  // Parse initial filters and sort from URL query (copied from jobs/index.tsx)
  useEffect(() => {
    const { query } = router;
    if (query.page) setCurrentPage(parseInt(query.page as string));
    if (query.q) setSearchTerm(query.q as string);
    if (query.jobType) setSelectedJobTypes((query.jobType as string).split(',').filter(Boolean));
    if (query.experienceLevel) setSelectedExperienceLevels((query.experienceLevel as string).split(',').filter(Boolean));
    if (query.remote === 'true') setIsRemoteOnly(true);
    if (query.sortBy && ['newest', 'salary', 'relevance'].includes(query.sortBy as string)) {
      setSortBy(query.sortBy as SortByType);
    }
  }, [router.query]);

  // Fetch data using the hook (copied from jobs/index.tsx)
  const { jobs, pagination, isLoading, isError, error } = useJobsSearch({
    search: searchTerm,
    page: currentPage,
    limit: 10, // Or your desired limit
    jobTypes: selectedJobTypes,
    experienceLevels: selectedExperienceLevels,
    remote: isRemoteOnly,
    sortBy: sortBy,
  });

  // Filter options (copied from jobs/index.tsx)
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
  
  // Handlers and updateRouterQuery (copied from jobs/index.tsx)
  const updateRouterQuery = (newParams = {}) => {
    const currentQuery = { ...router.query };
    const queryParams: Record<string, string> = {};
    if (searchTerm) queryParams.q = searchTerm;
    if (selectedJobTypes.length) queryParams.jobType = selectedJobTypes.join(',');
    if (selectedExperienceLevels.length) queryParams.experienceLevel = selectedExperienceLevels.join(',');
    if (isRemoteOnly) queryParams.remote = 'true';
    if (currentPage > 1) queryParams.page = currentPage.toString();
    if (sortBy !== 'newest') queryParams.sortBy = sortBy;
    const finalQuery = { ...currentQuery, ...queryParams, ...newParams };
    Object.keys(finalQuery).forEach(key => {
      if (!finalQuery[key] || (Array.isArray(finalQuery[key]) && finalQuery[key].length === 0)) {
        delete finalQuery[key];
      } else if (key === 'page' && finalQuery[key] === '1') {
        delete finalQuery[key]; // Remove page=1 explicitly
      } else if (key === 'sortBy' && finalQuery[key] === 'newest') {
        delete finalQuery[key];
      }
    });
    router.push(
      { pathname: router.pathname, query: finalQuery },
      undefined,
      { shallow: true, scroll: false } // prevent scroll jump on query update
    );
  };

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    setCurrentPage(1);
    updateRouterQuery({ page: undefined });
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

  const handleRemoteChange = () => {
    setIsRemoteOnly(!isRemoteOnly);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedJobTypes([]);
    setSelectedExperienceLevels([]);
    setIsRemoteOnly(false);
    setSortBy('newest');
    setCurrentPage(1);
    updateRouterQuery({ q: undefined, jobType: undefined, experienceLevel: undefined, remote: undefined, sortBy: undefined, page: undefined });
  };
  
  const handleSortChange = (value: string | number) => {
    const newSortBy = value as SortByType;
    setSortBy(newSortBy);
    setCurrentPage(1);
    updateRouterQuery({ sortBy: newSortBy !== 'newest' ? newSortBy : undefined, page: undefined });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= (pagination?.totalPages || 1)) {
      setCurrentPage(newPage);
      updateRouterQuery({ page: newPage > 1 ? newPage.toString() : undefined });
      window.scrollTo(0, 0); // Scroll to top on page change
    }
  };

  return (
    <Layout>
      {/* Use Head from Next.js for page-specific title/meta */}
      <Head>
        <title>Vagas Remotas para Brasileiros | RemoteJobsBR</title>
        <meta name="description" content="Encontre as melhores vagas remotas em empresas internacionais, selecionadas para profissionais brasileiros." />
      </Head>

      {/* Seção para recrutadores internacionais - em inglês */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-8 border-b border-blue-700">
        <div className="max-w-7xl mx-auto px-4">
          <div className="md:flex md:justify-between md:items-center">
            <div className="max-w-2xl mb-6 md:mb-0">
              <h2 className="text-2xl md:text-3xl font-bold mb-2">
                Are you hiring Brazilian tech talent?
              </h2>
              <p className="text-blue-100 mb-4">
                Post remote job opportunities and reach thousands of skilled Brazilian professionals looking for international opportunities.
              </p>
              <ul className="text-blue-100 mb-6 space-y-1">
                <li className="flex items-center">
                  <svg className="h-5 w-5 mr-2 text-blue-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Access a pool of skilled and diverse professionals
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 mr-2 text-blue-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Timezone compatibility with North America
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 mr-2 text-blue-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Competitive rates and high-quality work
                </li>
              </ul>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md max-w-md w-full">
              <h3 className="text-blue-800 font-bold text-xl mb-4">Ready to hire top Brazilian talent?</h3>
              <Link 
                href="/auth/recruiter" 
                className="w-full block text-center bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-md font-medium transition-colors"
              >
                Post a Job
              </Link>
              <p className="text-gray-600 text-sm mt-3 text-center">
                No credit card required. Free job posting for a limited time.
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">
          Vagas remotas para Brasileiros
        </h1>
        
        {/* Filter Bar Section (copied from jobs/index.tsx, adjusted container/bg) */}
        <div className="bg-gray-50 py-6 mb-8 rounded-lg shadow-sm border border-gray-200">
          <div className="container mx-auto px-4">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Encontre sua Vaga Remota
            </h1>
            {/* Search and Filter Form */}
            <form onSubmit={handleSearch} className="mb-0"> {/* Removed mb-6 */}
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search Input */}
                <div className="flex-grow">
                  <input
                    type="text"
                    placeholder="Busque por cargo, tecnologia ou empresa..."
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {/* Search Button */}
                <button
                  type="submit"
                  className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition duration-200"
                >
                  Buscar
                </button>
                {/* Filter Toggle Button */}
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

              {/* Collapsible Filters */}
              {showFilters && (
                <div className="mt-4 bg-white p-6 rounded-lg shadow-md border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Job Type Filter */}
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
                    {/* Experience Level Filter */}
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
                  </div>
                  {/* Filter Actions */}
                  <div className="mt-6 flex justify-end space-x-4">
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-gray-700 hover:text-gray-900 font-medium"
                    >
                      Limpar Filtros
                    </button>
                    <button
                      type="button"
                      onClick={() => { handleSearch(); setShowFilters(false); }} // Apply and close filters
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

        {/* Job List Section (copied from jobs/index.tsx) */}
        <div className="container mx-auto px-4 py-0"> {/* Adjusted padding */}
          {/* Results Count and Sorting */}
          <div className="flex justify-between items-center mb-6">
            <p className="text-gray-700">
              {isLoading
                ? 'Carregando vagas...'
                : isError
                ? 'Erro ao carregar'
                : pagination?.totalCount !== undefined
                ? `Exibindo ${jobs?.length || 0} de ${pagination.totalCount} vagas`
                : 'Nenhuma vaga encontrada'}
            </p>
            <div className="flex items-center">
              <label htmlFor="sort" className="mr-2 text-gray-700">Ordernar por:</label>
              <CustomSelect
                id="sort"
                label="Ordernar por"
                options={sortOptions}
                value={sortBy}
                onChange={handleSortChange}
                disabled={isLoading}
                placeholder="Selecione..."
              />
            </div>
          </div>

          {/* Conditional Rendering: Loading, Error, No Results, Job List */}
          {isLoading ? (
            <JobListSkeleton count={10} />
          ) : isError ? (
            <ErrorMessage message={error?.info?.message || error?.message || 'Não foi possível carregar as vagas no momento.'} />
          ) : jobs && jobs.length > 0 ? (
            <div className="space-y-6">
              {jobs.map((job) => (
                <WideJobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-gray-50 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-bold text-gray-700 mb-2">Nenhuma vaga encontrada</h2>
              <p className="text-gray-600">Tente ajustar seus filtros ou termos de busca.</p>
            </div>
          )}

          {/* Pagination Controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-10 flex justify-center items-center space-x-4">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={!pagination.hasPrevPage || isLoading}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-700">
                Página {pagination.currentPage} de {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!pagination.hasNextPage || isLoading}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      </main>
    </Layout>
  );
} 