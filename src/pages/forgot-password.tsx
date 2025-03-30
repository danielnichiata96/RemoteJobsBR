import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

export default function ForgotPassword(props) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Redirecionar se já estiver autenticado
  if (status === 'authenticated') {
    router.push('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ocorreu um erro ao processar sua solicitação.');
      }

      setIsSuccess(true);
      setMessage('Enviamos um link para redefinir sua senha. Por favor, verifique seu email.');
    } catch (error: any) {
      setIsSuccess(false);
      setMessage(error.message || 'Ocorreu um erro ao processar sua solicitação. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Recuperar Senha | RemoteJobsBR</title>
        <meta name="description" content="Recupere sua senha na RemoteJobsBR" />
      </Head>

      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <Link href="/">
              <h1 className="text-center text-3xl font-bold text-primary-600">RemoteJobsBR</h1>
            </Link>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Recuperar senha
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Enviaremos um link para redefinir sua senha
            </p>
          </div>

          {message && (
            <div className={`p-4 rounded-md ${isSuccess ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {message}
            </div>
          )}

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading || isSuccess}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading || isSuccess}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {isLoading ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>
            </div>
          </form>

          <div className="text-center">
            <Link href="/login" className="font-medium text-primary-600 hover:text-primary-500">
              Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    </>
  );
} 