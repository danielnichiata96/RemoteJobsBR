import Link from 'next/link';
import Head from 'next/head';

export default function VerifyRequestPage({}) {
  return (
    <>
      <Head>
        <title>Email Enviado | RemoteJobsBR</title>
        <meta name="description" content="Verifique seu email para acessar sua conta" />
      </Head>
      
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-800 mb-4">Email Enviado!</h1>
          
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  Enviamos um link de acesso para o seu email. Por favor, verifique sua caixa de entrada.
                </p>
              </div>
            </div>
          </div>
          
          <p className="text-gray-600 mb-6">
            O link de acesso é válido por 24 horas. Após clicar no link, você será redirecionado automaticamente para sua área de recrutador.
          </p>
          
          <div className="text-sm text-gray-500 mb-6">
            <p>Não recebeu o email?</p>
            <ul className="mt-2">
              <li>• Verifique sua pasta de spam ou lixo eletrônico</li>
              <li>• Certifique-se de que o email informado está correto</li>
              <li>• Aguarde alguns minutos, pode haver um pequeno atraso</li>
            </ul>
          </div>
          
          <div className="mt-6">
            <Link 
              href="/auth/recruiter"
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Voltar e tentar novamente
            </Link>
          </div>
        </div>
      </div>
    </>
  );
} 