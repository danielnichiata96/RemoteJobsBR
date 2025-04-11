import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';

export default function RecruiterDashboard(props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [activeJobsCount, setActiveJobsCount] = useState(null);
  const [totalJobsCount, setTotalJobsCount] = useState(null);
  const [viewsCount, setViewsCount] = useState(null);
  const [clicksCount, setClicksCount] = useState(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  
  // Verificar se o usuário está autenticado e buscar estatísticas
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/recruiter');
      return; // Sai cedo se não autenticado
    }
    
    // Mostrar mensagem de sucesso se o parâmetro verified=true estiver presente
    if (router.query.verified === 'true') {
      setShowSuccessMessage(true);
      
      // Remover o parâmetro da URL após alguns segundos
      const timeout = setTimeout(() => {
        router.replace('/recruiter/dashboard', undefined, { shallow: true });
      }, 5000);
      
      return () => clearTimeout(timeout);
    }

    // Buscar estatísticas se autenticado
    if (status === 'authenticated') {
      fetchDashboardStats();
    }
  }, [status, router, router.query.verified]);

  const fetchDashboardStats = async () => {
    try {
      setIsLoadingStats(true);
      setStatsError(null);
      const response = await fetch('/api/recruiter/dashboard/stats');
      
      if (response.ok) {
        const data = await response.json();
        setActiveJobsCount(data.publishedJobsCount);
        setTotalJobsCount(data.totalJobsCount);
        setViewsCount(data.viewsCount);
        setClicksCount(data.clicksCount);
      } else {
        console.error('Erro ao buscar estatísticas do dashboard');
      }
    } catch (error: any) {
      console.error('Erro ao buscar estatísticas:', error);
      setStatsError(error.message || 'Erro ao carregar dados do dashboard.');
      setActiveJobsCount(0);
      setTotalJobsCount(0);
      setViewsCount(0);
      setClicksCount(0);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Mostrar tela de carregamento enquanto verifica a sessão
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Company Dashboard | RemoteJobsBR</title>
      </Head>
      
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <Link href="/" className="text-blue-600 text-xl font-bold hover:text-blue-700">
                    RemoteJobsBR
                  </Link>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <Link href="/recruiter/dashboard" className="border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                    Dashboard
                  </Link>
                  <Link href="/recruiter/dashboard/jobs" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                    Manage Jobs
                  </Link>
                </div>
              </div>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-sm text-gray-500 mr-4">
                    {session?.user?.email}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </nav>
        
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {showSuccessMessage && (
            <div className="mb-6 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-sm">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm">
                    Login successful! Welcome to your company dashboard.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {statsError && (
            <div className="mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm">{statsError}</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg">
            <div className="p-6 bg-white border-b border-gray-200">
              <h1 className="text-2xl font-semibold text-gray-800">Company Dashboard</h1>
              <p className="mt-2 text-gray-600">Manage your jobs and applications efficiently.</p>
            </div>
            
            <div className="p-6">
              <div className="mt-8">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="bg-blue-50 overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                          <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">
                              Active Jobs
                            </dt>
                            <dd>
                              <div className="text-lg font-medium text-gray-900">
                                {isLoadingStats ? (
                                  <span className="animate-pulse h-5 w-8 bg-gray-300 inline-block rounded"></span>
                                ) : (
                                  activeJobsCount ?? 0
                                )}
                              </div>
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                    <div className="bg-blue-100 px-5 py-3">
                      <div className="text-sm">
                        <Link href="/recruiter/dashboard/jobs/new" className="font-medium text-blue-700 hover:text-blue-900">
                          Post a New Job
                        </Link>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                          <svg className="h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">
                              Job Views
                            </dt>
                            <dd>
                              <div className="text-lg font-medium text-gray-900">
                                {isLoadingStats ? (
                                  <span className="animate-pulse h-5 w-8 bg-gray-300 inline-block rounded"></span>
                                ) : (
                                  viewsCount ?? 0
                                )}
                              </div>
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                    <div className="bg-green-100 px-5 py-3">
                      <div className="text-sm">
                        <Link href="/recruiter/dashboard/jobs" className="font-medium text-green-700 hover:text-green-900">
                          Manage All Jobs ({totalJobsCount ?? 0})
                        </Link>
                      </div>
                    </div>
                  </div>
                  
                  {/* Card for Clicks Count */}
                  <div className="bg-purple-50 overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
                          {/* Click Icon (replace with actual icon if available) */}
                          <svg className="h-6 w-6 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                          </svg>
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">
                              Total Clicks
                            </dt>
                            <dd>
                              <div className="text-lg font-medium text-gray-900">
                                {isLoadingStats ? (
                                  <span className="animate-pulse h-5 w-8 bg-gray-300 inline-block rounded"></span>
                                ) : (
                                  clicksCount ?? 0
                                )}
                              </div>
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                    <div className="bg-purple-100 px-5 py-3">
                      <div className="text-sm">
                        <span className="font-medium text-purple-700">
                          Clicks on 'Apply'
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 