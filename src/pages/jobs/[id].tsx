import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Layout from '@/components/common/Layout';
import { Job, JobType, ExperienceLevel } from '@/types/job';
import WideJobCard from '@/components/jobs/WideJobCard';
import SaveJobButton from '@/components/jobs/SaveJobButton';

// Função para obter uma imagem padrão
function getDefaultLogo(companyName: string | any): string {
  if (!companyName) return '';
  
  // Se companyName for um objeto, usar o nome
  const name = typeof companyName === 'string' ? companyName : (companyName?.name || '');
  if (!name) return '';
  
  // Usar API token se disponível (como variável de ambiente)
  const apiToken = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN || '';
  const tokenParam = apiToken ? `?token=${apiToken}` : '';
  
  // Verificar se o nome da empresa contém um domínio
  const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
  
  // Se o nome parece ser um domínio, use-o diretamente
  if (domainPattern.test(name.toLowerCase())) {
    return `https://img.logo.dev/${name.toLowerCase()}${tokenParam}`;
  }
  
  // Caso contrário, adicione .com para tentar obter um logotipo genérico
  const formattedName = name.trim().toLowerCase().replace(/\s+/g, '') + '.com';
  return `https://img.logo.dev/${formattedName}${tokenParam}`;
}

// Função para buscar detalhes da vaga pelo ID
async function fetchJobById(id: string): Promise<Job | null> {
  try {
    // Extrair o ID interno da vaga
    let internalId = id;
    if (id.includes('_')) {
      // Se for um ID no formato 'provider_id', extrair o ID
      internalId = id.split('_')[1];
    }
    
    const response = await fetch(`/api/jobs/${internalId}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Falha ao buscar vaga' }));
      throw new Error(errorData.error || 'Falha ao buscar vaga');
    }
    
    const data = await response.json();
    
    // Se o ID original tiver um prefixo, garantir que o ID na resposta mantenha esse prefixo
    if (id !== internalId && data) {
      data.id = id; // Preservar o ID original com prefixo
    }
    
    return data;
  } catch (error) {
    console.error('Erro ao buscar vaga:', error);
    throw error;
  }
}

// Função para buscar vagas similares
async function fetchSimilarJobs(id: string): Promise<Job[]> {
  try {
    // Extrair o ID interno da vaga
    let internalId = id;
    if (id.includes('_')) {
      internalId = id.split('_')[1];
    }
    
    const response = await fetch(`/api/jobs/similar?id=${internalId}`);
    if (!response.ok) {
      console.warn('Falha ao buscar vagas similares:', response.status);
      return [];
    }
    
    const data = await response.json();
    
    // Para cada vaga similar, se o ID original tiver um prefixo, adicionar esse prefixo
    if (id !== internalId && data && Array.isArray(data)) {
      const prefix = id.split('_')[0];
      return data.map(job => ({
        ...job,
        id: job.id.includes('_') ? job.id : `${prefix}_${job.id}`
      }));
    }
    
    return data;
  } catch (error) {
    console.error('Erro ao buscar vagas similares:', error);
    return [];
  }
}

export default function JobDetail(props) {
  const router = useRouter();
  const { id } = router.query;
  const [job, setJob] = useState<Job | null>(null);
  const [similarJobs, setSimilarJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    // Não fazer nada se o roteamento não estiver pronto ou o ID não estiver disponível
    if (!router.isReady || !id) return;

    const loadJobDetails = async () => {
      setLoading(true);
      try {
        const jobData = await fetchJobById(id as string);
        if (jobData) {
          setJob(jobData);
          
          // Buscar vagas similares
          const similar = await fetchSimilarJobs(id as string);
          setSimilarJobs(similar);
        } else {
          setError('Vaga não encontrada');
        }
      } catch (err) {
        console.error('Erro ao carregar detalhes da vaga:', err);
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadJobDetails();
  }, [id, router.isReady]); // Adicionado router.isReady à lista de dependências

  const getFormattedDate = (date: Date | string) => {
    const dateObj = date instanceof Date ? date : new Date(date);
    return formatDistanceToNow(dateObj, { locale: ptBR, addSuffix: true });
  };

  if (loading) {
    return (
      <Layout title="Carregando... - RemoteJobsBR">
        <div className="container mx-auto px-4 py-16 text-center">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mx-auto mb-6"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto mb-12"></div>
            <div className="h-64 bg-gray-200 rounded w-full mx-auto mb-6"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !job) {
    return (
      <Layout title="Vaga não encontrada - RemoteJobsBR">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Vaga não encontrada</h1>
          <p className="text-gray-600 mb-8">
            {error || 'A vaga que você está procurando não existe ou foi removida.'}
          </p>
          <Link
            href="/jobs"
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-md font-medium transition duration-200"
          >
            Ver todas as vagas
          </Link>
        </div>
      </Layout>
    );
  }

  // Formatar dados da vaga
  const formatJobType = (type: string) => {
    const typeMap: Record<string, string> = {
      'full-time': 'Tempo Integral',
      'part-time': 'Meio Período',
      'contract': 'Contrato',
      'internship': 'Estágio',
      'freelance': 'Freelance',
      'FULL_TIME': 'Tempo Integral',
      'PART_TIME': 'Meio Período',
      'CONTRACT': 'Contrato',
      'INTERNSHIP': 'Estágio',
      'FREELANCE': 'Freelance'
    };
    return typeMap[type] || type;
  };

  const formatExperience = (level: string) => {
    const levelMap: Record<string, string> = {
      'entry-level': 'Júnior',
      'mid-level': 'Pleno',
      'senior-level': 'Sênior',
      'lead-level': 'Líder',
      'ENTRY': 'Júnior',
      'MID': 'Pleno',
      'SENIOR': 'Sênior',
      'LEAD': 'Líder'
    };
    return levelMap[level] || level;
  };
  
  // Obter o nome da empresa corretamente
  const companyName = typeof job.company === 'object' ? job.company.name : job.company;
  
  // Obter o logo da empresa corretamente
  const companyLogo = typeof job.company === 'object' 
    ? job.company.logo || job.company.image || getDefaultLogo(companyName)
    : job.companyLogo || getDefaultLogo(companyName);
  
  // Obter as tags corretamente
  const tags = job.tags || job.skills || [];

  return (
    <Layout title={`${job.title} - ${companyName} | RemoteJobsBR`}>
      <Head>
        <meta name="description" content={`${job.title} - ${companyName}. ${job.description.substring(0, 160)}...`} />
      </Head>

      <div className="bg-white">
        <div className="container mx-auto px-4 py-8">
          <button 
            onClick={() => {
              router.push({
                pathname: '/',
                query: { _t: Date.now() } // Adicionar timestamp para forçar recarregamento
              });
            }} 
            className="text-primary-600 hover:text-primary-800 flex items-center mb-6"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Voltar para a lista de vagas
          </button>
          
          <div className="bg-white p-6 rounded-lg shadow-md mb-8">
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="flex-shrink-0">
                {companyLogo && !imgError ? (
                  <div className="w-24 h-24 relative">
                    <Image 
                      src={companyLogo} 
                      alt={`${companyName} logo`}
                      width={80}
                      height={80}
                      className="object-contain rounded-md"
                      onError={() => setImgError(true)}
                    />
                  </div>
                ) : (
                  <div className="w-24 h-24 bg-gray-100 rounded-md flex items-center justify-center">
                    <span className="text-gray-500 font-bold text-3xl">
                      {companyName.charAt(0)}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex-grow">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {job.title}
                </h1>
                
                <p className="text-xl text-gray-700 mb-4">
                  {companyName}
                </p>
                
                <div className="flex flex-wrap gap-4 mb-6">
                  <div className="flex items-center text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{job.location}</span>
                  </div>
                  
                  <div className="flex items-center text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>{formatJobType(job.jobType)}</span>
                  </div>
                  
                  <div className="flex items-center text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>{formatExperience(job.experienceLevel)}</span>
                  </div>
                  
                  {job.salary && (
                    <div className="flex items-center text-gray-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{job.salary}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2 mb-6">
                  {tags.map((tag, index) => (
                    <span 
                      key={index}
                      className="bg-primary-50 text-primary-800 text-sm font-medium px-3 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                
                <div className="flex items-center text-gray-500 text-sm mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Publicada {getFormattedDate(job.createdAt)}</span>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  {job.applicationUrl ? (
                    <a
                      href={job.applicationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      Candidatar-se
                    </a>
                  ) : job.applicationEmail ? (
                    <a
                      href={`mailto:${job.applicationEmail}?subject=Candidatura para ${job.title}`}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      Candidatar-se por Email
                    </a>
                  ) : null}
                  
                  <SaveJobButton jobId={job.id} variant="outline" />
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Descrição da Vaga</h2>
                <div className="prose max-w-none">
                  <div 
                    className="prose prose-blue max-w-none text-gray-700 space-y-4"
                    dangerouslySetInnerHTML={{ __html: job.description }}
                  />
                </div>
              </div>
              
              {/* Mostrar outras seções se tiver os dados */}
              {job.responsibilities && (
                <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Responsabilidades</h2>
                  <div className="prose max-w-none">
                    <div 
                      className="prose prose-blue max-w-none text-gray-700 space-y-4"
                      dangerouslySetInnerHTML={{ __html: job.responsibilities }}
                    />
                  </div>
                </div>
              )}
              
              {job.requirements && (
                <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Requisitos</h2>
                  <div className="prose max-w-none">
                    <div 
                      className="prose prose-blue max-w-none text-gray-700 space-y-4"
                      dangerouslySetInnerHTML={{ __html: job.requirements }}
                    />
                  </div>
                </div>
              )}
              
              {job.benefits && (
                <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Benefícios</h2>
                  <div className="prose max-w-none">
                    <div 
                      className="prose prose-blue max-w-none text-gray-700 space-y-4"
                      dangerouslySetInnerHTML={{ __html: job.benefits }}
                    />
                  </div>
                </div>
              )}
            </div>
            
            <div>
              <div className="bg-white p-6 rounded-lg shadow-md mb-8 sticky top-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Sobre a Empresa</h2>
                
                <div>
                  <h3 className="font-bold text-gray-800 mb-4">{companyName}</h3>
                  
                  <div className="flex items-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-gray-600">{job.location}</span>
                  </div>
                  
                  <div className="mt-4">
                    {job.applicationUrl ? (
                      <a 
                        href={job.applicationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-md font-medium transition duration-200 block text-center"
                      >
                        Candidatar-se
                      </a>
                    ) : job.applicationEmail ? (
                      <a 
                        href={`mailto:${job.applicationEmail}?subject=Candidatura para ${job.title}`}
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-md font-medium transition duration-200 block text-center"
                      >
                        Candidatar-se por Email
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {similarJobs.length > 0 && (
            <div className="mt-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Vagas Semelhantes</h2>
              
              <div className="space-y-6">
                {similarJobs.map((job) => (
                  <WideJobCard key={job.id} job={job} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
} 