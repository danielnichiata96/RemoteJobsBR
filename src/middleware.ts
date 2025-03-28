import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Rotas protegidas para candidatos
    if (path.startsWith("/candidate") && token?.role !== UserRole.CANDIDATE) {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }

    // Rotas protegidas para empresas
    if (path.startsWith("/company") && token?.role !== UserRole.COMPANY) {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }

    // Rotas protegidas para administradores
    if (path.startsWith("/admin") && token?.role !== UserRole.ADMIN) {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/candidate/:path*",
    "/company/:path*",
    "/admin/:path*",
    "/profile/:path*",
  ],
}; 