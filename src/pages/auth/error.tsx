import { useSearchParams } from "next/navigation";
import Link from "next/link";

const errors = {
  Signin: "Tente fazer login com uma conta diferente.",
  OAuthSignin: "Tente fazer login com uma conta diferente.",
  OAuthCallback: "Tente fazer login com uma conta diferente.",
  OAuthCreateAccount: "Tente fazer login com uma conta diferente.",
  EmailCreateAccount: "Tente fazer login com uma conta diferente.",
  Callback: "Tente fazer login com uma conta diferente.",
  OAuthAccountNotLinked:
    "Para confirmar sua identidade, faça login com a mesma conta que você usou originalmente.",
  EmailSignin: "O link de login enviado por email expirou ou já foi usado.",
  CredentialsSignin:
    "Login falhou. Verifique se as credenciais fornecidas estão corretas.",
  SessionRequired: "Por favor, faça login para acessar esta página.",
  Default: "Não foi possível fazer login.",
};

export default function ErrorPage(props) {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const errorMessage = error && (errors[error as keyof typeof errors] ?? errors.Default);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Erro de Autenticação
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {errorMessage}
        </p>
        <div className="mt-4 text-center">
          <Link
            href="/auth/login"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
} 