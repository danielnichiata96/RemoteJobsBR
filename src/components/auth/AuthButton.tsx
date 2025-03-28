import { signIn, signOut, useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
import Link from "next/link";

export function AuthButton() {
  const { data: session } = useSession();

  if (session) {
    return (
      <div className="flex items-center gap-4">
        <Link
          href={
            session.user.role === UserRole.CANDIDATE
              ? "/candidate/profile"
              : "/company/profile"
          }
          className="text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          Perfil
        </Link>
        <button
          onClick={() => signOut()}
          className="text-sm font-medium text-red-600 hover:text-red-800"
        >
          Sair
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => signIn()}
        className="text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        Entrar
      </button>
      <Link
        href="/auth/register"
        className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md"
      >
        Cadastrar
      </Link>
    </div>
  );
} 