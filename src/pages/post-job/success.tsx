import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Layout from '../../components/common/Layout';

export default function PostJobSuccess(props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Verificar se o usuário está autenticado e tem o role correto
  useEffect(() => {
    if (status === 'unauthenticated') {
      // Se não autenticado, redirecionar para o login de recrutador
      router.push('/login?type=recruiter');
      return;
    }
    
    if (status === 'authenticated' && session?.user?.role !== 'COMPANY') {
      // Se autenticado mas não for recrutador, redirecionar para a página inicial
      // ou para uma página de erro/aviso específica
      router.push('/');
      return;
    }
  }, [status, router, session]);
  
  if (status === 'loading') {
    return (
      <Layout title="Carregando... | RemoteJobsBR">
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout title="Vaga Publicada | RemoteJobsBR">
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <div className="mb-6">
          <div className="mx-auto h-24 w-24 rounded-full bg-green-100 flex items-center justify-center">
            <svg
              className="h-16 w-16 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>
        
        <h1 className="text-3xl font-bold mb-4">Vaga Publicada com Sucesso!</h1>
        <p className="text-lg text-gray-600 mb-8">
          Sua vaga já está disponível para candidatos qualificados. Você receberá notificações por email quando receber candidaturas.
        </p>
        
        <div className="space-y-4 max-w-sm mx-auto">
          <Link 
            href="/recruiter/dashboard/jobs"
            className="block w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 font-medium"
          >
            Ir para o Dashboard
          </Link>
          
          <Link 
            href="/"
            className="block w-full bg-white border border-gray-300 text-gray-700 py-3 rounded-md hover:bg-gray-50 font-medium"
          >
            Voltar para o Início
          </Link>
        </div>
        
        <div className="mt-12 bg-blue-50 rounded-lg p-6 text-left">
          <h2 className="text-xl font-medium text-blue-800 mb-4">O que fazer agora?</h2>
          
          <ul className="space-y-3">
            <li className="flex items-start">
              <svg className="h-6 w-6 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Monitore suas candidaturas através do dashboard de recrutador</span>
            </li>
            <li className="flex items-start">
              <svg className="h-6 w-6 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Complete seu perfil de empresa para atrair mais candidatos</span>
            </li>
            <li className="flex items-start">
              <svg className="h-6 w-6 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Compartilhe sua vaga nas redes sociais para aumentar sua visibilidade</span>
            </li>
          </ul>
        </div>
      </div>
    </Layout>
  );
} 