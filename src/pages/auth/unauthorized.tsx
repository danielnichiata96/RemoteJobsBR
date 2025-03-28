import Link from "next/link";

export default function UnauthorizedPage(props) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Acesso Negado
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Você não tem permissão para acessar esta página.
        </p>
        <div className="mt-4 text-center">
          <Link
            href="/"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            Voltar para a página inicial
          </Link>
        </div>
      </div>
    </div>
  );
} 