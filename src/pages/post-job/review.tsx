import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Layout from '../../components/common/Layout';
import { JobType, ExperienceLevel, Currency } from '@prisma/client';

// Componente para exibir um campo na revisão
const ReviewField = ({ label, value, isMultiline = false }: { label: string; value: string | number | undefined; isMultiline?: boolean }) => {
  if (value === null || value === undefined || value === '') return null;
  
  return (
    <div className="mb-4">
      <h4 className="text-sm font-medium text-gray-500">{label}</h4>
      {isMultiline ? (
        <div className="mt-1 text-gray-900 whitespace-pre-line">{value}</div>
      ) : (
        <div className="mt-1 text-gray-900">{value}</div>
      )}
    </div>
  );
};

interface JobData {
    title: string;
    description: string;
    requirements: string;
    responsibilities: string;
    benefits?: string;
    jobType: JobType;
    experienceLevel: ExperienceLevel;
    location: string;
    country: string;
    workplaceType?: string;
    skills: string;
    minSalary?: number | null;
    maxSalary?: number | null;
    currency?: Currency | null;
    salaryCycle?: string | null;
    showSalary?: boolean;
    applicationUrl?: string | null;
    applicationEmail?: string | null;
}

export default function ReviewJobPost(props) { // Add type annotation for props
  const { data: session, status } = useSession();
  const router = useRouter();
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    console.log('[Review Page Effect] Running effect. Status:', status); // Log status

    // Redirecionamento de segurança para login se não estiver autenticado
    if (status === 'unauthenticated') {
      console.log('[Review Page Effect] Status is unauthenticated, redirecting to login.');
      const currentPath = '/post-job/review';
      const loginUrl = `/login?type=recruiter&returnTo=${encodeURIComponent(currentPath)}`;
      router.push(loginUrl);
      return;
    }
    // Verificar se o usuário é um recrutador
    if (status === 'authenticated') {
        console.log('[Review Page Effect] Status is authenticated. Session:', session); // Log session
        if (session?.user?.role !== 'COMPANY') {
            console.log('[Review Page Effect] User role is not COMPANY, redirecting to convert page.');
            router.push(`/convert-to-recruiter?returnTo=${encodeURIComponent('/post-job/review')}`);
            return; // Redirects if logged in but NOT a COMPANY
        }
    }
    
    // Carregar dados do sessionStorage
    if (typeof window !== 'undefined' && status !== 'loading') {
      console.log('[Review Page Effect] Ready to load from sessionStorage.');
      const savedData = sessionStorage.getItem('draftJob');
      console.log('[Review Page Effect] sessionStorage.getItem("draftJob") result:', savedData); // Log sessionStorage result

      if (savedData) {
        try {
          console.log('[Review Page Effect] Found saved data, attempting to parse.');
          setJobData(JSON.parse(savedData));
          console.log('[Review Page Effect] Successfully parsed and set job data.');
        } catch (e) {
          console.error('[Review Page Effect] Error parsing saved data:', e);
          setError('Falha ao carregar os dados da vaga. Tente preencher novamente.');
        }
      } else {
        console.warn('[Review Page Effect] No draft job data found in sessionStorage.');
        // setError('Nenhum dado de rascunho encontrado. Por favor, preencha o formulário novamente.');
      }
      console.log('[Review Page Effect] Setting loading to false.');
      setLoading(false);
    } else {
       console.log('[Review Page Effect] Skipping sessionStorage load (window undefined or status is loading).');
    }
  }, [status, router, session]);
  
  // Função para formatar a faixa salarial
  const formatSalary = () => {
    if (!jobData) return '';
    
    const { minSalary, maxSalary, currency, salaryCycle } = jobData;
    
    if (!minSalary && !maxSalary) return 'Não informado';
    
    const currencySymbol: { [key in Currency]?: string } = {
      [Currency.USD]: '$',
      [Currency.BRL]: 'R$',
      [Currency.EUR]: '€'
    };
    
    const cycleText: { [key: string]: string } = {
      'YEAR': 'por ano',
      'MONTH': 'por mês',
      'HOUR': 'por hora',
      'DAY': 'por dia'
    };
    
    const symbol = currency ? currencySymbol[currency] || '' : '';
    const cycle = salaryCycle ? cycleText[salaryCycle] || '' : '';
    
    if (minSalary && maxSalary) {
      return `${symbol}${minSalary} - ${symbol}${maxSalary} ${cycle}`;
    } else if (minSalary) {
      return `A partir de ${symbol}${minSalary} ${cycle}`;
    } else if (maxSalary) {
      return `Até ${symbol}${maxSalary} ${cycle}`;
    }
    return '';
  };
  
  // Traduzir o tipo de trabalho
  const translateJobType = (type: JobType) => {
    const types: { [key in JobType]: string } = {
      [JobType.FULL_TIME]: 'Tempo Integral',
      [JobType.PART_TIME]: 'Meio Período',
      [JobType.CONTRACT]: 'Contrato',
      [JobType.INTERNSHIP]: 'Estágio',
      [JobType.FREELANCE]: 'Freelance'
    };
    return types[type] || type;
  };
  
  // Traduzir o nível de experiência
  const translateExperienceLevel = (level: ExperienceLevel) => {
    const levels: { [key in ExperienceLevel]: string } = {
      [ExperienceLevel.ENTRY]: 'Júnior',
      [ExperienceLevel.MID]: 'Pleno',
      [ExperienceLevel.SENIOR]: 'Sênior',
      [ExperienceLevel.LEAD]: 'Líder/Gerente'
    };
    return levels[level] || level;
  };
  
  const handleSubmit = async () => {
    if (!session || !jobData) return;
    
    setIsSubmitting(true);
    setError('');
    
    try {
      // Transformar os dados para o formato esperado pela API
      const apiJobData = {
        ...jobData,
        skills: jobData.skills.split(',').map((s: string) => s.trim()).filter(Boolean),
        tags: jobData.skills.split(',').map((s: string) => s.trim()).filter(Boolean),
        status: 'DRAFT',
        workplaceType: jobData.workplaceType || 'REMOTE',
        country: jobData.country || 'Global'
      };
      
      // Chamar a API existente para criar a vaga
      const response = await fetch('/api/recruiter/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiJobData),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar vaga');
      }
      
      // Limpar dados temporários
      sessionStorage.removeItem('draftJob');
      
      // Redirecionar para a página de pagamento
      router.push(`/post-job/payment?jobId=${result.job.id}`);
    } catch (error: any) {
      console.error('Erro:', error);
      setError(error.message || 'Ocorreu um erro ao processar sua solicitação.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (status === 'loading' || loading) {
    return (
      <Layout title="Carregando... | RemoteJobsBR">
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout title="Revisar Vaga | RemoteJobsBR">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-2">Revisar Detalhes da Vaga</h1>
        <p className="text-gray-600 mb-8">Confira os detalhes da sua vaga antes de continuar para o pagamento.</p>
        
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
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
        
        {jobData && (
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{jobData.title}</h2>
              
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  {translateJobType(jobData.jobType)}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  {translateExperienceLevel(jobData.experienceLevel)}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                  {jobData.location}
                </span>
              </div>
              
              <ReviewField label="Habilidades" value={jobData.skills || undefined} />
              {jobData.showSalary && (
                <ReviewField label="Faixa Salarial" value={formatSalary()} />
              )}
              
              <div className="mt-6 space-y-6">
                <ReviewField label="Descrição da Vaga" value={jobData.description || undefined} isMultiline={true} />
                <ReviewField label="Requisitos" value={jobData.requirements || undefined} isMultiline={true} />
                <ReviewField label="Responsabilidades" value={jobData.responsibilities || undefined} isMultiline={true} />
                <ReviewField label="Benefícios" value={jobData.benefits || undefined} isMultiline={true} />
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-medium mb-4">Informações para Candidatura</h3>
                <ReviewField label="URL para Candidatura" value={jobData.applicationUrl || undefined} />
                <ReviewField label="Email para Candidatura" value={jobData.applicationEmail || undefined} />
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 flex justify-between items-center">
              <button
                onClick={() => router.push('/post-job')}
                className="text-gray-700 hover:text-gray-900 font-medium"
              >
                ← Voltar e Editar
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`${
                  isSubmitting ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
                } text-white px-6 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processando...
                  </span>
                ) : (
                  'Continuar para Pagamento'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
