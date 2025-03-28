import { useState, useEffect } from 'react';
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { getServerSession } from 'next-auth/next';
import { useRouter } from 'next/router';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { UserRole } from '@prisma/client';
import { ProtectedLayout } from '@/components/layouts/ProtectedLayout';
import Layout from '@/components/common/Layout';
import PersonalInfoForm from '@/components/profile/candidate/PersonalInfoForm';
import ResumeManager from '@/components/profile/candidate/ResumeManager';
import SkillsManager from '@/components/profile/candidate/SkillsManager';
import ApplicationHistory from '@/components/profile/candidate/ApplicationHistory';
import SecuritySettings from '@/components/profile/SecuritySettings';
import { Tab } from '@headlessui/react';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function CandidateProfile(props: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Obter dados do perfil do candidato
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('Iniciando busca de dados do perfil do candidato');
        const response = await fetch('/api/candidate/profile');
        
        console.log('Resposta da API:', response.status, response.statusText);
        
        if (!response.ok) {
          // Tentar obter mais detalhes sobre o erro
          let errorMessage = 'Falha ao carregar dados do perfil';
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
            console.error('Detalhes do erro da API:', errorData);
          } catch (e) {
            console.error('Erro ao processar resposta de erro da API:', e);
          }
          
          throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('Dados recebidos do perfil:', data ? 'Dados válidos' : 'Dados vazios');
        setUserData(data);
      } catch (err) {
        console.error('Erro ao buscar dados do perfil:', err);
        setError('Não foi possível carregar seus dados. Por favor, tente novamente mais tarde. ' + (err instanceof Error ? err.message : ''));
      } finally {
        setIsLoading(false);
      }
    };

    const fetchApplications = async () => {
      try {
        const response = await fetch('/api/candidate/applications');
        
        if (response.ok) {
          const data = await response.json();
          setApplications(data.applications || []);
        }
      } catch (err) {
        console.error('Erro ao buscar candidaturas:', err);
      }
    };

    fetchUserData();
    fetchApplications();
  }, []);

  // Manipuladores para atualização de dados
  const handlePersonalInfoUpdate = async (data: any) => {
    try {
      const response = await fetch('/api/candidate/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Falha ao atualizar informações pessoais');
      }

      const updatedUser = await response.json();
      setUserData(updatedUser);
      setNotification({ type: 'success', message: 'Informações atualizadas com sucesso!' });
      
      // Esconder a notificação após 3 segundos
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } catch (err) {
      console.error('Erro ao atualizar perfil:', err);
      setError('Não foi possível atualizar suas informações. Por favor, tente novamente mais tarde.');
    }
  };

  const handleResumeChange = async (resumeUrl: string | null) => {
    try {
      const response = await fetch('/api/candidate/profile?action=resume', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resumeUrl }),
      });

      if (!response.ok) {
        throw new Error('Falha ao atualizar currículo');
      }

      const data = await response.json();
      setUserData(prev => ({ ...prev, resumeUrl: data.resumeUrl }));
      setNotification({ 
        type: 'success', 
        message: resumeUrl ? 'Currículo atualizado com sucesso!' : 'Currículo removido com sucesso!' 
      });
      
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } catch (err) {
      console.error('Erro ao atualizar currículo:', err);
      setError('Não foi possível atualizar seu currículo. Por favor, tente novamente mais tarde.');
    }
  };

  const handleSkillsChange = async (skills: string[]) => {
    try {
      const response = await fetch('/api/candidate/profile?action=skills', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ skills }),
      });

      if (!response.ok) {
        throw new Error('Falha ao atualizar habilidades');
      }

      const data = await response.json();
      setUserData(prev => ({ ...prev, skills: data.skills }));
      setNotification({ type: 'success', message: 'Habilidades atualizadas com sucesso!' });
      
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } catch (err) {
      console.error('Erro ao atualizar habilidades:', err);
      setError('Não foi possível atualizar suas habilidades. Por favor, tente novamente mais tarde.');
    }
  };

  const handlePasswordChange = async (data: { currentPassword: string; newPassword: string }) => {
    try {
      const response = await fetch('/api/candidate/profile?action=password', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao alterar senha');
      }

      setNotification({ type: 'success', message: 'Senha alterada com sucesso!' });
      
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } catch (err) {
      console.error('Erro ao alterar senha:', err);
      throw err;
    }
  };

  const handleAccountDeletion = async () => {
    try {
      const response = await fetch('/api/candidate/profile', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Falha ao excluir conta');
      }

      // Redirecionar para a página inicial após exclusão
      router.push('/');
    } catch (err) {
      console.error('Erro ao excluir conta:', err);
      throw err;
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen flex flex-col items-center justify-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md">
            <p>{error}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Tentar novamente
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <ProtectedLayout requiredRole={UserRole.CANDIDATE}>
      <Layout>
        <main className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-6">Perfil do Candidato</h1>

          {notification && (
            <div 
              className={classNames(
                'mb-6 p-4 rounded-md',
                notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              )}
            >
              {notification.message}
            </div>
          )}

          <Tab.Group>
            <Tab.List className="flex rounded-xl bg-gray-100 p-1 mb-8">
              <Tab
                className={({ selected }) =>
                  classNames(
                    'w-full py-2.5 text-sm font-medium leading-5 rounded-lg',
                    selected
                      ? 'bg-white shadow text-blue-700'
                      : 'text-gray-700 hover:bg-white/[0.12] hover:text-blue-700'
                  )
                }
              >
                Informações Pessoais
              </Tab>
              <Tab
                className={({ selected }) =>
                  classNames(
                    'w-full py-2.5 text-sm font-medium leading-5 rounded-lg',
                    selected
                      ? 'bg-white shadow text-blue-700'
                      : 'text-gray-700 hover:bg-white/[0.12] hover:text-blue-700'
                  )
                }
              >
                Currículo
              </Tab>
              <Tab
                className={({ selected }) =>
                  classNames(
                    'w-full py-2.5 text-sm font-medium leading-5 rounded-lg',
                    selected
                      ? 'bg-white shadow text-blue-700'
                      : 'text-gray-700 hover:bg-white/[0.12] hover:text-blue-700'
                  )
                }
              >
                Habilidades
              </Tab>
              <Tab
                className={({ selected }) =>
                  classNames(
                    'w-full py-2.5 text-sm font-medium leading-5 rounded-lg',
                    selected
                      ? 'bg-white shadow text-blue-700'
                      : 'text-gray-700 hover:bg-white/[0.12] hover:text-blue-700'
                  )
                }
              >
                Candidaturas
              </Tab>
              <Tab
                className={({ selected }) =>
                  classNames(
                    'w-full py-2.5 text-sm font-medium leading-5 rounded-lg',
                    selected
                      ? 'bg-white shadow text-blue-700'
                      : 'text-gray-700 hover:bg-white/[0.12] hover:text-blue-700'
                  )
                }
              >
                Segurança
              </Tab>
            </Tab.List>
            <Tab.Panels>
              <Tab.Panel>
                <PersonalInfoForm 
                  userData={userData} 
                  onSubmit={handlePersonalInfoUpdate} 
                />
              </Tab.Panel>
              <Tab.Panel>
                <ResumeManager 
                  initialResumeUrl={userData?.resumeUrl} 
                  onResumeChange={handleResumeChange} 
                />
              </Tab.Panel>
              <Tab.Panel>
                <SkillsManager 
                  initialSkills={userData?.skills || []} 
                  onSkillsChange={handleSkillsChange} 
                />
              </Tab.Panel>
              <Tab.Panel>
                <ApplicationHistory applications={applications} />
              </Tab.Panel>
              <Tab.Panel>
                <SecuritySettings 
                  onChangePassword={handlePasswordChange}
                  onDeleteAccount={handleAccountDeletion}
                />
              </Tab.Panel>
            </Tab.Panels>
          </Tab.Group>
        </main>
      </Layout>
    </ProtectedLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return {
      redirect: {
        destination: '/auth/login?callbackUrl=/candidate/profile',
        permanent: false,
      },
    };
  }

  if (session.user.role !== UserRole.CANDIDATE) {
    return {
      redirect: {
        destination: '/auth/unauthorized',
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
}; 