import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Job, JobType, ExperienceLevel } from '@/types/models';

// Função para formatar salário
const formatSalary = (min?: number, max?: number, currency?: string, cycle?: string) => {
  if (!min && !max) return 'Salário não informado';
  
  const formatValue = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  let result = '';
  if (min && max) {
    result = `${formatValue(min)} - ${formatValue(max)}`;
  } else if (min) {
    result = `A partir de ${formatValue(min)}`;
  } else if (max) {
    result = `Até ${formatValue(max)}`;
  }
  
  if (cycle) {
    const cycleMap: Record<string, string> = {
      'hourly': '/hora',
      'monthly': '/mês',
      'yearly': '/ano'
    };
    result += ` ${cycleMap[cycle] || ''}`;
  }
  
  return result;
};

// Função para formatar tipo de trabalho
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

// Função para formatar nível de experiência
const formatExperience = (level: ExperienceLevel) => {
  const levelMap: Record<string, string> = {
    'ENTRY': 'Júnior',
    'MID': 'Pleno',
    'SENIOR': 'Sênior',
    'LEAD': 'Líder'
  };
  return levelMap[level] || level;
};

interface WideJobCardProps {
  job: Job;
  showCompanyInfo?: boolean;
}

export default function WideJobCard({ job, showCompanyInfo = true }: WideJobCardProps) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white hover:shadow-lg transition-shadow duration-300 w-full">
      <Link href={`/jobs/${job.id}`} className="flex flex-col md:flex-row p-6 gap-6">
        {/* Logo da empresa */}
        <div className="flex-shrink-0 flex items-center justify-center">
          {job.company?.logo ? (
            <div className="w-20 h-20 relative">
              <Image 
                src={job.company.logo} 
                alt={`${job.company.name} logo`}
                fill
                className="object-contain rounded-md"
              />
            </div>
          ) : (
            <div className="w-20 h-20 bg-gray-100 rounded-md flex items-center justify-center">
              <span className="text-gray-500 font-bold text-2xl">
                {job.company?.name.charAt(0) || 'C'}
              </span>
            </div>
          )}
        </div>
        
        {/* Informações da vaga */}
        <div className="flex-grow">
          <h2 className="text-xl font-semibold text-gray-900 hover:text-primary-600 transition-colors mb-1">
            {job.title}
          </h2>
          
          {showCompanyInfo && (
            <p className="text-gray-700 mb-2">
              {job.company?.name || 'Empresa Confidencial'} · {job.location}
            </p>
          )}
          
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="bg-primary-50 text-primary-800 text-xs font-medium px-2.5 py-1 rounded">
              {formatJobType(job.jobType)}
            </span>
            
            <span className="bg-primary-50 text-primary-800 text-xs font-medium px-2.5 py-1 rounded">
              {formatExperience(job.experienceLevel)}
            </span>
            
            {job.workplaceType && (
              <span className="bg-primary-50 text-primary-800 text-xs font-medium px-2.5 py-1 rounded">
                {job.workplaceType === 'remote' ? 'Remoto' : 
                 job.workplaceType === 'hybrid' ? 'Híbrido' : 'Presencial'}
              </span>
            )}
          </div>
          
          {/* Skills/Tags */}
          {job.skills && job.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {job.skills.slice(0, 6).map((skill, index) => (
                <span 
                  key={index}
                  className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-1 rounded"
                >
                  {skill}
                </span>
              ))}
              {job.skills.length > 6 && (
                <span className="text-xs text-gray-500 px-2 flex items-center">
                  +{job.skills.length - 6} mais
                </span>
              )}
            </div>
          )}
          
          {/* Descrição resumida */}
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">
            {job.description.substring(0, 180)}
            {job.description.length > 180 ? '...' : ''}
          </p>
          
          {/* Rodapé com salário e data */}
          <div className="flex flex-wrap justify-between items-center mt-auto">
            {job.showSalary && (job.minSalary || job.maxSalary) ? (
              <p className="text-gray-900 font-medium">
                {formatSalary(job.minSalary, job.maxSalary, job.currency, job.salaryCycle)}
              </p>
            ) : (
              <div></div> // Espaço em branco para manter o layout
            )}
            
            <div className="flex items-center">
              <span className="text-xs text-gray-500 mr-3">
                {job.publishedAt 
                  ? `Publicada há ${formatDistanceToNow(new Date(job.publishedAt), { locale: ptBR, addSuffix: false })}`
                  : `Criada há ${formatDistanceToNow(new Date(job.createdAt), { locale: ptBR, addSuffix: false })}`
                }
              </span>
              <span className="text-primary-600 font-medium text-sm hover:underline">
                Ver detalhes
              </span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
} 