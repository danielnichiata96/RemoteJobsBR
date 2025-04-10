import { useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import { FaGoogle, FaLinkedin } from 'react-icons/fa';

// Interface for field-specific errors
interface FieldErrors {
  name?: string[];
  email?: string[];
  password?: string[];
}

export default function Register(props) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(''); // For general errors
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({}); // For specific field errors
  const [success, setSuccess] = useState(false);

  // Redirecionar se já estiver autenticado
  if (status === 'authenticated') {
    router.push('/');
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear specific field error on change
    if (fieldErrors[name as keyof FieldErrors]) {
      setFieldErrors(prev => ({ ...prev, [name]: undefined }));
    }
    // Clear general error on change
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setFieldErrors({}); // Clear previous field errors
    setSuccess(false);

    // Validação básica no frontend (pode ser mantida ou removida se confiar 100% no backend)
    if (formData.password.length < 6) {
      setFieldErrors(prev => ({ ...prev, password: ['A senha deve ter pelo menos 6 caracteres.'] }));
      setIsLoading(false);
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem.'); // Keep general error for password mismatch
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          // role: 'CANDIDATE' // O backend já define o default, não precisamos enviar
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check for validation errors from Zod
        if (response.status === 400 && data.details) {
           const formattedErrors: FieldErrors = {};
           for (const key in data.details) {
             if (data.details[key] && data.details[key]._errors) {
               formattedErrors[key as keyof FieldErrors] = data.details[key]._errors;
             }
           }
           // Add a general message if details were present but couldn't be parsed nicely
           if (Object.keys(formattedErrors).length > 0) {
               setFieldErrors(formattedErrors);
               setError('Por favor, corrija os erros no formulário.'); // Set a general error message too
           } else {
                setError(data.error || 'Erro de validação desconhecido.');
           }
        } else {
          // Handle other errors (e.g., email already exists, server error)
          setError(data.error || 'Erro ao criar conta.');
        }
        throw new Error(data.error || 'Erro ao criar conta.'); // Throw to prevent success logic
      }

      // Success case
      setSuccess(true);
      setTimeout(() => {
        router.push('/login?registered=true'); // Add param for potential success message on login page
      }, 3000);

    } catch (error: any) {
      // Error state is already set in the !response.ok block
      // Only set a generic error if it wasn't set before (e.g., network error)
      if (!error && !Object.keys(fieldErrors).length) {
          setError(error.message || 'Ocorreu um erro inesperado. Por favor, tente novamente.');
      }
      console.error("Registration failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialSignup = async (provider: string) => {
    setIsLoading(true);
    try {
      // We might not need this intent logic if backend handles roles correctly now
      // await fetch('/api/auth/register-intent', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ intent: 'USER' }),
      // });
      // Redireciona para o provedor de login social
      window.location.href = `/api/auth/signin/${provider}?callbackUrl=/`;
    } catch (error) {
      setError(`Erro ao conectar com ${provider}. Tente novamente.`);
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Cadastro | RemoteJobsBR</title>
        <meta name="description" content="Crie sua conta na RemoteJobsBR e encontre as melhores vagas remotas para profissionais brasileiros" />
      </Head>

      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <Link href="/">
              <h1 className="text-center text-3xl font-bold text-primary-600">RemoteJobsBR</h1>
            </Link>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Crie sua conta
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Ou{' '}
              <Link href="/login" className="font-medium text-primary-600 hover:text-primary-500">
                faça login se já tiver uma conta
              </Link>
            </p>
          </div>

          {/* General Error Display */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
              <strong className="font-bold">Erro: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {/* Success Message */} 
          {success && (
            <div className="bg-green-50 border-l-4 border-green-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">
                    Conta criada com sucesso! Redirecionando para a página de login...
                  </p>
                </div>
              </div>
            </div>
          )}

          <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
            <div className="rounded-md shadow-sm space-y-4">
              {/* Name Field */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nome completo</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${fieldErrors.name ? 'border-red-500' : 'border-gray-300'} placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm`}
                  placeholder="Seu nome completo"
                  value={formData.name}
                  onChange={handleChange}
                  aria-invalid={fieldErrors.name ? "true" : "false"}
                  aria-describedby={fieldErrors.name ? "name-error" : undefined}
                />
                {fieldErrors.name && (
                  <p className="mt-2 text-sm text-red-600" id="name-error">
                    {fieldErrors.name.join(', ')}
                  </p>
                )}
              </div>

              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${fieldErrors.email ? 'border-red-500' : 'border-gray-300'} placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm`}
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  aria-invalid={fieldErrors.email ? "true" : "false"}
                  aria-describedby={fieldErrors.email ? "email-error" : undefined}
                />
                {fieldErrors.email && (
                  <p className="mt-2 text-sm text-red-600" id="email-error">
                    {fieldErrors.email.join(', ')}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">Senha</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${fieldErrors.password ? 'border-red-500' : 'border-gray-300'} placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm`}
                  placeholder="Senha (mínimo 6 caracteres)"
                  value={formData.password}
                  onChange={handleChange}
                  aria-invalid={fieldErrors.password ? "true" : "false"}
                  aria-describedby={fieldErrors.password ? "password-error" : undefined}
                />
                 {fieldErrors.password && (
                  <p className="mt-2 text-sm text-red-600" id="password-error">
                    {fieldErrors.password.join(', ')}
                  </p>
                )}
              </div>

              {/* Confirm Password Field */} 
              <div>
                 <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirmar senha</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                  placeholder="Confirme sua senha"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isLoading || success}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {isLoading ? 'Processando...' : 'Criar conta'}
              </button>
            </div>
          </form>

          {/* Social Login Section */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 text-gray-500">Ou continue com</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => handleSocialSignup('google')}
                disabled={isLoading || success}
                className="w-full inline-flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                <FaGoogle className="h-5 w-5 text-red-500" />
                <span className="ml-2">Google</span>
              </button>

              <button
                onClick={() => handleSocialSignup('linkedin')}
                disabled={isLoading || success}
                className="w-full inline-flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                <FaLinkedin className="h-5 w-5 text-blue-700" />
                <span className="ml-2">LinkedIn</span>
              </button>
            </div>
          </div>

          <div className="text-center mt-4 text-sm text-gray-600">
            Ao se cadastrar, você concorda com nossos{' '}
            <Link href="/terms" className="font-medium text-primary-600 hover:text-primary-500">
              Termos de Serviço
            </Link>{' '}
            e{' '}
            <Link href="/privacy" className="font-medium text-primary-600 hover:text-primary-500">
              Política de Privacidade
            </Link>
          </div>
        </div>
      </div>
    </>
  );
} 