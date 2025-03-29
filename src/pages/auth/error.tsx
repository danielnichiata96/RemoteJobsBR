import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '@/components/common/Layout';

// Mapeamento de erros para mensagens amigáveis
const errorMessages = {
  Configuration: "Ocorreu um erro na configuração do servidor.",
  AccessDenied: "Acesso negado. Você não tem permissão para acessar este recurso.",
  Verification: "O link de verificação expirou ou já foi utilizado. Por favor, solicite um novo link.",
  Default: "Ocorreu um erro inesperado. Por favor, tente novamente."
};

export default function ErrorPage(props) {
  const router = useRouter();
  const { error, message } = router.query;
  
  const errorMessage = error 
    ? errorMessages[error as string] || errorMessages.Default
    : errorMessages.Default;

  // Mensagem personalizada recebida via query param
  const customMessage = message ? decodeURIComponent(message as string) : null;

  return (
    <Layout>
      <div className="flex justify-center min-h-screen py-12 bg-gray-50">
        <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <svg
              className="w-16 h-16 mx-auto text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            
            <h1 className="mt-4 text-3xl font-bold text-gray-900">
              Oops! Algo deu errado
            </h1>
            
            <p className="mt-2 text-gray-600">
              {errorMessage}
            </p>
            
            {customMessage && (
              <p className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded-md">
                Detalhes: {customMessage}
              </p>
            )}
            
            {error === 'Verification' && (
              <div className="mt-4 p-4 bg-blue-50 text-blue-700 rounded-md">
                <p className="text-sm">
                  O link de verificação expirou ou já foi utilizado. Por favor, solicite um novo link na página de login.
                </p>
                {process.env.NODE_ENV === 'development' && (
                  <div className="mt-2">
                    <p className="text-sm font-semibold">Sugestões para debug:</p>
                    <ul className="text-sm list-disc list-inside mt-1">
                      <li>Verifique se o token está sendo armazenado no banco de dados</li>
                      <li>O token pode ter expirado ou já ter sido usado</li>
                      <li>Certifique-se de estar usando a URL correta do e-mail</li>
                    </ul>
                    <div className="mt-3 flex space-x-2">
                      <button 
                        onClick={() => window.open('/api/debug-auth', '_blank')}
                        className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Informações de Debug
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/auth/clear-tokens', {
                              method: 'POST',
                            });
                            const data = await response.json();
                            alert(`Tokens limpos: ${data.deletedCount} de ${data.totalCount}`);
                          } catch (error) {
                            console.error('Erro ao limpar tokens:', error);
                            alert('Erro ao limpar tokens');
                          }
                        }}
                        className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                      >
                        Limpar Tokens Expirados
                      </button>
                      <button
                        onClick={() => {
                          const email = prompt('Digite o email para testar:', '');
                          if (email) {
                            window.location.href = `/api/debug-verification?email=${encodeURIComponent(email)}`;
                          }
                        }}
                        className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        Verificar Email
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-8">
            <div className="space-y-4">
              <div className="text-center">
                <Link href="/auth/signin" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                  Voltar para página de login
                </Link>
              </div>
              <div className="text-center">
                <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                  Voltar para a página inicial
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
} 