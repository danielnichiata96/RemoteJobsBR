import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '@/components/common/Layout';
import { Job } from '@prisma/client';

type SavedJobWithDetails = {
  id: string;
  jobId: string;
  candidateId: string;
  createdAt: string;
  job: Job;
};

export default function SavedJobs(props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [savedJobs, setSavedJobs] = useState<SavedJobWithDetails[]>([]);
  const [error, setError] = useState('');
  
  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?returnTo=/saved-jobs');
    }
  }, [status, router]);

  // Fetch saved jobs
  useEffect(() => {
    if (session?.user) {
      fetchSavedJobs();
    }
  }, [session]);

  const fetchSavedJobs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/jobs/saved');
      
      if (!response.ok) {
        throw new Error('Falha ao carregar vagas salvas');
      }
      
      const data = await response.json();
      setSavedJobs(data);
    } catch (error) {
      console.error('Erro ao buscar vagas salvas:', error);
      setError('Erro ao carregar suas vagas salvas. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const removeSavedJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/saved/${jobId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Falha ao remover vaga salva');
      }
      
      // Remove from local state
      setSavedJobs(current => current.filter(job => job.jobId !== jobId));
    } catch (error) {
      console.error('Erro ao remover vaga salva:', error);
      setError('Erro ao remover a vaga salva. Tente novamente.');
    }
  };

  // Show loading state
  if (status === 'loading' || isLoading) {
    return (
      <Layout title="Vagas Salvas | RemoteJobsBR">
        <div className="min-h-screen bg-gray-50 py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-center pt-16">
              <p className="text-lg text-gray-600">Carregando...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Redirect via useEffect if not authenticated
  if (!session) {
    return null;
  }

  return (
    <Layout title="Vagas Salvas | RemoteJobsBR">
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="pb-5 border-b border-gray-200 mb-8">
            <h1 className="text-3xl font-bold leading-tight text-gray-900">Vagas Salvas</h1>
            <p className="mt-2 text-sm text-gray-500">
              Gerencie as vagas que você salvou para visualizar mais tarde.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {savedJobs.length === 0 ? (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg p-10 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma vaga salva</h3>
              <p className="mt-1 text-sm text-gray-500">
                Você ainda não salvou nenhuma vaga. Comece a explorar oportunidades.
              </p>
              <div className="mt-6">
                <Link
                  href="/jobs"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Explorar Vagas
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <ul className="divide-y divide-gray-200">
                {savedJobs.map((savedJob) => (
                  <li key={savedJob.id} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col flex-grow sm:flex-row sm:items-center">
                        <div className="flex-grow">
                          <h3 className="text-lg font-medium text-primary-600 hover:text-primary-700">
                            <Link href={`/jobs/${savedJob.jobId}`}>
                              {savedJob.job.title}
                            </Link>
                          </h3>
                          <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:mt-0 sm:space-x-6">
                            <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                              <svg
                                className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              {savedJob.job.companyName || "Empresa"}
                            </div>
                            <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                              <svg
                                className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              {savedJob.job.location}
                            </div>
                            <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                              <svg
                                className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z"
                                  clipRule="evenodd"
                                />
                                <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" />
                              </svg>
                              {savedJob.job.jobType}
                            </div>
                          </div>
                          <div className="mt-2 flex items-center text-sm text-gray-500">
                            <span className="mr-1.5">Salvo em:</span>
                            {new Date(savedJob.createdAt).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                        <div className="flex-shrink-0 mt-4 sm:mt-0 sm:ml-5">
                          <div className="flex space-x-2">
                            <Link
                              href={`/jobs/${savedJob.jobId}`}
                              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            >
                              Ver Vaga
                            </Link>
                            <button
                              onClick={() => removeSavedJob(savedJob.jobId)}
                              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
} 