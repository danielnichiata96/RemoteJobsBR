import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { UserRole } from '@prisma/client';

// Esta página apenas redireciona para o perfil apropriado com base no tipo de usuário
export default function ProfileRedirect(props: InferGetServerSidePropsType<typeof getServerSideProps>) {
  // Esta página nunca será renderizada no lado do cliente
  // pois o redirecionamento acontece no servidor
  return null;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  console.log('Iniciando redirecionamento de /profile');
  
  try {
    const session = await getServerSession(context.req, context.res, authOptions);
    
    console.log('Sessão obtida:', 
      session ? { 
        name: session.user?.name, 
        email: session.user?.email,
        role: session.user?.role 
      } : 'Sem sessão'
    );

    // Se não estiver autenticado, redireciona para o login
    if (!session || !session.user) {
      console.log('Usuário não autenticado, redirecionando para login');
      return {
        redirect: {
          destination: '/auth/signin',
          permanent: false,
        },
      };
    }

    // Acessa o papel do usuário (role) da sessão
    const userRole = session.user.role as UserRole | undefined;
    console.log('Papel do usuário (role):', userRole);

    // Redireciona com base no tipo de usuário
    if (userRole === UserRole.CANDIDATE) {
      console.log('Usuário é um candidato, redirecionando para /candidate/profile');
      return {
        redirect: {
          destination: '/candidate/profile',
          permanent: false,
        },
      };
    } else if (userRole === UserRole.RECRUITER) {
      console.log('Usuário é um recrutador, redirecionando para /recruiter/profile');
      return {
        redirect: {
          destination: '/recruiter/profile',
          permanent: false,
        },
      };
    }

    // Caso o papel do usuário não seja reconhecido, redireciona para a página inicial
    console.log('Papel do usuário não reconhecido, redirecionando para página inicial');
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  } catch (error) {
    console.error('Erro durante o redirecionamento:', error);
    // Em caso de erro, redireciona para a página inicial
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }
} 