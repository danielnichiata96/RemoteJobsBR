import { useState } from 'react';
import CompanyDashboard from '../components/profile/company/CompanyDashboard';
import JobsManagement from '../components/profile/company/JobsManagement';
import JobPostingForm from '../components/profile/company/JobPostingForm';
import ApplicationsReview from '../components/profile/company/ApplicationsReview';
import MessagingInterface from '../components/profile/company/MessagingInterface';
import { Tag } from '@prisma/client';

export default function RecruiterDemo(props) {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Dados simulados para o dashboard
  const dashboardStats = {
    activeJobs: 5,
    totalApplications: 47,
    newApplications: 12,
    interviewsScheduled: 3,
    hiredCandidates: 2,
    savedCandidates: 8
  };
  
  const recentActivity = [
    {
      id: '1',
      type: 'new_application' as const,
      date: new Date().toISOString(),
      jobTitle: 'Desenvolvedor Full Stack',
      candidateName: 'João Silva',
    },
    {
      id: '2',
      type: 'interview_scheduled' as const,
      date: new Date(Date.now() - 86400000).toISOString(), // Ontem
      jobTitle: 'UX/UI Designer',
      candidateName: 'Maria Souza',
    },
    {
      id: '3',
      type: 'job_posted' as const,
      date: new Date(Date.now() - 172800000).toISOString(), // 2 dias atrás
      jobTitle: 'DevOps Engineer',
    },
    {
      id: '4',
      type: 'candidate_hired' as const,
      date: new Date(Date.now() - 345600000).toISOString(), // 4 dias atrás
      jobTitle: 'Product Manager',
      candidateName: 'Carlos Oliveira',
    }
  ];

  // Tags disponíveis para o formulário de vaga
  const availableTags: Tag[] = [
    { id: '1', name: 'React' } as Tag,
    { id: '2', name: 'TypeScript' } as Tag,
    { id: '3', name: 'Node.js' } as Tag,
    { id: '4', name: 'MongoDB' } as Tag,
    { id: '5', name: 'AWS' } as Tag,
    { id: '6', name: 'Docker' } as Tag,
    { id: '7', name: 'UI/UX Design' } as Tag,
    { id: '8', name: 'Figma' } as Tag,
    { id: '9', name: 'Python' } as Tag,
    { id: '10', name: 'Django' } as Tag,
  ];

  const handleSubmitJobForm = async (data: any) => {
    console.log('Dados do formulário de vaga:', data);
    alert('Vaga cadastrada com sucesso!');
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Portal do Recrutador</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'dashboard'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab('dashboard')}
              >
                Dashboard
              </button>
              <button
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'jobs'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab('jobs')}
              >
                Gerenciar Vagas
              </button>
              <button
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'newJob'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab('newJob')}
              >
                Publicar Vaga
              </button>
              <button
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'applications'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab('applications')}
              >
                Candidaturas
              </button>
              <button
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'messages'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab('messages')}
              >
                Mensagens
              </button>
            </nav>
          </div>

          {activeTab === 'dashboard' && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">Dashboard do Recrutador</h2>
              <CompanyDashboard stats={dashboardStats} recentActivity={recentActivity} />
            </div>
          )}

          {activeTab === 'jobs' && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">Gerenciamento de Vagas</h2>
              <JobsManagement />
            </div>
          )}

          {activeTab === 'newJob' && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">Publicar Nova Vaga</h2>
              <JobPostingForm
                onSubmit={handleSubmitJobForm}
                availableTags={availableTags}
              />
            </div>
          )}

          {activeTab === 'applications' && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">Revisão de Candidaturas</h2>
              <ApplicationsReview jobId="1" jobTitle="Desenvolvedor Full Stack" />
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">Mensagens com Candidatos</h2>
              <MessagingInterface
                companyId="123"
                companyName="TechCorp"
                companyAvatar="/images/company-logo.png"
              />
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white shadow mt-8 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-500 text-sm">
            © 2023 RemoteJobsBR. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
} 