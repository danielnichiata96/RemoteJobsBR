import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Layout from '@/components/common/Layout';
import ProfileForm, { FormData as ProfileFormData } from '@/components/profile/ProfileForm';
import ProfileView from '@/components/profile/ProfileView';
import { UserRole, ExperienceLevel } from '@prisma/client';

export default function Profile(props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', content: '' });
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?returnTo=/profile');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchUserData();
    }
  }, [status]);

  const fetchUserData = async () => {
    setIsLoading(true);
    setMessage({ type: '', content: '' });
    try {
      const response = await fetch('/api/user/profile');
      if (!response.ok) {
         const error = await response.json();
         throw new Error(error.message || 'Falha ao carregar perfil');
      }
      
      const data = await response.json();
      setUserData(data);
    } catch (error: any) {
      setMessage({
        type: 'error',
        content: error.message || 'Erro ao carregar perfil. Tente novamente.'
      });
      console.error('Erro ao buscar dados do perfil:', error);
      setUserData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileUpdate = async (submittedFormData: ProfileFormData) => {
    setIsLoading(true);
    setMessage({ type: '', content: '' });

    try {
      const dataToSubmit = {
        ...submittedFormData,
        desiredSalary: submittedFormData.desiredSalary ? parseFloat(submittedFormData.desiredSalary) : null,
        yearsOfExperience: submittedFormData.yearsOfExperience ? parseInt(submittedFormData.yearsOfExperience) : null,
        experienceLevel: submittedFormData.experienceLevel === '' ? null : submittedFormData.experienceLevel,
        skills: submittedFormData.skills.split(',').map(skill => skill.trim()).filter(Boolean),
      };

      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSubmit),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao atualizar perfil');
      }

      const result = await response.json();
      setUserData(result);
      setMessage({
        type: 'success',
        content: 'Perfil atualizado com sucesso!'
      });
      setIsEditing(false);
    } catch (error: any) {
      setMessage({
        type: 'error',
        content: error.message || 'Erro ao atualizar perfil. Tente novamente.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading' || (isLoading && !userData && status === 'authenticated')) {
    return (
      <Layout title="Meu Perfil | RemoteJobsBR">
        <div className="min-h-screen bg-gray-50 py-10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white shadow-md rounded-lg p-8 flex justify-center items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
              <p className="ml-3 text-lg">Carregando...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!session && status !== 'loading') {
     return (
        <Layout title="Acesso Negado | RemoteJobsBR">
            <div className="min-h-screen bg-gray-50 py-10">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-white shadow-md rounded-lg p-8 text-center">
                        <p className="text-lg">Você precisa estar logado para acessar esta página.</p>
                    </div>
                </div>
            </div>
        </Layout>
     );
  }

  return (
    <Layout title="Meu Perfil | RemoteJobsBR">
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow-md rounded-lg p-8">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
              {!isEditing && userData && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md shadow-sm disabled:opacity-50"
                  disabled={isLoading}
                >
                  Editar Perfil
                </button>
              )}
            </div>

            {isLoading && !isEditing && (
                 <div className="text-center py-4">
                     <p>Carregando dados do perfil...</p>
                 </div>
            )}

            {message.content && (
              <div className={`p-4 mb-6 rounded-md ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {message.content}
              </div>
            )}

            {isEditing ? (
              <ProfileForm 
                initialData={userData} 
                isLoading={isLoading} 
                onSubmit={handleProfileUpdate} 
                onCancel={() => {
                  setIsEditing(false);
                  setMessage({ type: '', content: '' });
                  fetchUserData();
                }}
              />
            ) : (
              !isLoading && userData ? (
                 <ProfileView userData={userData} />
              ) : (
                 !isLoading && (
                     <div className="text-center text-red-600 py-4">
                         <p>Não foi possível carregar os dados do perfil.</p>
                     </div>
                 )
              )
            )}

          </div>
        </div>
      </div>
    </Layout>
  );
} 