import { ApplicationStatus } from '@prisma/client';
import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ApplicationHistoryProps {
  applications: Array<{
    id: string;
    job: {
      id: string;
      title: string;
      company: {
        name: string;
        logo?: string;
      };
    };
    status: ApplicationStatus;
    createdAt: Date;
    updatedAt: Date;
    interviewDate?: Date | null;
  }>;
}

// Função para obter detalhes do status
const getStatusDetails = (status: ApplicationStatus) => {
  const statusMap: Record<ApplicationStatus, { label: string; color: string }> = {
    SUBMITTED: { label: 'Enviada', color: 'bg-blue-100 text-blue-800' },
    SCREENING: { label: 'Triagem', color: 'bg-purple-100 text-purple-800' },
    INTERVIEW: { label: 'Entrevista', color: 'bg-yellow-100 text-yellow-800' },
    TECHNICAL_TEST: { label: 'Teste Técnico', color: 'bg-orange-100 text-orange-800' },
    OFFER: { label: 'Proposta', color: 'bg-green-100 text-green-800' },
    HIRED: { label: 'Contratado', color: 'bg-green-100 text-green-800' },
    REJECTED: { label: 'Não selecionado', color: 'bg-red-100 text-red-800' },
    WITHDRAWN: { label: 'Cancelada', color: 'bg-gray-100 text-gray-800' },
  };

  return statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
};

export default function ApplicationHistory({ applications }: ApplicationHistoryProps) {
  if (!applications || applications.length === 0) {
    return (
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Suas Candidaturas</h2>
        
        <div className="p-6 text-center border rounded-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Sem candidaturas</h3>
          <p className="mt-1 text-sm text-gray-500">
            Você ainda não se candidatou a nenhuma vaga.
          </p>
          <div className="mt-6">
            <Link href="/jobs" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Explorar vagas
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Suas Candidaturas</h2>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vaga
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Empresa
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data de Candidatura
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Última Atualização
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {applications.map((application) => {
              const statusDetails = getStatusDetails(application.status);
              
              return (
                <tr key={application.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link href={`/jobs/${application.job.id}`} className="text-blue-600 hover:text-blue-800">
                      {application.job.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {application.job.company.logo && (
                        <img
                          src={application.job.company.logo}
                          alt={application.job.company.name}
                          className="h-8 w-8 rounded-full mr-2"
                        />
                      )}
                      <span>{application.job.company.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${statusDetails.color}`}>
                      {statusDetails.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(application.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(application.updatedAt), 'dd/MM/yyyy', { locale: ptBR })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Link href={`/applications/${application.id}`} className="text-blue-600 hover:text-blue-800">
                      Detalhes
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <Link href="/applications" className="text-blue-600 hover:text-blue-800">
          Ver todas as candidaturas
        </Link>
      </div>
    </div>
  );
} 