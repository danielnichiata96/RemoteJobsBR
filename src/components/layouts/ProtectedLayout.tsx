import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@prisma/client";

interface ProtectedLayoutProps {
  children: ReactNode;
  requiredRole?: UserRole;
}

export function ProtectedLayout({ children, requiredRole }: ProtectedLayoutProps) {
  const { isAuthenticated, isLoading, role } = useAuth(requiredRole);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // O hook useAuth já redireciona para a página de login
  }

  if (requiredRole && role !== requiredRole) {
    return null; // O hook useAuth já redireciona para a página de não autorizado
  }

  return <>{children}</>;
} 