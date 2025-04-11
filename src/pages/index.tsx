import { useState, useEffect, useCallback } from 'react';
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
import JobFilters from '@/components/jobs/JobFilters';

// Define type for the filter state object used for communication
export type FilterState = {
  searchTerm: string;
  jobTypes: string[];
  experienceLevels: string[];
  technologies: string[];
  isRemoteOnly: boolean;
};

// Define valid sort options type (copied from jobs/index.tsx)
type SortByType = 'newest' | 'salary' | 'relevance';

// Define options for the CustomSelect
const sortOptions = [
  { value: 'newest', label: 'Mais Recentes' },
  { value: 'salary', label: 'Maior Salário' },
  { value: 'relevance', label: 'Relevância' },
];

export default function Home() {
  const router = useRouter();

  // State variables (copied from jobs/index.tsx)
  const [currentPage, setCurrentPage] = useState(1);
  const [currentFilters, setCurrentFilters] = useState<FilterState>({
    searchTerm: '',
    jobTypes: [],
    experienceLevels: [],
    technologies: [],
    isRemoteOnly: false,
  });
  const [sortBy, setSortBy] = useState<SortByType>('newest');

  // Parse initial filters and sort from URL query (copied from jobs/index.tsx)
  useEffect(() => {
    const { query } = router;
    const initialFilters: Partial<FilterState> = {}; // Use Partial for incremental build
    if (query.q) initialFilters.searchTerm = query.q as string;
    if (query.jobType) initialFilters.jobTypes = (query.jobType as string).split(',').filter(Boolean);
    if (query.experienceLevel) initialFilters.experienceLevels = (query.experienceLevel as string).split(',').filter(Boolean);
    if (query.technologies) initialFilters.technologies = (query.technologies as string).split(',').filter(Boolean);
    if (query.remote === 'true') initialFilters.isRemoteOnly = true;
    
    // Update state only if there are changes from initial empty state or previous query
    setCurrentFilters(prev => ({ ...prev, ...initialFilters }));

    // Parse page and sort separately
    if (query.page) setCurrentPage(parseInt(query.page as string));
    else setCurrentPage(1); // Reset page if not in query

    if (query.sortBy && ['newest', 'salary', 'relevance'].includes(query.sortBy as string)) {
      setSortBy(query.sortBy as SortByType);
    } else {
      setSortBy('newest'); // Reset sort if not in query
    }
  }, [router.query]); // Dependency array includes router.query

  // Fetch data using the hook
  const { jobs, pagination, isLoading, isError, error, aggregations } = useJobsSearch({
    search: currentFilters.searchTerm,
    page: currentPage,
    limit: 10,
    jobTypes: currentFilters.jobTypes,
    experienceLevels: currentFilters.experienceLevels,
    technologies: currentFilters.technologies,
    remote: currentFilters.isRemoteOnly,
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
  
  // Define technology options (example)
  const technologyOptions = [
    { value: 'React', label: 'React' },
    { value: 'Node.js', label: 'Node.js' },
    { value: 'TypeScript', label: 'TypeScript' },
    { value: 'Python', label: 'Python' },
    { value: 'Next.js', label: 'Next.js' },
    { value: 'AWS', label: 'AWS' },
    { value: 'Docker', label: 'Docker' },
    { value: 'JavaScript', label: 'JavaScript' },
  ];
  
  // Function to update URL query based on filters, page, sort
  const updateRouterQuery = useCallback((filters: FilterState, page: number, sort: SortByType) => {
    const queryParams: Record<string, string> = {};
    if (filters.searchTerm) queryParams.q = filters.searchTerm;
    if (filters.jobTypes.length) queryParams.jobType = filters.jobTypes.join(',');
    if (filters.experienceLevels.length) queryParams.experienceLevel = filters.experienceLevels.join(',');
    if (filters.technologies.length) queryParams.technologies = filters.technologies.join(',');
    if (filters.isRemoteOnly) queryParams.remote = 'true';
    if (page > 1) queryParams.page = page.toString();
    if (sort !== 'newest') queryParams.sortBy = sort;

    router.push(
      { pathname: router.pathname, query: queryParams },
      undefined,
      { shallow: true, scroll: false }
    );
  }, [router]);

  // --- Handler for updates coming FROM JobFilters component ---
  const handleFilterUpdate = useCallback((newFilters: FilterState) => {
    setCurrentFilters(newFilters); // Update the page's filter state
    setCurrentPage(1); // Reset page number on filter change
    updateRouterQuery(newFilters, 1, sortBy); // Update URL
  }, [sortBy, updateRouterQuery]);

  // --- Handlers for actions managed directly by the Page (Pagination, Sorting) ---
  const handleSortChange = useCallback((value: string | number) => {
    const newSortBy = value as SortByType;
    setSortBy(newSortBy);
    setCurrentPage(1);
    updateRouterQuery(currentFilters, 1, newSortBy);
  }, [currentFilters, updateRouterQuery]);

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= (pagination?.totalPages || 1)) {
      setCurrentPage(newPage);
      updateRouterQuery(currentFilters, newPage, sortBy);
      window.scrollTo(0, 0);
    }
  }, [currentFilters, pagination?.totalPages, sortBy, updateRouterQuery]);

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
        
        {/* Render the JobFilters component */}
        <JobFilters
          searchTerm={currentFilters.searchTerm}
          selectedJobTypes={currentFilters.jobTypes}
          selectedExperienceLevels={currentFilters.experienceLevels}
          selectedTechnologies={currentFilters.technologies}
          isRemoteOnly={currentFilters.isRemoteOnly}
          aggregations={aggregations}
          
          // Pass callback handlers down
          onSearchTermChange={(value) => handleFilterUpdate({ ...currentFilters, searchTerm: value })}
          onJobTypeChange={(value) => {
            const newSelection = currentFilters.jobTypes.includes(value)
              ? currentFilters.jobTypes.filter(type => type !== value)
              : [...currentFilters.jobTypes, value];
            handleFilterUpdate({ ...currentFilters, jobTypes: newSelection });
          }}
          onExperienceLevelChange={(value) => {
             const newSelection = currentFilters.experienceLevels.includes(value)
              ? currentFilters.experienceLevels.filter(level => level !== value)
              : [...currentFilters.experienceLevels, value];
             handleFilterUpdate({ ...currentFilters, experienceLevels: newSelection });
          }}
          onTechnologyChange={(value) => {
            const newSelection = currentFilters.technologies.includes(value)
              ? currentFilters.technologies.filter(tech => tech !== value)
              : [...currentFilters.technologies, value];
            handleFilterUpdate({ ...currentFilters, technologies: newSelection });
          }}
           onRemoteChange={() => {
             handleFilterUpdate({ ...currentFilters, isRemoteOnly: !currentFilters.isRemoteOnly });
           }}
          onClearFilters={() => {
             const clearedFilters: FilterState = {
               searchTerm: '',
               jobTypes: [],
               experienceLevels: [],
               technologies: [],
               isRemoteOnly: false,
             };
            handleFilterUpdate(clearedFilters);
             // Optionally reset sort as well? 
             // setSortBy('newest'); updateRouterQuery(clearedFilters, 1, 'newest');
          }}
          onSearchSubmit={(e) => {
            e?.preventDefault();
            handleFilterUpdate(currentFilters); // Re-apply current filters (resets page to 1)
          }}
        />

        {/* Active Filter Chips Section - Updated chip generation */}
        {(() => {
          const activeChips = [];
          if (currentFilters.searchTerm) {
            activeChips.push({ type: 'search', label: `Busca: "${currentFilters.searchTerm}"`, onRemove: () => handleFilterUpdate({ ...currentFilters, searchTerm: '' }) });
          }
          if (currentFilters.isRemoteOnly) {
            activeChips.push({ type: 'remote', label: 'Apenas Remoto', onRemove: () => handleFilterUpdate({ ...currentFilters, isRemoteOnly: false }) });
          }
          
          // Chip generation for JobType
          currentFilters.jobTypes.forEach(jt => {
             // Find label if needed (redefine options here or pass down)
              const option = jobTypeOptions.find(o => o.value === jt);
              activeChips.push({ type: 'jobType', value: jt, label: `Tipo: ${option?.label || jt}`, onRemove: () => {
                  const newSelection = currentFilters.jobTypes.filter(type => type !== jt);
                  handleFilterUpdate({ ...currentFilters, jobTypes: newSelection });
              } });
          });

          // Chip generation for ExperienceLevel
          currentFilters.experienceLevels.forEach(el => {
             const option = experienceLevelOptions.find(o => o.value === el);
             activeChips.push({ type: 'experience', value: el, label: `Nível: ${option?.label || el}`, onRemove: () => {
                 const newSelection = currentFilters.experienceLevels.filter(level => level !== el);
                 handleFilterUpdate({ ...currentFilters, experienceLevels: newSelection });
             } });
          });

          // Chip generation for Technologies
          currentFilters.technologies.forEach(tech => {
              // Tech labels are just the value itself for now
             activeChips.push({ type: 'technology', value: tech, label: `Tec: ${tech}`, onRemove: () => {
                 const newSelection = currentFilters.technologies.filter(t => t !== tech);
                 handleFilterUpdate({ ...currentFilters, technologies: newSelection });
             } });
          });
           
          if (activeChips.length === 0) return null;

          return (
            <div className="mb-6 flex flex-wrap gap-2 items-center">
              <span className="text-sm font-medium text-gray-600 mr-2">Filtros Ativos:</span>
              {activeChips.map(chip => (
                 // Chip JSX - Use label in key
                 <span key={`${chip.type}-${chip.label}`} 
                   className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800"
                 >
                   {chip.label}
                   <button
                     type="button"
                     className="flex-shrink-0 ml-1.5 -mr-0.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-primary-500 hover:bg-primary-200 hover:text-primary-600 focus:outline-none focus:bg-primary-500 focus:text-white"
                     onClick={chip.onRemove}
                   >
                     <span className="sr-only">Remover filtro {chip.label}</span>
                     <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                       <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
                     </svg>
                   </button>
                 </span>
              ))}
              {/* Clear All Button */}
              {activeChips.length > 0 && (
                 <button
                    type="button"
                    onClick={() => handleFilterUpdate({searchTerm: '', jobTypes: [], experienceLevels: [], technologies: [], isRemoteOnly: false})}
                    className="text-sm text-primary-600 hover:text-primary-800 hover:underline ml-2"
                 >
                   Limpar Todos
                 </button>
               )}
            </div>
          );
        })()}

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