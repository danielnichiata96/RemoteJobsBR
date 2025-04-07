import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import LinkedInProvider from 'next-auth/providers/linkedin';
import EmailProvider from 'next-auth/providers/email';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { parse } from 'cookie';
import bcrypt from 'bcryptjs';
import { z } from "zod";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID || '',
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
    }),
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
      maxAge: 24 * 60 * 60, // 24 hours
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email e senha são obrigatórios");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user) {
          console.log(`[authorize] User not found: ${credentials.email}`);
          throw new Error("Credenciais inválidas");
        }

        if (!user.password) {
          console.log(`[authorize] User ${user.id} has no password (magic/social)`);
          throw new Error("NO_PASSWORD");
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isValidPassword) {
          console.log(`[authorize] Invalid password for user ${user.id}`);
          throw new Error("Credenciais inválidas");
        }

        console.log(`[authorize] Credentials valid for user ${user.id}`);
        return user;
      }
    }),
  ],
  pages: {
    signIn: '/login',
    signOut: '/',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/register',
  },
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      // Verificar se há cookie de role ao fazer login
      if (account?.provider === 'email' && user) {
        try {
          // Se o usuário estiver fazendo login com email, verificar cookie para role
          const cookies = parse(
            (email?.verificationRequest as any)?.cookies || ''
          );
          
          if (cookies?.auth_role === 'COMPANY') {
            // Definir papel como COMPANY
            await prisma.user.update({
              where: { id: user.id },
              data: { role: UserRole.COMPANY },
            });
          }
        } catch (error) {
          console.error('Erro ao verificar cookie:', error);
        }
      }
      return true;
    },
    async jwt({ token, user, account, profile, trigger, session }) {
      // Se for um novo login, atualizar token com dados do usuário
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || UserRole.CANDIDATE;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};

export default NextAuth(authOptions); 