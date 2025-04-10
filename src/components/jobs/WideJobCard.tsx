import Link from 'next/link';
import Image from 'next/image';
import { AiOutlineClockCircle } from 'react-icons/ai';
import { HiOutlineLocationMarker } from 'react-icons/hi';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Job } from '@/types/job';
import { useState } from 'react';
import SaveJobButton from './SaveJobButton';

type WideJobCardProps = {
  job: Job;
};

const WideJobCard = ({ job }: WideJobCardProps) => {
  const [imgError, setImgError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Calcular quanto tempo faz desde que a vaga foi publicada
  const publishDate = job.publishedAt || job.createdAt;
  const timeAgo = formatDistanceToNow(new Date(publishDate), {
    addSuffix: true,
    locale: ptBR,
  });
  
  // Determinar o logotipo a ser exibido
  const companyLogo = job.companyLogo || getDefaultLogo(job.company);
  
  return (
    <div 
      className="block border border-gray-200 rounded-lg p-4 mb-4 transition-shadow hover:shadow-md relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link 
        href={`/jobs/${job.id.replace('greenhouse_', '')}`}
        className="block"
      >
        <div className="flex items-start gap-4">
          {/* Logo da empresa */}
          <div className="flex-shrink-0">
            <div className="w-16 h-16 rounded-md overflow-hidden flex items-center justify-center bg-white border border-gray-100">
              {companyLogo && !imgError ? (
                <Image
                  src={companyLogo}
                  alt={`${job.company} logo`}
                  width={64}
                  height={64}
                  className="object-contain"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-blue-600 text-white text-2xl font-bold">
                  {typeof job.company === 'string' ? job.company.charAt(0).toUpperCase() : 'C'}
                </div>
              )}
            </div>
          </div>
          
          {/* Informações da vaga */}
          <div className="flex-grow">
            <h3 className="text-lg font-medium text-gray-900 mb-1">{job.title}</h3>
            <p className="text-gray-600 mb-2">{job.company}</p>
            
            <div className="flex flex-wrap gap-2 mb-2">
              {/* Localização */}
              {job.location && (
                <span className="flex items-center text-sm text-gray-500">
                  <HiOutlineLocationMarker className="mr-1" />
                  {job.location}
                </span>
              )}
              
              {/* Tempo desde publicação */}
              <span className="flex items-center text-sm text-gray-500">
                <AiOutlineClockCircle className="mr-1" />
                {timeAgo}
              </span>
            </div>
            
            {/* Tags e Tipos de trabalho */}
            <div className="flex flex-wrap gap-2 mt-2">
              {job.jobType && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {formatJobType(job.jobType)}
                </span>
              )}
              
              {job.experienceLevel && (
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  {formatExperienceLevel(job.experienceLevel)}
                </span>
              )}
              
              {job.workplaceType && (
                <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                  {formatWorkplaceType(job.workplaceType)}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
      
      {/* Botão de salvar - visível apenas em hover em desktop, sempre visível em mobile */}
      <div className={`absolute top-4 right-4 transition-opacity duration-200 sm:${isHovered ? 'opacity-100' : 'opacity-0'}`}>
        <SaveJobButton 
          jobId={job.id} 
          variant="secondary" 
          showText={false} 
          className="p-2"
        />
      </div>
    </div>
  );
};

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
  // Este é um fallback, pois o Logo.dev funciona melhor com domínios
  const formattedName = name.trim().toLowerCase().replace(/\s+/g, '') + '.com';
  return `https://img.logo.dev/${formattedName}${tokenParam}`;
}

// Função para formatar o tipo de trabalho
function formatJobType(jobType: string): string {
  const typeMap: Record<string, string> = {
    'FULL_TIME': 'Tempo Integral',
    'PART_TIME': 'Meio Período',
    'CONTRACT': 'Contrato',
    'TEMPORARY': 'Temporário',
    'INTERNSHIP': 'Estágio',
    'VOLUNTEER': 'Voluntário'
  };
  
  return typeMap[jobType] || jobType;
}

// Função para formatar o nível de experiência
function formatExperienceLevel(level: string): string {
  const levelMap: Record<string, string> = {
    'ENTRY': 'Júnior',
    'JUNIOR': 'Júnior',
    'MID': 'Pleno',
    'MID_LEVEL': 'Pleno',
    'SENIOR': 'Sênior',
    'EXPERT': 'Especialista',
    'INTERNSHIP': 'Estágio'
  };
  
  return levelMap[level] || level;
}

// Função para formatar o tipo de local de trabalho
function formatWorkplaceType(type: string): string {
  const typeMap: Record<string, string> = {
    'REMOTE': 'Remoto',
    'ON_SITE': 'Presencial',
    'HYBRID': 'Híbrido'
  };
  
  return typeMap[type] || type;
}

export default WideJobCard;