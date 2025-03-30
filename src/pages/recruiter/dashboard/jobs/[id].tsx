import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';

// Interface para o tipo de vaga
interface Job {
  id: string;
  title: string;
  description: string;
  requirements: string;
  responsibilities: string;
  benefits?: string;
  jobType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'FREELANCE';
  experienceLevel: 'ENTRY' | 'MID' | 'SENIOR' | 'LEAD';
  skills: string[];
  tags: string[];
  location: string;
  country: string;
  workplaceType: string;
  minSalary?: number;
  maxSalary?: number;
  currency?: 'USD' | 'EUR' | 'BRL';
  salaryCycle?: string;
  showSalary: boolean;
  status: 'ACTIVE' | 'DRAFT' | 'PAUSED' | 'CLOSED' | 'FILLED';
  visas: string[];
  languages: string[];
  applicationUrl?: string;
  applicationEmail?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  expiresAt?: string;
  viewCount: number;
  applicantCount: number;
  _count?: {
    applications: number;
    savedBy: number;
  };
}

// Interface para estatísticas
interface JobStats {
  viewsToday: number;
  views7Days: number;
  applicationsByDay: Array<{
    createdAt: string;
    _count: number;
  }>;
}

export default function JobDetails(props) {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const { id } = router.query;
  
  const [job, setJob] = useState<Job | null>(null);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Verificar se o usuário está autenticado
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/auth/recruiter');
    }

    if (sessionStatus === 'authenticated' && id) {
      fetchJobDetails();
    }
  }, [sessionStatus, router, id]);

  // Função para buscar detalhes da vaga
  const fetchJobDetails = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/recruiter/jobs/${id}`);
      
      if (!response.ok) {
        throw new Error('Falha ao carregar detalhes da vaga');
      }
      
      const data = await response.json();
      setJob(data.job);
      setStats(data.stats);
    } catch (error) {
      console.error('Erro ao buscar detalhes da vaga:', error);
      setError('Não foi possível carregar os detalhes da vaga. Tente novamente mais tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  // Função para atualizar o status da vaga
  const updateJobStatus = async (newStatus: 'ACTIVE' | 'DRAFT' | 'PAUSED' | 'CLOSED' | 'FILLED') => {
    if (!job) return;
    
    try {
      setIsSaving(true);
      setError('');
      setSuccessMessage('');
      
      const response = await fetch(`/api/recruiter/jobs/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao atualizar status da vaga');
      }
      
      setJob(prevJob => {
        if (!prevJob) return null;
        return { ...prevJob, status: newStatus };
      });
      
      // Mensagem de sucesso baseada no novo status
      const statusMessages = {
        ACTIVE: 'Vaga publicada com sucesso!',
        DRAFT: 'Vaga movida para rascunhos.',
        PAUSED: 'Vaga pausada com sucesso.',
        CLOSED: 'Vaga encerrada.',
        FILLED: 'Vaga marcada como preenchida.'
      };
      
      setSuccessMessage(statusMessages[newStatus]);
      
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      setError(error.message || 'Ocorreu um erro ao atualizar o status da vaga');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Função para excluir a vaga
  const deleteJob = async () => {
    if (!job) return;
    
    try {
      setIsSaving(true);
      setError('');
      setSuccessMessage('');
      
      const response = await fetch(`/api/recruiter/jobs/${id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao excluir a vaga');
      }
      
      setSuccessMessage('Vaga excluída com sucesso.');
      setTimeout(() => {
        router.push('/recruiter/dashboard/jobs');
      }, 2000);
      
    } catch (error: any) {
      console.error('Erro ao excluir vaga:', error);
      setError(error.message || 'Ocorreu um erro ao excluir a vaga');
    } finally {
      setIsSaving(false);
      setShowDeleteConfirm(false);
    }
  };
  
  // Helper para formatar o tipo de vaga
  const formatJobType = (type: string) => {
    const types: Record<string, string> = {
      'FULL_TIME': 'Tempo Integral',
      'PART_TIME': 'Meio Período',
      'CONTRACT': 'Contrato',
      'INTERNSHIP': 'Estágio',
      'FREELANCE': 'Freelance'
    };
    return types[type] || type;
  };
  
  // Helper para formatar o nível de experiência
  const formatExperienceLevel = (level: string) => {
    const levels: Record<string, string> = {
      'ENTRY': 'Júnior',
      'MID': 'Pleno',
      'SENIOR': 'Sênior',
      'LEAD': 'Líder/Gerente'
    };
    return levels[level] || level;
  };
  
  // Helper para formatar o status da vaga
  const formatStatus = (status: string) => {
    const statuses: Record<string, string> = {
      'ACTIVE': 'Ativa',
      'DRAFT': 'Rascunho',
      'PAUSED': 'Pausada',
      'CLOSED': 'Encerrada',
      'FILLED': 'Preenchida'
    };
    return statuses[status] || status;
  };
  
  // Helper para obter classe CSS baseada no status
  const getStatusClass = (status: string) => {
    const classes: Record<string, string> = {
      'ACTIVE': 'bg-green-100 text-green-800',
      'DRAFT': 'bg-yellow-100 text-yellow-800',
      'PAUSED': 'bg-gray-100 text-gray-800',
      'CLOSED': 'bg-red-100 text-red-800',
      'FILLED': 'bg-blue-100 text-blue-800'
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
  };

  // Mostrar tela de carregamento enquanto verifica a sessão
  if (sessionStatus === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{job?.title || 'Detalhes da Vaga'} | RemoteJobsBR</title>
      </Head>
      
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <span className="text-blue-600 text-xl font-bold">RemoteJobsBR</span>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <Link href="/recruiter/dashboard" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                    Dashboard
                  </Link>
                  <Link href="/recruiter/dashboard/jobs" className="border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                    Minhas Vagas
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>
        
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {/* Cabeçalho */}
          <div className="md:flex md:items-center md:justify-between mb-6">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                {job?.title || 'Detalhes da Vaga'}
              </h2>
              {job && (
                <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:mt-0 sm:space-x-6">
                  <div className="mt-2 flex items-center text-sm text-gray-500">
                    <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                      <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" />
                    </svg>
                    {formatJobType(job.jobType)}
                  </div>
                  <div className="mt-2 flex items-center text-sm text-gray-500">
                    <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    {job.location}
                  </div>
                  <div className="mt-2 flex items-center text-sm text-gray-500">
                    <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                    </svg>
                    {formatExperienceLevel(job.experienceLevel)}
                  </div>
                  <div className="mt-2 flex items-center text-sm text-gray-500">
                    <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    Criada em {new Date(job.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                  <div className="mt-2">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(job.status)}`}>
                      {formatStatus(job.status)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-4 flex md:mt-0 md:ml-4">
              <Link 
                href="/recruiter/dashboard/jobs" 
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Voltar
              </Link>
              
              {job && job.status === 'DRAFT' && (
                <button
                  type="button"
                  onClick={() => updateJobStatus('ACTIVE')}
                  disabled={isSaving}
                  className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  {isSaving ? 'Publicando...' : 'Publicar Vaga'}
                </button>
              )}
              
              {job && job.status === 'ACTIVE' && (
                <button
                  type="button"
                  onClick={() => updateJobStatus('PAUSED')}
                  disabled={isSaving}
                  className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
                >
                  {isSaving ? 'Processando...' : 'Pausar Vaga'}
                </button>
              )}
              
              {job && job.status === 'PAUSED' && (
                <button
                  type="button"
                  onClick={() => updateJobStatus('ACTIVE')}
                  disabled={isSaving}
                  className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  {isSaving ? 'Processando...' : 'Reativar Vaga'}
                </button>
              )}
              
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Editar
              </button>
            </div>
          </div>
          
          {/* Mensagens de erro e sucesso */}
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          {successMessage && (
            <div className="mb-4 bg-green-50 border-l-4 border-green-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">{successMessage}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Modal de confirmação de exclusão */}
          {showDeleteConfirm && (
            <div className="fixed z-10 inset-0 overflow-y-auto">
              <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                  <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                </div>
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                  <div>
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                      <svg className="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="mt-3 text-center sm:mt-5">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Excluir vaga
                      </h3>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          Tem certeza que deseja excluir esta vaga? Esta ação não pode ser desfeita.
                          {job?._count?.applications && job._count.applications > 0 && (
                            <span className="block mt-2 font-semibold">
                              Esta vaga possui {job._count.applications} candidatura(s). Ela será marcada como "Encerrada" em vez de ser excluída.
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                    <button
                      type="button"
                      onClick={deleteJob}
                      disabled={isSaving}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:col-start-2 sm:text-sm"
                    >
                      {isSaving ? 'Processando...' : 'Excluir'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Conteúdo da Vaga */}
          {job && !isEditing && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Coluna da esquerda - Detalhes da Vaga */}
              <div className="lg:col-span-2">
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Detalhes da Vaga</h3>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Excluir Vaga
                    </button>
                  </div>
                  <div className="border-t border-gray-200">
                    <dl>
                      <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Título</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{job.title}</dd>
                      </div>
                      <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Tipo de Contrato</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{formatJobType(job.jobType)}</dd>
                      </div>
                      <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Nível de Experiência</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{formatExperienceLevel(job.experienceLevel)}</dd>
                      </div>
                      <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Localização</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{job.location}</dd>
                      </div>
                      <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">País</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{job.country}</dd>
                      </div>
                      <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Modelo de Trabalho</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          {job.workplaceType === 'remote' ? 'Remoto' : 
                           job.workplaceType === 'hybrid' ? 'Híbrido' : 'Presencial'}
                        </dd>
                      </div>
                      <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Habilidades</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          <div className="flex flex-wrap gap-2">
                            {job.skills.map((skill, index) => (
                              <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </dd>
                      </div>
                      <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Descrição</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 whitespace-pre-line">{job.description}</dd>
                      </div>
                      <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Requisitos</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 whitespace-pre-line">{job.requirements}</dd>
                      </div>
                      {job.responsibilities && (
                        <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500">Responsabilidades</dt>
                          <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 whitespace-pre-line">{job.responsibilities}</dd>
                        </div>
                      )}
                      {job.benefits && (
                        <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500">Benefícios</dt>
                          <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 whitespace-pre-line">{job.benefits}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
              </div>
              
              {/* Coluna da direita - Estatísticas e Ações */}
              <div className="lg:col-span-1">
                <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
                  <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Estatísticas</h3>
                  </div>
                  <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
                    <dl className="sm:divide-y sm:divide-gray-200">
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-2 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Visualizações Hoje</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:text-right">{stats?.viewsToday || 0}</dd>
                      </div>
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-2 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Visualizações (7 dias)</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:text-right">{stats?.views7Days || 0}</dd>
                      </div>
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-2 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Total de Visualizações</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:text-right">{job.viewCount}</dd>
                      </div>
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-2 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Candidaturas</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:text-right">{job.applicantCount}</dd>
                      </div>
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-2 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Criada em</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:text-right">
                          {new Date(job.createdAt).toLocaleDateString('pt-BR')}
                        </dd>
                      </div>
                      {job.publishedAt && (
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-2 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500">Publicada em</dt>
                          <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:text-right">
                            {new Date(job.publishedAt).toLocaleDateString('pt-BR')}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
                
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Ações</h3>
                  </div>
                  <div className="border-t border-gray-200 px-4 py-5">
                    <div className="space-y-3">
                      {job.status === 'DRAFT' && (
                        <button
                          type="button"
                          onClick={() => updateJobStatus('ACTIVE')}
                          disabled={isSaving}
                          className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                          <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Publicar Vaga
                        </button>
                      )}
                      
                      {job.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => updateJobStatus('PAUSED')}
                          disabled={isSaving}
                          className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                        >
                          <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Pausar Vaga
                        </button>
                      )}
                      
                      {job.status === 'PAUSED' && (
                        <button
                          type="button"
                          onClick={() => updateJobStatus('ACTIVE')}
                          disabled={isSaving}
                          className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                          <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                          </svg>
                          Reativar Vaga
                        </button>
                      )}
                      
                      {(job.status === 'ACTIVE' || job.status === 'PAUSED') && (
                        <button
                          type="button"
                          onClick={() => updateJobStatus('FILLED')}
                          disabled={isSaving}
                          className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                          </svg>
                          Marcar como Preenchida
                        </button>
                      )}
                      
                      {(job.status === 'ACTIVE' || job.status === 'PAUSED') && (
                        <button
                          type="button"
                          onClick={() => updateJobStatus('CLOSED')}
                          disabled={isSaving}
                          className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          Encerrar Vaga
                        </button>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                        Editar Vaga
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <svg className="-ml-1 mr-2 h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Excluir Vaga
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
} 