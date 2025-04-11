import { SessionProvider, useSession } from 'next-auth/react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect } from 'react';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { setUser, clearUser } from '@/lib/sentry';
import '../styles/globals.css';

// Component to synchronize session user with Sentry
function SentryUserSync() {
  const { data: session } = useSession();
  
  useEffect(() => {
    if (session?.user) {
      // When user logs in, set their info in Sentry
      setUser({
        id: session.user.id as string,
        email: session.user.email as string,
        role: session.user.role as string,
      });
    } else {
      // When user logs out, clear their info from Sentry
      clearUser();
    }
  }, [session]);
  
  return null; // This component doesn't render anything
}

export default function App({ 
  Component, 
  pageProps: { session, ...pageProps } 
}: AppProps) {
  return (
    <SessionProvider session={session}>
      {/* SentryUserSync sets user info for error tracking */}
      <SentryUserSync />
      
      <Head>
        <title>RemoteJobsBR - Vagas Remotas Internacionais para Brasileiros</title>
        <meta name="description" content="Encontre vagas remotas em empresas internacionais para profissionais brasileiros" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      {/* ErrorBoundary catches and reports errors */}
      <ErrorBoundary>
        <Component {...pageProps} />
      </ErrorBoundary>
    </SessionProvider>
  );
} 