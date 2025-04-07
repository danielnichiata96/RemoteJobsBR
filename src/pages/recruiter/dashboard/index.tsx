import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';

export default function RecruiterDashboard(props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [publishedJobsCount, setPublishedJobsCount] = useState<number | null>(null);
  const [applicationsCount, setApplicationsCount] = useState<number | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
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
      const fetchStats = async () => {
        setIsLoadingStats(true);
        setStatsError(null);
        try {
          const response = await fetch('/api/recruiter/dashboard/stats');
          if (!response.ok) {
            throw new Error('Falha ao buscar estatísticas');
          }
          const data = await response.json();
          setPublishedJobsCount(data.publishedJobsCount);
          setApplicationsCount(data.applicationsCount);
        } catch (error: any) {
          console.error("Erro ao buscar stats:", error);
          setStatsError(error.message || 'Erro ao carregar dados do dashboard.');
          setPublishedJobsCount(0); // Define como 0 em caso de erro para não mostrar null
          setApplicationsCount(0);
        } finally {
          setIsLoadingStats(false);
        }
      };

      fetchStats();
    }
  }, [status, router, router.query.verified]);

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
        <title>Dashboard Recrutador | RemoteJobsBR</title>
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
                    Minhas Vagas
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
                    Login realizado com sucesso! Bem-vindo à sua área de recrutador.
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
              <h1 className="text-2xl font-semibold text-gray-800">Dashboard do Recrutador</h1>
              <p className="mt-2 text-gray-600">Gerencie suas vagas e candidaturas de forma simples e eficiente.</p>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <div className="bg-blue-50 overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                        <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Vagas Publicadas
                          </dt>
                          <dd>
                            <div className="text-lg font-medium text-gray-900">
                              {isLoadingStats ? (
                                <span className="animate-pulse h-5 w-8 bg-gray-300 inline-block rounded"></span>
                              ) : (
                                publishedJobsCount ?? 0
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
                        Publicar nova vaga
                      </Link>
                    </div>
                  </div>
                </div>
                
                <div className="bg-green-50 overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                        <svg className="h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Candidaturas Recebidas
                          </dt>
                          <dd>
                            <div className="text-lg font-medium text-gray-900">
                              {isLoadingStats ? (
                                <span className="animate-pulse h-5 w-8 bg-gray-300 inline-block rounded"></span>
                              ) : (
                                applicationsCount ?? 0
                              )}
                            </div>
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                  <div className="bg-green-100 px-5 py-3">
                    <div className="text-sm">
                      <Link href="/recruiter/dashboard/applications" className="font-medium text-green-700 hover:text-green-900">
                        Ver candidatos
                      </Link>
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