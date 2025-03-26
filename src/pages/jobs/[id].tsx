import { useState } from 'react';
import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Layout from '@/components/common/Layout';
import WideJobCard from '@/components/jobs/WideJobCard';
import { Job, JobType, ExperienceLevel } from '@/types/models';
import { MOCK_JOBS } from '@/pages/index';

interface JobDetailProps {
  job: Job;
  similarJobs: Job[];
}

export default function JobDetail({ job, similarJobs }: JobDetailProps) {
  const router = useRouter();
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Redirecionamento ou fallback para página 404 se a vaga não for encontrada
  if (router.isFallback) {
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

  if (!job) {
    return (
      <Layout title="Vaga não encontrada - RemoteJobsBR">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Vaga não encontrada</h1>
          <p className="text-gray-600 mb-8">A vaga que você está procurando não existe ou foi removida.</p>
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
  const formatJobType = (type: JobType) => {
    const typeMap: Record<string, string> = {
      'FULL_TIME': 'Tempo Integral',
      'PART_TIME': 'Meio Período',
      'CONTRACT': 'Contrato',
      'INTERNSHIP': 'Estágio',
      'FREELANCE': 'Freelance'
    };
    return typeMap[type] || type;
  };

  const formatExperience = (level: ExperienceLevel) => {
    const levelMap: Record<string, string> = {
      'ENTRY': 'Júnior',
      'MID': 'Pleno',
      'SENIOR': 'Sênior',
      'LEAD': 'Líder'
    };
    return levelMap[level] || level;
  };

  const formatSalary = () => {
    if (!job.showSalary || (!job.minSalary && !job.maxSalary)) {
      return 'Não informado';
    }

    const formatValue = (value: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: job.currency || 'BRL',
        maximumFractionDigits: 0,
      }).format(value);
    };
    
    let result = '';
    if (job.minSalary && job.maxSalary) {
      result = `${formatValue(job.minSalary)} - ${formatValue(job.maxSalary)}`;
    } else if (job.minSalary) {
      result = `A partir de ${formatValue(job.minSalary)}`;
    } else if (job.maxSalary) {
      result = `Até ${formatValue(job.maxSalary)}`;
    }
    
    if (job.salaryCycle) {
      const cycleMap: Record<string, string> = {
        'hourly': '/hora',
        'monthly': '/mês',
        'yearly': '/ano'
      };
      result += ` ${cycleMap[job.salaryCycle] || ''}`;
    }
    
    return result;
  };

  const formatDate = (date: Date) => {
    return format(new Date(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  // Funções para lidar com o formulário de aplicação
  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setSubmitting(true);
    setMessage(null);
    
    try {
      // Simulação de API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulação de resposta bem-sucedida
      setMessage({
        type: 'success',
        text: 'Candidatura enviada com sucesso! Em breve a empresa entrará em contato.'
      });
      
      // Limpar formulário
      setCoverLetter('');
      setResumeUrl('');
      
      // Fechar formulário após um tempo
      setTimeout(() => {
        setShowApplicationForm(false);
      }, 3000);
      
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Ocorreu um erro ao enviar sua candidatura. Por favor, tente novamente.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout title={`${job.title} - ${job.company?.name || 'Empresa'} | RemoteJobsBR`}>
      <Head>
        <meta name="description" content={`${job.title} - ${job.company?.name}. ${job.description.substring(0, 160)}...`} />
      </Head>

      <div className="bg-white">
        <div className="container mx-auto px-4 py-8">
          <Link href="/jobs" className="text-primary-600 hover:text-primary-800 flex items-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Voltar para a lista de vagas
          </Link>
          
          <div className="bg-white p-6 rounded-lg shadow-md mb-8">
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="flex-shrink-0">
                {job.company?.logo ? (
                  <div className="w-24 h-24 relative">
                    <Image 
                      src={job.company.logo} 
                      alt={`${job.company.name} logo`}
                      fill
                      className="object-contain rounded-md"
                    />
                  </div>
                ) : (
                  <div className="w-24 h-24 bg-gray-100 rounded-md flex items-center justify-center">
                    <span className="text-gray-500 font-bold text-3xl">
                      {job.company?.name.charAt(0) || 'C'}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex-grow">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {job.title}
                </h1>
                
                <p className="text-xl text-gray-700 mb-4">
                  {job.company?.name || 'Empresa Confidencial'}
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
                  
                  <div className="flex items-center text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{formatSalary()}</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-6">
                  {job.skills.map((skill, index) => (
                    <span 
                      key={index}
                      className="bg-primary-50 text-primary-800 text-sm font-medium px-3 py-1 rounded-full"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
                
                <div className="flex items-center text-gray-500 text-sm mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Publicada em {job.publishedAt ? formatDate(job.publishedAt) : formatDate(job.createdAt)}</span>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setShowApplicationForm(true)}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-md font-medium transition duration-200"
                  >
                    Candidatar-se
                  </button>
                  
                  <button
                    className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-2 rounded-md font-medium transition duration-200 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    Salvar Vaga
                  </button>
                  
                  <button
                    className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-2 rounded-md font-medium transition duration-200 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Compartilhar
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {showApplicationForm && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Candidate-se para {job.title}</h2>
              
              <form onSubmit={handleApply}>
                <div className="mb-4">
                  <label htmlFor="coverLetter" className="block text-gray-700 font-medium mb-2">
                    Carta de Apresentação
                  </label>
                  <textarea
                    id="coverLetter"
                    rows={6}
                    className="w-full border border-gray-300 rounded-md px-4 py-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Descreva por que você é a pessoa certa para essa vaga..."
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    required
                  ></textarea>
                </div>
                
                <div className="mb-6">
                  <label htmlFor="resume" className="block text-gray-700 font-medium mb-2">
                    Link para seu currículo (LinkedIn, Google Drive, etc)
                  </label>
                  <input
                    type="url"
                    id="resume"
                    className="w-full border border-gray-300 rounded-md px-4 py-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="https://..."
                    value={resumeUrl}
                    onChange={(e) => setResumeUrl(e.target.value)}
                    required
                  />
                </div>
                
                {message && (
                  <div className={`p-4 mb-6 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    {message.text}
                  </div>
                )}
                
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowApplicationForm(false)}
                    className="mr-3 text-gray-700 hover:text-gray-900 font-medium"
                    disabled={submitting}
                  >
                    Cancelar
                  </button>
                  
                  <button
                    type="submit"
                    className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-md font-medium transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={submitting}
                  >
                    {submitting ? 'Enviando...' : 'Enviar Candidatura'}
                  </button>
                </div>
              </form>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Descrição da Vaga</h2>
                <div className="prose max-w-none">
                  <p className="whitespace-pre-line mb-6">{job.description}</p>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Responsabilidades</h2>
                <div className="prose max-w-none">
                  <p className="whitespace-pre-line mb-6">{job.responsibilities}</p>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Requisitos</h2>
                <div className="prose max-w-none">
                  <p className="whitespace-pre-line mb-6">{job.requirements}</p>
                </div>
              </div>
              
              {job.benefits && (
                <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Benefícios</h2>
                  <div className="prose max-w-none">
                    <p className="whitespace-pre-line">{job.benefits}</p>
                  </div>
                </div>
              )}
            </div>
            
            <div>
              <div className="bg-white p-6 rounded-lg shadow-md mb-8 sticky top-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Sobre a Empresa</h2>
                
                {job.company && (
                  <div>
                    <h3 className="font-bold text-gray-800 mb-2">{job.company.name}</h3>
                    
                    <div className="flex items-center mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-gray-600">{job.country}</span>
                    </div>
                    
                    {job.company.website && (
                      <a 
                        href={job.company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-800 flex items-center mb-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                        Website da Empresa
                      </a>
                    )}
                    
                    <div className="mt-4">
                      <button
                        onClick={() => setShowApplicationForm(true)}
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-md font-medium transition duration-200"
                      >
                        Candidatar-se
                      </button>
                    </div>
                  </div>
                )}
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

export const getStaticPaths: GetStaticPaths = async () => {
  // Em um cenário real, buscaríamos as vagas mais populares 
  // ou recentes para pre-render
  const paths = MOCK_JOBS.map((job) => ({
    params: { id: job.id },
  }));

  return { paths, fallback: true };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const jobId = params?.id as string;

  // Em um cenário real, buscaríamos do banco de dados
  const job = MOCK_JOBS.find((job) => job.id === jobId);
  
  // Se não encontrar a vaga, retorna 404
  if (!job) {
    return {
      notFound: true,
    };
  }

  // Buscamos vagas similares baseadas em skills ou categorias
  const similarJobs = MOCK_JOBS
    .filter((j) => 
      j.id !== job.id && 
      (j.experienceLevel === job.experienceLevel || 
        j.skills.some(skill => job.skills.includes(skill)))
    )
    .slice(0, 3);

  return {
    props: {
      job,
      similarJobs,
    },
    // Revalidar a cada 1 hora
    revalidate: 3600,
  };
}; 