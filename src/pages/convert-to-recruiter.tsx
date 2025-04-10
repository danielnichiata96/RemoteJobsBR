import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

const ConvertToRecruiter = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleConversion = async () => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/user/convert-to-recruiter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || 'Conta convertida com sucesso! Você agora é uma empresa.');
        // Redirect to dashboard after a short delay
        setTimeout(() => {
            router.push('/dashboard');
        }, 2000);
      } else {
        setError(data.error || 'Ocorreu um erro ao converter sua conta.');
      }
    } catch (err) {
      setError('Ocorreu um erro ao comunicar com o servidor.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Redirect if not logged in
  if (status === 'loading') {
    return <div className="container mx-auto p-6 text-center">Carregando...</div>;
  }

  if (status === 'unauthenticated') {
    return (
      <div className="container mx-auto p-6 text-center">
        <p className="text-xl mb-4">Você precisa estar logado para acessar esta página.</p>
        <Link href="/auth/login" className="text-blue-600 hover:underline">
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Converter para Empresa | RemoteJobsBR</title>
      </Head>
      <div className="container mx-auto p-6 max-w-2xl">
        <h1 className="text-3xl font-bold mb-6 text-center">Torne-se uma Empresa</h1>

        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Benefícios de ser uma Empresa</h2>
          <ul className="list-disc pl-6 mb-6 space-y-2">
            <li>Publique vagas de emprego para candidatos qualificados</li>
            <li>Gerencie facilmente suas vagas e candidaturas</li>
            <li>Encontre os melhores talentos para sua empresa</li>
            <li>Acesso a ferramentas dedicadas para recrutamento</li>
          </ul>

          <div className="border-t pt-4 mt-4">
            <h3 className="text-lg font-semibold mb-2">Importante</h3>
            <p className="text-gray-700 mb-4">
              Ao converter sua conta para empresa, você terá acesso a recursos adicionais 
              para publicar e gerenciar vagas de emprego. Esta ação não pode ser desfeita facilmente.
            </p>
          </div>

         {error && (
             <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
             {error}
             </div>
         )}

          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              {success}
            </div>
          )}

          <button
            onClick={handleConversion}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
          >
            {isLoading ? 'Processando...' : 'Converter para Empresa'}
          </button>
        </div>

        <div className="text-center">
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            Voltar para o Dashboard
          </Link>
        </div>
      </div>
    </>
  );
};

export default ConvertToRecruiter;