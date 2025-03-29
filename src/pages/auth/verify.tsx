import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function VerifyPage(props) {
  const router = useRouter();
  const { token, email } = router.query;

  useEffect(() => {
    // Redirecionar para a API de verificação quando os parâmetros estiverem disponíveis
    if (token && email) {
      window.location.href = `/api/auth/verify-email?token=${encodeURIComponent(token as string)}&email=${encodeURIComponent(email as string)}`;
    }
  }, [token, email]);

  return (
    <>
      <Head>
        <title>Verificando acesso | RemoteJobsBR</title>
      </Head>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-800 mb-4">Verificando seu acesso</h1>
          
          <div className="flex justify-center my-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
          
          <p className="text-gray-600 mb-2">
            Estamos verificando seu link de acesso...
          </p>
          <p className="text-sm text-gray-500">
            Você será redirecionado automaticamente.
          </p>
        </div>
      </div>
    </>
  );
} 