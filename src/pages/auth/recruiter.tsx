import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';

export default function RecruiterLogin({}) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      // Primeiro, definir o papel do usuário como COMPANY via cookie
      const intentResponse = await fetch('/api/auth/register-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ intent: 'COMPANY' }),
      });

      if (!intentResponse.ok) {
        throw new Error('Falha ao registrar intenção de login como recrutador');
      }

      // Agora enviar o magic link
      const result = await signIn('email', {
        email,
        callbackUrl: '/recruiter/dashboard',
        redirect: false,
      });

      if (result?.error) {
        console.error('Erro no signIn:', result.error);
        setMessage('Ocorreu um erro ao enviar o link. Por favor, tente novamente.');
        setIsSuccess(false);
      } else {
        setMessage('Enviamos um link de acesso para o seu email. Por favor, verifique sua caixa de entrada.');
        setIsSuccess(true);
        setEmail('');
      }
    } catch (error) {
      console.error('Erro no processo de login:', error);
      setMessage('Ocorreu um erro ao enviar o link. Por favor, tente novamente.');
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Acesso para Recrutadores | RemoteJobsBR</title>
        <meta name="description" content="Acesso para recrutadores publicarem vagas na RemoteJobsBR" />
      </Head>

      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Acesso para Recrutadores
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Publique vagas remotas para profissionais brasileiros
            </p>
          </div>

          {message && (
            <div className={`p-4 rounded-md ${isSuccess ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {message}
            </div>
          )}

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? 'Enviando...' : 'Enviar link de acesso'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Já tem uma conta?{' '}
              <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
                Faça login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
} 