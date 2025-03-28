import { useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
import { useRouter } from "next/router";
import { useEffect } from "react";

export function useAuth(requiredRole?: UserRole) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/auth/login");
      return;
    }

    if (requiredRole && session.user.role !== requiredRole) {
      router.push("/auth/unauthorized");
    }
  }, [session, status, requiredRole, router]);

  return {
    user: session?.user,
    isAuthenticated: !!session,
    isLoading: status === "loading",
    role: session?.user.role,
  };
} 