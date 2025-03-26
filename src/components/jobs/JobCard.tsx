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
  
  // Função para garantir que temos um objeto Date válido
  const getFormattedDate = (date: Date | string) => {
    const dateObj = date instanceof Date ? date : new Date(date);
    return formatDistanceToNow(dateObj, { locale: ptBR, addSuffix: false });
  };

  return (
    <div className="card hover:shadow-lg transition-shadow duration-200">
      <div className="flex items-start">
        {job.companyLogo && !imgError ? (
          <div className="flex-shrink-0 mr-4">
            <Image 
              src={job.companyLogo} 
              alt={`${job.company} logo`}
              width={60}
              height={60}
              className="rounded-md"
              onError={() => setImgError(true)}
            />
          </div>
        ) : (
          <div className="flex-shrink-0 mr-4 w-[60px] h-[60px] bg-gray-200 rounded-md flex items-center justify-center">
            <span className="text-gray-500 font-bold text-xl">
              {job.company.charAt(0)}
            </span>
          </div>
        )}
        
        <div className="flex-1">
          <Link href={`/jobs/${job.id}`}>
            <h3 className="text-xl font-semibold text-primary-700 hover:text-primary-800 mb-1">
              {job.title}
            </h3>
          </Link>
          
          <p className="text-gray-700 mb-2">{job.company}</p>
          
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
              Publicada há {getFormattedDate(job.createdAt)}
            </span>
            
            <Link 
              href={`/jobs/${job.id}`}
              className="text-primary-600 hover:text-primary-800 text-sm font-medium"
            >
              Ver detalhes →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 