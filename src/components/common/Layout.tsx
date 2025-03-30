import Head from 'next/head';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { ReactNode, useState, useRef, useEffect } from 'react';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export default function Layout({
  children,
  title = 'RemoteJobsBR - Vagas Remotas Internacionais para Brasileiros',
  description = 'Encontre vagas remotas em empresas internacionais para profissionais brasileiros',
}: LayoutProps) {
  // CSS variables for consistent styling
  const colors = {
    primary: 'text-primary-600',
    primaryBg: 'bg-primary-600',
    primaryHover: 'hover:bg-primary-700',
    secondary: 'text-gray-700',
    secondaryHover: 'hover:text-primary-600',
    accent: 'bg-green-600',
    accentHover: 'hover:bg-green-700',
    outline: 'border border-gray-300',
    outlineHover: 'hover:bg-gray-50',
  };
  
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const firstMobileItemRef = useRef<HTMLAnchorElement>(null);
  
  const showDropdown = () => setDropdownVisible(true);
  const hideDropdown = () => setDropdownVisible(false);
  
  // Para depuração: imprimir o papel do usuário no console
  useEffect(() => {
    if (session && session.user) {
      console.log('User role:', session.user.role);
    }
  }, [session]);
  
  // Função para impedir que o menu desapareça ao mover o mouse
  const handleMouseLeave = () => {
    // Adicionar um pequeno delay antes de fechar o menu
    setTimeout(() => {
      if (!dropdownRef.current?.matches(':hover')) {
        hideDropdown();
      }
    }, 300);
  };
  
  // Focus management for mobile menu
  useEffect(() => {
    if (mobileMenuOpen && firstMobileItemRef.current) {
      firstMobileItemRef.current.focus();
    }
  }, [mobileMenuOpen]);

  // Handle escape key for dropdown and mobile menu
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (dropdownVisible) {
          hideDropdown();
        }
        if (mobileMenuOpen) {
          setMobileMenuOpen(false);
          mobileButtonRef.current?.focus();
        }
      }
    };
    
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [dropdownVisible, mobileMenuOpen]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-['Outfit']">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            {/* Logo à esquerda */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center" aria-label="RemoteJobsBR - Home">
                <img 
                  src="/images/logo-rjbr.svg" 
                  alt="RemoteJobsBR Logo" 
                  className="h-10 w-auto mr-3" 
                />
                <span className={`text-xl font-semibold ${colors.primary}`}>RemoteJobsBR</span>
              </Link>
            
              {/* Links para candidatos à esquerda/centro */}
              <div className="hidden md:flex ml-10 space-x-8">
                <Link href="/jobs" className={`${colors.secondary} ${colors.secondaryHover} font-medium`} aria-label="Explorar vagas disponíveis">
                  Vagas
                </Link>
                <Link href="/about" className={`${colors.secondary} ${colors.secondaryHover} font-medium`} aria-label="Sobre nossa empresa">
                  Sobre
                </Link>
                <Link href="/resources" className={`${colors.secondary} ${colors.secondaryHover} font-medium`} aria-label="Recursos para candidatos">
                  Recursos
                </Link>
              </div>
            </div>

            {/* Botões à direita */}
            <div className="hidden md:flex items-center space-x-4">
              {/* Botão primário para recrutadores */}
              <Link 
                href="/auth/recruiter" 
                className={`text-white ${colors.accent} ${colors.accentHover} px-4 py-2 rounded-md font-medium transition-colors`}
                aria-label="Publicar uma nova vaga"
              >
                Post a Job
              </Link>
              
              {/* Login ou Perfil do Usuário */}
              {session ? (
                <div className="relative" 
                  onMouseEnter={showDropdown}
                  onMouseLeave={handleMouseLeave}
                  onBlur={() => setTimeout(hideDropdown, 100)}
                  ref={dropdownRef}
                >
                  <button
                    className={`flex items-center ${colors.secondary} ${colors.secondaryHover} font-medium`}
                    aria-haspopup="true"
                    aria-expanded={dropdownVisible}
                    aria-label="Menu do usuário"
                  >
                    <span className="mr-1">{session.user.name || 'Minha Conta'}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {dropdownVisible && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 transition-opacity duration-200 ease-in-out">
                      {(session.user.role === 'COMPANY' || session.user.role === 'company') && (
                        <Link href="/recruiter/dashboard" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none" aria-label="Acessar o painel de recrutador">
                          Dashboard
                        </Link>
                      )}
                      
                      <Link href="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none" aria-label="Visualizar seu perfil">
                        Meu Perfil
                      </Link>
                      
                      {(session.user.role === 'COMPANY' || session.user.role === 'company') ? (
                        // Opções de menu para recrutadores
                        <>
                          <Link href="/recruiter/dashboard/jobs" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none" aria-label="Gerenciar suas vagas publicadas">
                            Gerenciar Vagas
                          </Link>
                          <Link href="/recruiter/dashboard/applications" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none" aria-label="Ver candidaturas recebidas">
                            Candidaturas Recebidas
                          </Link>
                        </>
                      ) : (
                        // Opções de menu para candidatos
                        <>
                          <Link href="/applications" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none" aria-label="Ver suas candidaturas">
                            Minhas Candidaturas
                          </Link>
                          <Link href="/saved-jobs" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none" aria-label="Ver vagas salvas">
                            Vagas Salvas
                          </Link>
                        </>
                      )}
                      
                      <button
                        onClick={() => signOut()}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                        aria-label="Sair da sua conta"
                      >
                        Sair
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link 
                  href="/login" 
                  className={`${colors.secondary} ${colors.outline} ${colors.outlineHover} px-4 py-2 rounded-md font-medium transition-colors`}
                  aria-label="Fazer login na sua conta"
                >
                  Login
                </Link>
              )}
            </div>

            {/* Botão do Menu Mobile */}
            <button
              ref={mobileButtonRef}
              className="md:hidden text-gray-700"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                className="h-6 w-6"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>

          {/* Menu Mobile */}
          {/* Using max-height transition for smooth animation */}
          <div 
            className={`md:hidden transition-all duration-300 ease-in-out overflow-hidden ${mobileMenuOpen ? 'max-h-screen opacity-100 visible' : 'max-h-0 opacity-0 invisible'}`}
          >
            <nav className="mt-4 pt-4 border-t flex flex-col space-y-4">
              <Link
                ref={firstMobileItemRef}
                href="/jobs"
                className={`${colors.secondary} ${colors.secondaryHover} py-2 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-2`}
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Explorar vagas disponíveis"
              >
                Vagas
              </Link>
              <Link
                href="/about"
                className={`${colors.secondary} ${colors.secondaryHover} py-2 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-2`}
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Sobre nossa empresa"
              >
                Sobre
              </Link>
              <Link
                href="/resources"
                className={`${colors.secondary} ${colors.secondaryHover} py-2 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-2`}
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Recursos para candidatos"
              >
                Recursos
              </Link>
              
              {/* Botão para recrutadores */}
              <Link 
                href="/auth/recruiter"
                className={`text-white ${colors.accent} ${colors.accentHover} py-2 px-4 rounded-md font-medium transition-colors text-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Publicar uma nova vaga"
              >
                Post a Job
              </Link>
              
              {session ? (
                <>
                  {(session.user.role === 'COMPANY' || session.user.role === 'company') && (
                    <Link
                      href="/recruiter/dashboard"
                      className={`${colors.secondary} ${colors.secondaryHover} py-2 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-2`}
                      onClick={() => setMobileMenuOpen(false)}
                      aria-label="Acessar o painel de recrutador"
                    >
                      Dashboard
                    </Link>
                  )}
                  <Link
                    href="/profile"
                    className={`${colors.secondary} ${colors.secondaryHover} py-2 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-2`}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Visualizar seu perfil"
                  >
                    Meu Perfil
                  </Link>
                  
                  {(session.user.role === 'COMPANY' || session.user.role === 'company') ? (
                    // Opções de menu para recrutadores
                    <>
                      <Link
                        href="/recruiter/dashboard/jobs"
                        className={`${colors.secondary} ${colors.secondaryHover} py-2 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-2`}
                        onClick={() => setMobileMenuOpen(false)}
                        aria-label="Gerenciar suas vagas publicadas"
                      >
                        Gerenciar Vagas
                      </Link>
                      <Link
                        href="/recruiter/dashboard/applications"
                        className={`${colors.secondary} ${colors.secondaryHover} py-2 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-2`}
                        onClick={() => setMobileMenuOpen(false)}
                        aria-label="Ver candidaturas recebidas"
                      >
                        Candidaturas Recebidas
                      </Link>
                    </>
                  ) : (
                    // Opções de menu para candidatos
                    <>
                      <Link
                        href="/applications"
                        className={`${colors.secondary} ${colors.secondaryHover} py-2 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-2`}
                        onClick={() => setMobileMenuOpen(false)}
                        aria-label="Ver suas candidaturas"
                      >
                        Minhas Candidaturas
                      </Link>
                      <Link
                        href="/saved-jobs"
                        className={`${colors.secondary} ${colors.secondaryHover} py-2 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-2`}
                        onClick={() => setMobileMenuOpen(false)}
                        aria-label="Ver vagas salvas"
                      >
                        Vagas Salvas
                      </Link>
                    </>
                  )}
                  
                  <button
                    onClick={() => {
                      signOut();
                      setMobileMenuOpen(false);
                    }}
                    className={`text-left ${colors.secondary} ${colors.secondaryHover} py-2 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-2`}
                    aria-label="Sair da sua conta"
                  >
                    Sair
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className={`${colors.secondary} ${colors.outline} ${colors.outlineHover} py-2 px-4 rounded-md font-medium transition-colors text-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500`}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Fazer login na sua conta"
                >
                  Login
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {children}
      </main>

      <footer className="bg-gray-800 text-white pt-16 pb-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h2 className="text-2xl font-bold mb-4">Remote Jobs BR</h2>
              <p className="text-gray-300 mb-4">
                Conectando talentos brasileiros a oportunidades remotas internacionais desde 2025.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-300 hover:text-white" aria-label="Facebook">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                  </svg>
                </a>
                <a href="#" className="text-gray-300 hover:text-white" aria-label="Twitter">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                  </svg>
                </a>
                <a href="#" className="text-gray-300 hover:text-white" aria-label="GitHub">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                </a>
                <a href="#" className="text-gray-300 hover:text-white" aria-label="Dribbble">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.51 0 10-4.48 10-10S17.51 2 12 2zm6.605 4.61a8.502 8.502 0 011.93 5.314c-.281-.054-3.101-.629-5.943-.271-.065-.141-.12-.293-.184-.445a25.416 25.416 0 00-.564-1.236c3.145-1.28 4.577-3.124 4.761-3.362zM12 3.475c2.17 0 4.154.813 5.662 2.148-.152.216-1.443 1.941-4.48 3.08-1.399-2.57-2.95-4.675-3.189-5A8.687 8.687 0 0112 3.475zm-3.633.803a53.896 53.896 0 013.167 4.935c-3.992 1.063-7.517 1.04-7.896 1.04a8.581 8.581 0 014.729-5.975zM3.453 12.01v-.26c.37.01 4.512.065 8.775-1.215.25.477.477.965.694 1.453-.109.033-.228.065-.336.098-4.404 1.42-6.747 5.303-6.942 5.629a8.522 8.522 0 01-2.19-5.705zM12 20.547a8.482 8.482 0 01-5.239-1.8c.152-.315 1.888-3.656 6.703-5.337.022-.01.033-.01.054-.022a35.318 35.318 0 011.823 6.475 8.4 8.4 0 01-3.341.684zm4.761-1.465c-.086-.52-.542-3.015-1.659-6.084 2.679-.423 5.022.271 5.314.369a8.468 8.468 0 01-3.655 5.715z" clipRule="evenodd" />
                  </svg>
                </a>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Navegação</h3>
              <ul className="space-y-2">
                <li><Link href="/" className="text-gray-300 hover:text-white focus:outline-none focus:text-white" aria-label="Página inicial">Home</Link></li>
                <li><Link href="/jobs" className="text-gray-300 hover:text-white focus:outline-none focus:text-white" aria-label="Explorar vagas disponíveis">Vagas</Link></li>
                <li><Link href="/companies" className="text-gray-300 hover:text-white focus:outline-none focus:text-white" aria-label="Ver empresas">Empresas</Link></li>
                <li><Link href="/about" className="text-gray-300 hover:text-white focus:outline-none focus:text-white" aria-label="Sobre nossa empresa">Sobre</Link></li>
                <li><Link href="/blog" className="text-gray-300 hover:text-white focus:outline-none focus:text-white" aria-label="Ler nosso blog">Blog</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Para Empresas</h3>
              <ul className="space-y-2">
                <li><Link href="/post-job" className="text-gray-300 hover:text-white focus:outline-none focus:text-white" aria-label="Publicar uma nova vaga">Publicar Vaga</Link></li>
                <li><Link href="/pricing" className="text-gray-300 hover:text-white focus:outline-none focus:text-white" aria-label="Ver planos e preços">Planos e Preços</Link></li>
                <li><Link href="/resources" className="text-gray-300 hover:text-white focus:outline-none focus:text-white" aria-label="Acessar recursos">Recursos</Link></li>
                <li><Link href="/partners" className="text-gray-300 hover:text-white focus:outline-none focus:text-white" aria-label="Ver nossos parceiros">Parceiros</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li><Link href="/privacy" className="text-gray-300 hover:text-white focus:outline-none focus:text-white" aria-label="Política de privacidade">Privacidade</Link></li>
                <li><Link href="/terms" className="text-gray-300 hover:text-white focus:outline-none focus:text-white" aria-label="Termos de uso">Termos de Uso</Link></li>
                <li><Link href="/cookies" className="text-gray-300 hover:text-white focus:outline-none focus:text-white" aria-label="Política de cookies">Política de Cookies</Link></li>
                <li><Link href="/contact" className="text-gray-300 hover:text-white focus:outline-none focus:text-white" aria-label="Entre em contato">Contato</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-12 pt-8 text-center text-gray-400">
            <p>© {new Date().getFullYear()} RemoteJobsBR. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
} 