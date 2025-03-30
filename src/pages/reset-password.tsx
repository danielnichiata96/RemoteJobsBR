import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

export default function ResetPassword(props) {
  const router = useRouter();
  const { token } = router.query;
  const { data: session, status } = useSession();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isTokenChecked, setIsTokenChecked] = useState(false);

  // Redirecionar se já estiver autenticado
  if (status === 'authenticated') {
    router.push('/');
    return null;
  }

  // Verificar validade do token quando estiver disponível
  useEffect(() => {
    if (token && !isTokenChecked) {
      verifyToken();
    }
  }, [token, isTokenChecked]);

  const verifyToken = async () => {
    try {
      const response = await fetch(`/api/auth/verify-reset-token?token=${token}`);
      const data = await response.json();
      
      setIsValidToken(response.ok);
      if (!response.ok) {
        setMessage(data.error || 'Token inválido ou expirado.');
      }
    } catch (error) {
      setIsValidToken(false);
      setMessage('Ocorreu um erro ao verificar o token. Tente novamente.');
    } finally {
      setIsTokenChecked(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    // Validação básica
    if (password.length < 6) {
      setMessage('A senha deve ter pelo menos 6 caracteres.');
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setMessage('As senhas não coincidem.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ocorreu um erro ao redefinir a senha.');
      }

      setIsSuccess(true);
      setMessage('Senha redefinida com sucesso! Redirecionando para a página de login...');
      
      // Após alguns segundos, redirecionar para a página de login
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (error: any) {
      setIsSuccess(false);
      setMessage(error.message || 'Ocorreu um erro ao redefinir a senha. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Mostrando carregamento enquanto verifica o token
  if (!isTokenChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Redefinir Senha | RemoteJobsBR</title>
        <meta name="description" content="Redefina sua senha na RemoteJobsBR" />
      </Head>

      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <Link href="/">
              <h1 className="text-center text-3xl font-bold text-primary-600">RemoteJobsBR</h1>
            </Link>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Redefinir senha
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Crie uma nova senha para sua conta
            </p>
          </div>

          {message && (
            <div className={`p-4 rounded-md ${isSuccess ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {message}
            </div>
          )}

          {isValidToken ? (
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Nova senha
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading || isSuccess}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirmar nova senha
                </label>
                <div className="mt-1">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="Repita a nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                  {isLoading ? 'Processando...' : 'Redefinir senha'}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-8 text-center">
              <p className="mb-4 text-red-600">
                O link de redefinição de senha é inválido ou expirou.
              </p>
              <Link href="/forgot-password" className="font-medium text-primary-600 hover:text-primary-500">
                Solicitar um novo link
              </Link>
            </div>
          )}

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