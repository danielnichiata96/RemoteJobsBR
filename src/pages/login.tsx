import { useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FaGoogle, FaLinkedin } from 'react-icons/fa';

export default function Login(props) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirecionar se já estiver autenticado
  if (status === 'authenticated') {
    router.push('/');
    return null;
  }

  const handleSocialLogin = async (provider: string) => {
    setIsLoading(true);
    try {
      await signIn(provider, { callbackUrl: '/' });
    } catch (error) {
      setError(`Erro ao conectar com ${provider}. Tente novamente.`);
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Login | RemoteJobsBR</title>
        <meta name="description" content="Faça login na RemoteJobsBR e encontre as melhores vagas remotas para profissionais brasileiros" />
      </Head>

      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <Link href="/">
              <h1 className="text-center text-3xl font-bold text-primary-600">RemoteJobsBR</h1>
            </Link>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Entre na sua conta
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Ou{' '}
              <Link href="/register" className="font-medium text-primary-600 hover:text-primary-500">
                crie uma conta grátis
              </Link>
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 text-gray-500">Escolha como entrar</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => handleSocialLogin('google')}
                disabled={isLoading}
                className="w-full inline-flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                <FaGoogle className="h-5 w-5 text-red-500" />
                <span className="ml-2">Google</span>
              </button>

              <button
                onClick={() => handleSocialLogin('linkedin')}
                disabled={isLoading}
                className="w-full inline-flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                <FaLinkedin className="h-5 w-5 text-blue-600" />
                <span className="ml-2">LinkedIn</span>
              </button>
            </div>
          </div>

          <div className="text-center mt-8">
            <Link href="/auth/recruiter" className="font-medium text-primary-600 hover:text-primary-500">
              Área de Recrutadores
            </Link>
          </div>
        </div>
      </div>
    </>
  );
} 