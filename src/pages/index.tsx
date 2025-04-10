import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/common/Layout';
import JobCard from '../components/jobs/JobCard';
import SearchBar from '../components/jobs/SearchBar';
import SimpleFilter from '../components/jobs/SimpleFilter';
import { Job } from '../types/job';
import Link from 'next/link';

// Define a type for filter counts for better type safety
interface FilterCounts {
  jobTypes: Record<string, number>;
  experienceLevels: Record<string, number>;
  industries: Record<string, number>;
  locations: Record<string, number>;
}

export default function Home(props) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const [selectedExperienceLevels, setSelectedExperienceLevels] = useState<string[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    pages: 0
  });
  const [forceRefresh, setForceRefresh] = useState(0);
  const [filterCounts, setFilterCounts] = useState<FilterCounts | null>(null); // Add state for counts

  // Reiniciar a página quando o usuário retornar da página de detalhes
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      if (url === '/') {
        // Forçar recarregamento quando retornar à página inicial
        setForceRefresh(prev => prev + 1);
      }
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  // Fetch jobs from API - Only when we're actually on the home page
  useEffect(() => {
    // Verificar se estamos na página inicial
    if (router.pathname !== '/') return;
    
    // Force a refresh whenever we load the page
    const timestamp = Date.now();
    console.log(`Fetching jobs at ${new Date(timestamp).toISOString()}`);
  
    const fetchJobs = async () => {
      setLoading(true);
      setError(null);
      setFilterCounts(null); // Reset counts on new fetch
      
      try {
        // Build query parameters
        const params = new URLSearchParams();
        
        if (searchTerm) params.append('search', searchTerm);
        if (selectedJobTypes.length > 0) {
          selectedJobTypes.forEach(type => params.append('jobTypes', type));
        }
        if (selectedExperienceLevels.length > 0) {
          selectedExperienceLevels.forEach(level => params.append('experienceLevels', level));
        }
        if (selectedIndustries.length > 0) {
          selectedIndustries.forEach(industry => params.append('industries', industry));
        }
        if (selectedLocations.length > 0) {
          selectedLocations.forEach(location => params.append('locations', location));
        }
        
        params.append('page', pagination.page.toString());
        params.append('limit', pagination.limit.toString());
        
        // Adicionar timestamp para prevenir cache
        params.append('_t', timestamp.toString());
        
        // Fetch data from API
        const response = await fetch(`/api/jobs?${params.toString()}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})); // Try to parse error
          throw new Error(errorData.error || 'Failed to fetch jobs');
        }
        
        const data = await response.json();
        setJobs(data.jobs || []);
        setPagination(data.pagination || { total: 0, page: 1, limit: 20, pages: 0 });
        setFilterCounts(data.filterCounts || null); // Set the filter counts
        
      } catch (err: any) {
        console.error('Error fetching jobs:', err);
        setError(err.message || 'Failed to load jobs. Please try again later.');
        setJobs([]);
        setPagination({ total: 0, page: 1, limit: 20, pages: 0 });
        setFilterCounts(null);
      } finally {
        setLoading(false);
      }
    };
    
    fetchJobs();
  }, [
    searchTerm, 
    selectedJobTypes, 
    selectedExperienceLevels, 
    selectedIndustries, 
    selectedLocations,
    pagination.page, // Keep dependency on page for pagination
    router.pathname, // Keep dependency on pathname
    forceRefresh // Keep dependency on forceRefresh
    // Removed pagination.limit as a dependency if it doesn't change often
  ]);

  // Handle search
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page on new search
  };

  // Handle filter changes
  const handleJobTypeChange = (types: string[]) => {
    setSelectedJobTypes(types);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleExperienceLevelChange = (levels: string[]) => {
    setSelectedExperienceLevels(levels);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleIndustryChange = (industries: string[]) => {
    setSelectedIndustries(industries);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleLocationChange = (locations: string[]) => {
    setSelectedLocations(locations);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedJobTypes([]);
    setSelectedExperienceLevels([]);
    setSelectedIndustries([]);
    setSelectedLocations([]);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Handle pagination
  const handleNextPage = () => {
    if (pagination.page < pagination.pages) {
      setPagination(prev => ({ ...prev, page: prev.page + 1 }));
    }
  };

  const handlePrevPage = () => {
    if (pagination.page > 1) {
      setPagination(prev => ({ ...prev, page: prev.page - 1 }));
    }
  };

  // Check if any filters are active
  const hasActiveFilters = searchTerm || 
    selectedJobTypes.length > 0 || 
    selectedExperienceLevels.length > 0 ||
    selectedIndustries.length > 0 ||
    selectedLocations.length > 0;

  return (
    <Layout>
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
        <section className="mb-8">
          <h1 className="text-2xl font-bold mb-6">
            Vagas remotas para Brasileiros
          </h1>
          
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Filters */}
            <div className="lg:w-1/4">
              <SimpleFilter
                selectedJobTypes={selectedJobTypes}
                selectedExperienceLevels={selectedExperienceLevels}
                selectedIndustries={selectedIndustries}
                selectedLocations={selectedLocations}
                filterCounts={filterCounts} // Pass counts down
                onJobTypeChange={handleJobTypeChange}
                onExperienceLevelChange={handleExperienceLevelChange}
                onIndustryChange={handleIndustryChange}
                onLocationChange={handleLocationChange}
                onClearFilters={handleClearFilters}
              />
            </div>
            
            {/* Job Listings */}
            <div className="lg:w-3/4">
              <SearchBar 
                value={searchTerm}
                onChange={handleSearch}
              />
              
              <div className="flex justify-between items-center mt-6 mb-4">
                <div className="text-gray-600">
                  {loading ? (
                    <span>Carregando vagas...</span>
                  ) : error ? (
                    <span>{error}</span>
                  ) : (
                    <span>
                      Mostrando {jobs.length > 0 ? ((pagination.page - 1) * pagination.limit) + 1 : 0} -
                      {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} vagas
                    </span>
                  )}
                </div>
                {hasActiveFilters && (
                  <button 
                    onClick={handleClearFilters}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Limpar todos os filtros
                  </button>
                )}
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-4 animate-pulse">
                      <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-300 rounded w-1/2 mb-4"></div>
                      <div className="h-3 bg-gray-300 rounded w-full mb-2"></div>
                      <div className="h-3 bg-gray-300 rounded w-5/6"></div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="text-center text-red-600 bg-red-50 p-4 rounded-md">
                  {error}
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center text-gray-600 bg-gray-50 p-6 rounded-md">
                  Nenhuma vaga encontrada com os filtros selecionados.
                </div>
              ) : (
                <div className="space-y-6">
                  {jobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="mt-8 flex justify-center items-center space-x-4">
                  <button
                    onClick={handlePrevPage}
                    disabled={pagination.page <= 1 || loading}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-gray-700">
                    Página {pagination.page} de {pagination.pages}
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={pagination.page >= pagination.pages || loading}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Próxima
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
} 