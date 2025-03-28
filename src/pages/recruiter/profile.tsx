import { useState, useEffect } from 'react';
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { getServerSession } from 'next-auth/next';
import { useRouter } from 'next/router';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { UserRole } from '@prisma/client';
import { ProtectedLayout } from '@/components/layouts/ProtectedLayout';
import Layout from '@/components/common/Layout';
import CompanyInfoForm from '@/components/profile/company/CompanyInfoForm';
import JobsManagement from '@/components/profile/company/JobsManagement';
import ApplicationsReview from '@/components/profile/company/ApplicationsReview';
import SecuritySettings from '@/components/profile/SecuritySettings';
import { Tab } from '@headlessui/react';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function RecruiterProfile(props: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Obter dados do perfil do recrutador
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/recruiter/profile');
        
        if (!response.ok) {
          throw new Error('Falha ao carregar dados do perfil');
        }

        const data = await response.json();
        setUserData(data);
      } catch (err) {
        console.error('Erro ao buscar dados do perfil:', err);
        setError('Não foi possível carregar seus dados. Por favor, tente novamente mais tarde.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Manipulador para atualização de informações da empresa
  const handleCompanyInfoUpdate = async (data: any) => {
    try {
      const response = await fetch('/api/recruiter/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Falha ao atualizar informações da empresa');
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

  const handlePasswordChange = async (data: { currentPassword: string; newPassword: string }) => {
    try {
      const response = await fetch('/api/recruiter/profile?action=password', {
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
      const response = await fetch('/api/recruiter/profile', {
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
    <ProtectedLayout requiredRole={UserRole.RECRUITER}>
      <Layout>
        <main className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-6">Perfil do Recrutador</h1>

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
                      : 'text-gray-700 hover:bg-white/[0.12] hover:text-blue-600'
                  )
                }
              >
                Informações da Empresa
              </Tab>
              <Tab
                className={({ selected }) =>
                  classNames(
                    'w-full py-2.5 text-sm font-medium leading-5 rounded-lg',
                    selected
                      ? 'bg-white shadow text-blue-700'
                      : 'text-gray-700 hover:bg-white/[0.12] hover:text-blue-600'
                  )
                }
              >
                Gerenciar Vagas
              </Tab>
              <Tab
                className={({ selected }) =>
                  classNames(
                    'w-full py-2.5 text-sm font-medium leading-5 rounded-lg',
                    selected
                      ? 'bg-white shadow text-blue-700'
                      : 'text-gray-700 hover:bg-white/[0.12] hover:text-blue-600'
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
                      : 'text-gray-700 hover:bg-white/[0.12] hover:text-blue-600'
                  )
                }
              >
                Segurança
              </Tab>
            </Tab.List>

            <Tab.Panels className="mt-2">
              <Tab.Panel className="rounded-xl bg-white p-6 shadow">
                <CompanyInfoForm
                  userData={userData}
                  onSubmit={handleCompanyInfoUpdate}
                />
              </Tab.Panel>
              <Tab.Panel className="rounded-xl bg-white p-6 shadow">
                <JobsManagement />
              </Tab.Panel>
              <Tab.Panel className="rounded-xl bg-white p-6 shadow">
                <ApplicationsReview />
              </Tab.Panel>
              <Tab.Panel className="rounded-xl bg-white p-6 shadow">
                <SecuritySettings
                  onPasswordChange={handlePasswordChange}
                  onAccountDeletion={handleAccountDeletion}
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

  // Verificar se o usuário está autenticado e tem o papel correto
  if (!session || !session.user || session.user.role !== UserRole.RECRUITER) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    };
  }

  return {
    props: {
      session,
    },
  };
} 