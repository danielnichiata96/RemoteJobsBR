import Link from 'next/link';
import Image from 'next/image';
import { Job } from '@/types/job';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';

interface JobCardProps {
  job: Job;
}

export default function JobCard({ job }: JobCardProps) {
  const [imgError, setImgError] = useState(false);
  
  // Função para obter um logo padrão do logo.dev com base no nome da empresa
  const getLogoFromCompanyName = (companyName: string): string => {
    // Usar API token se disponível
    const apiToken = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN || '';
    const tokenParam = apiToken ? `?token=${apiToken}` : '';
    
    // Verificar se o nome da empresa contém um domínio
    const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    
    // Se o nome parece ser um domínio, use-o diretamente
    if (domainPattern.test(companyName.toLowerCase())) {
      return `https://img.logo.dev/${companyName.toLowerCase()}${tokenParam}`;
    }
    
    // Caso contrário, adicione .com para tentar obter um logotipo genérico
    // Este é um fallback, pois o Logo.dev funciona melhor com domínios
    const formattedName = companyName.trim().toLowerCase().replace(/\s+/g, '') + '.com';
    return `https://img.logo.dev/${formattedName}${tokenParam}`;
  };
  
  // Determinar o logo a ser usado
  let companyName = '';
  if (typeof job.company === 'string') {
    companyName = job.company;
  } else if (job.company && typeof job.company === 'object') {
    companyName = job.company.name || 'Empresa';
  } else {
    companyName = 'Empresa';
  }
  
  let companyLogo = job.companyLogo;
  
  if (!companyLogo) {
    companyLogo = getLogoFromCompanyName(companyName);
  }
  
  // Função para garantir que temos um objeto Date válido
  const getFormattedDate = (date: Date | string) => {
    const dateObj = date instanceof Date ? date : new Date(date);
    return formatDistanceToNow(dateObj, { locale: ptBR, addSuffix: false });
  };

  return (
    <div className="card hover:shadow-lg transition-shadow duration-200">
      <div className="flex items-start">
        {companyLogo && !imgError ? (
          <div className="flex-shrink-0 mr-4">
            <Image 
              src={companyLogo} 
              alt={`${companyName} logo`}
              width={60}
              height={60}
              className="rounded-md"
              onError={() => setImgError(true)}
            />
          </div>
        ) : (
          <div className="flex-shrink-0 mr-4 w-[60px] h-[60px] bg-gray-200 rounded-md flex items-center justify-center">
            <span className="text-gray-500 font-bold text-xl">
              {companyName.charAt(0)}
            </span>
          </div>
        )}
        
        <div className="flex-1">
          <Link href={`/jobs/${job.id.replace('greenhouse_', '')}`}>
            <h3 className="text-xl font-semibold text-primary-700 hover:text-primary-800 mb-1">
              {job.title}
            </h3>
          </Link>
          
          <div className="flex items-center gap-2 mb-2">
            <p className="text-gray-700">{companyName}</p>
            {job.companyVerified && (
              <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            {job.source !== 'direct' && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                via {job.source}
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded">
              {job.location}
            </span>
            
            <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded">
              {job.jobType === 'full-time' ? 'Tempo Integral' : 
                job.jobType === 'part-time' ? 'Meio Período' :
                job.jobType === 'contract' ? 'Contrato' : 'Freelance'}
            </span>
            
            <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded">
              {job.experienceLevel === 'entry-level' ? 'Júnior' :
                job.experienceLevel === 'mid-level' ? 'Pleno' :
                job.experienceLevel === 'senior-level' ? 'Sênior' : 'Líder'}
            </span>
          </div>
          
          {job.tags && job.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {job.tags.slice(0, 5).map((tag, index) => (
                <span 
                  key={index}
                  className="bg-primary-100 text-primary-800 text-xs font-medium px-2.5 py-0.5 rounded"
                >
                  {tag}
                </span>
              ))}
              {job.tags.length > 5 && (
                <span className="text-xs text-gray-500">
                  +{job.tags.length - 5}
                </span>
              )}
            </div>
          )}
          
          {job.salary && (
            <p className="text-gray-700 font-medium mb-2">
              {job.salary}
            </p>
          )}
          
          <div className="flex justify-between items-center mt-4">
            <span className="text-xs text-gray-500">
              Publicada há {getFormattedDate(job.publishedAt || job.createdAt)}
            </span>
            
            <Link 
              href={job.source === 'direct' ? `/jobs/${job.id}` : (job.sourceUrl || `/jobs/${job.id}`)}
              className="text-primary-600 hover:text-primary-800 text-sm font-medium"
              target={job.source === 'direct' ? undefined : '_blank'}
            >
              Ver detalhes {job.source === 'direct' ? '→' : '↗'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 