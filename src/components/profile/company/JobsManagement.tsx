import { useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Job {
  id: string;
  title: string;
  location: string;
  type: string;
  createdAt: string;
  status: 'active' | 'draft' | 'closed';
  applicationsCount: number;
}

export default function JobsManagement() {
  // Simulação de dados - em uma implementação real, estes viriam do backend
  const [jobs, setJobs] = useState<Job[]>([
    {
      id: '1',
      title: 'Desenvolvedor Full Stack',
      location: 'São Paulo, SP',
      type: 'Tempo integral',
      createdAt: '2023-05-15T10:00:00Z',
      status: 'active',
      applicationsCount: 12
    },
    {
      id: '2',
      title: 'UX/UI Designer',
      location: 'Remoto',
      type: 'Tempo integral',
      createdAt: '2023-06-10T14:30:00Z',
      status: 'active',
      applicationsCount: 8
    },
    {
      id: '3',
      title: 'DevOps Engineer',
      location: 'Rio de Janeiro, RJ',
      type: 'Tempo integral',
      createdAt: '2023-06-01T09:15:00Z',
      status: 'closed',
      applicationsCount: 5
    },
    {
      id: '4',
      title: 'Product Manager',
      location: 'Remoto',
      type: 'Tempo integral',
      createdAt: '2023-06-20T11:45:00Z',
      status: 'draft',
      applicationsCount: 0
    }
  ]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Ativa
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Rascunho
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Encerrada
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: pt });
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Gerenciamento de Vagas</h2>
        <Link 
          href="/company/jobs/new" 
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
          Nova Vaga
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vaga
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Localização
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data de Criação
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Candidaturas
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {jobs.length > 0 ? (
              jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{job.title}</div>
                    <div className="text-sm text-gray-500">{job.type}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{job.location}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatDate(job.createdAt)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusLabel(job.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {job.applicationsCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={`/company/jobs/${job.id}/applications`}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Ver candidatos
                    </Link>
                    <Link
                      href={`/company/jobs/${job.id}/edit`}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Editar
                    </Link>
                    {job.status !== 'closed' && (
                      <button
                        className="text-red-600 hover:text-red-900"
                        onClick={() => {
                          // Implementar lógica para encerrar vaga
                          const updatedJobs = jobs.map(j => 
                            j.id === job.id ? { ...j, status: 'closed' as const } : j
                          );
                          setJobs(updatedJobs);
                        }}
                      >
                        Encerrar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  Nenhuma vaga cadastrada. Clique em "Nova Vaga" para começar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
} 