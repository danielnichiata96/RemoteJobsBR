import React from 'react';
import Link from 'next/link';
import { 
  BriefcaseIcon, 
  UserGroupIcon, 
  DocumentTextIcon,
  ChatBubbleLeftEllipsisIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

interface DashboardStats {
  activeJobs: number;
  totalApplications: number;
  newApplications: number;
  interviewsScheduled: number;
  hiredCandidates: number;
  savedCandidates: number;
}

// Interface para a prop recentActivity
interface ActivityItem {
  id: string;
  type: 'new_application' | 'interview_scheduled' | 'candidate_hired' | 'job_posted' | 'job_closed';
  date: string;
  jobTitle?: string;
  candidateName?: string;
  message?: string;
}

interface CompanyDashboardProps {
  stats: DashboardStats;
  recentActivity: ActivityItem[];
}

export default function CompanyDashboard({ stats, recentActivity }: CompanyDashboardProps) {
  // Função para renderizar o ícone de cada tipo de atividade
  const renderActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'new_application':
        return <DocumentTextIcon className="h-5 w-5 text-blue-500" />;
      case 'interview_scheduled':
        return <ClockIcon className="h-5 w-5 text-purple-500" />;
      case 'candidate_hired':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'job_posted':
        return <BriefcaseIcon className="h-5 w-5 text-blue-500" />;
      case 'job_closed':
        return <BriefcaseIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ChatBubbleLeftEllipsisIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  // Função para obter a mensagem de cada atividade
  const getActivityMessage = (activity: ActivityItem) => {
    switch (activity.type) {
      case 'new_application':
        return `${activity.candidateName} se candidatou para a vaga ${activity.jobTitle}`;
      case 'interview_scheduled':
        return `Entrevista agendada com ${activity.candidateName} para a vaga ${activity.jobTitle}`;
      case 'candidate_hired':
        return `${activity.candidateName} foi contratado para a vaga ${activity.jobTitle}`;
      case 'job_posted':
        return `Nova vaga publicada: ${activity.jobTitle}`;
      case 'job_closed':
        return `Vaga encerrada: ${activity.jobTitle}`;
      default:
        return activity.message || 'Atividade não especificada';
    }
  };

  // Formatar data para exibição
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="space-y-6">
      {/* Seção de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-md bg-blue-100">
              <BriefcaseIcon className="h-6 w-6 text-blue-700" />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-gray-500">Vagas Ativas</p>
              <h3 className="text-2xl font-semibold text-gray-900">{stats.activeJobs}</h3>
            </div>
          </div>
          <div className="mt-4">
            <Link 
              href="/company/jobs" 
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              Ver todas as vagas →
            </Link>
          </div>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-md bg-green-100">
              <DocumentTextIcon className="h-6 w-6 text-green-700" />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-gray-500">Total de Candidaturas</p>
              <h3 className="text-2xl font-semibold text-gray-900">{stats.totalApplications}</h3>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-gray-500">
              <span className="font-medium text-blue-600">{stats.newApplications}</span> novas candidaturas
            </span>
          </div>
          <div className="mt-2">
            <Link 
              href="/company/applications" 
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              Revisar candidaturas →
            </Link>
          </div>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-md bg-purple-100">
              <UserGroupIcon className="h-6 w-6 text-purple-700" />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-gray-500">Entrevistas Agendadas</p>
              <h3 className="text-2xl font-semibold text-gray-900">{stats.interviewsScheduled}</h3>
            </div>
          </div>
          <div className="mt-4">
            <Link 
              href="/company/interviews" 
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              Ver agendamentos →
            </Link>
          </div>
        </div>
      </div>

      {/* Seção de atividades recentes */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Atividades Recentes</h2>
        
        <div className="flow-root">
          <ul className="-mb-8">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <li key={activity.id}>
                  <div className="relative pb-8">
                    {index !== recentActivity.length - 1 ? (
                      <span
                        className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200"
                        aria-hidden="true"
                      />
                    ) : null}
                    <div className="relative flex items-start space-x-3">
                      <div className="relative">
                        <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center ring-8 ring-white">
                          {renderActivityIcon(activity.type)}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div>
                          <div className="text-sm text-gray-700">
                            {getActivityMessage(activity)}
                          </div>
                          <p className="mt-1 text-sm text-gray-500">
                            {formatDate(activity.date)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <li>
                <div className="text-center py-4">
                  <p className="text-gray-500">Nenhuma atividade recente para exibir.</p>
                </div>
              </li>
            )}
          </ul>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/company/activity"
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Ver todas as atividades
          </Link>
        </div>
      </div>

      {/* Seção de ações rápidas */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Ações Rápidas</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/company/jobs/new"
            className="flex items-center p-4 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            <BriefcaseIcon className="h-6 w-6 text-blue-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900">Publicar nova vaga</p>
              <p className="text-xs text-gray-500">Criar e publicar uma nova oportunidade</p>
            </div>
          </Link>
          
          <Link
            href="/company/candidates/saved"
            className="flex items-center p-4 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            <UserGroupIcon className="h-6 w-6 text-blue-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900">Candidatos salvos</p>
              <p className="text-xs text-gray-500">Ver {stats.savedCandidates} candidatos salvos</p>
            </div>
          </Link>
          
          <Link
            href="/company/reports"
            className="flex items-center p-4 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            <DocumentTextIcon className="h-6 w-6 text-blue-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900">Relatórios</p>
              <p className="text-xs text-gray-500">Analisar dados de recrutamento</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
} 