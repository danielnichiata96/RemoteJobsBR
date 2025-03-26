import { useState } from 'react';

export default function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setMessage({ type: 'error', text: 'Por favor, informe seu email.' });
      return;
    }
    
    setIsSubmitting(true);
    setMessage(null);
    
    try {
      // Simulação de chamada de API
      // TODO: Implementar chamada real para a API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setEmail('');
      setMessage({ 
        type: 'success', 
        text: 'Cadastro realizado! Verifique seu email para confirmar sua inscrição.' 
      });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: 'Ocorreu um erro ao cadastrar seu email. Tente novamente.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-primary-50 py-12 px-4 sm:px-6 lg:px-8 rounded-xl">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Receba vagas exclusivas no seu email
        </h2>
        <p className="mt-3 text-lg text-gray-600">
          Cadastre-se para receber as melhores oportunidades remotas internacionais para brasileiros.
        </p>
        
        <form onSubmit={handleSubmit} className="mt-8 sm:flex max-w-lg mx-auto">
          <label htmlFor="email-address" className="sr-only">Email</label>
          <input
            id="email-address"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-md border-gray-300 shadow-sm px-5 py-3 placeholder-gray-400 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Seu melhor email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
          />
          <div className="mt-3 sm:mt-0 sm:ml-3 sm:flex-shrink-0">
            <button
              type="submit"
              className="w-full flex justify-center py-3 px-5 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Cadastrando...' : 'Cadastrar'}
            </button>
          </div>
        </form>
        
        {message && (
          <div className={`mt-4 text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </div>
        )}
        
        <p className="mt-3 text-sm text-gray-500">
          Prometemos não enviar spam. Você pode cancelar a qualquer momento.
        </p>
      </div>
    </div>
  );
} 