import { useState } from 'react';
import SimpleApplicationsReview from '../components/profile/company/SimpleApplicationsReview';

export default function SimpleDemo(props) {
  return (
    <div className="bg-gray-50 min-h-screen">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Demonstração do Componente de Revisão de Candidaturas</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-gray-700 mb-4">
            Este é um componente simplificado para revisão de candidaturas a vagas. 
            Foi implementado sem dependências externas como HeadlessUI ou HeroIcons para facilitar a visualização.
          </p>
          
          <SimpleApplicationsReview 
            jobId="1" 
            jobTitle="Desenvolvedor Full Stack" 
          />
        </div>
      </main>

      <footer className="bg-white shadow mt-8 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-500 text-sm">
            © 2023 RemoteJobsBR. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
} 