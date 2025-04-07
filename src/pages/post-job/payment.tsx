import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Layout from '../../components/common/Layout';

// Mockup dos planos de publicação
const PLANS = [
  {
    id: 'basic',
    name: 'Básico',
    price: 149,
    duration: 30,
    features: [
      'Visibilidade por 30 dias',
      'Destaque na categoria',
      'Até 50 candidaturas'
    ]
  },
  {
    id: 'standard',
    name: 'Padrão',
    price: 299,
    duration: 30,
    featured: true,
    features: [
      'Visibilidade por 30 dias',
      'Destaque na página inicial',
      'Candidaturas ilimitadas',
      'Destaque nos emails da newsletter'
    ]
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 499,
    duration: 60,
    features: [
      'Visibilidade por 60 dias',
      'Destaque na página inicial',
      'Candidaturas ilimitadas',
      'Destaque nos emails da newsletter',
      'Compartilhamento em redes sociais',
      'Suporte prioritário'
    ]
  }
];

export default function JobPayment(props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { jobId } = router.query;
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('standard');
  
  // Estado para informações de pagamento (mockup simples)
  const [paymentInfo, setPaymentInfo] = useState({
    cardName: '',
    cardNumber: '',
    expiry: '',
    cvc: ''
  });
  
  useEffect(() => {
    // Verificar autenticação
    if (status === 'unauthenticated') {
      // Enviar para o login de recrutador com o returnTo
      router.push('/login?type=recruiter&returnTo=/post-job/review');
      return;
    }

    // Verificar se o usuário é um recrutador
    if (status === 'authenticated' && session?.user?.role !== 'COMPANY') {
      // Se for um candidato, redirecionar para a página de conversão
      router.push(`/convert-to-recruiter?returnTo=${encodeURIComponent(router.asPath)}`);
      return;
    }
    
    // Carregar detalhes da vaga se tiver jobId e estiver autenticado
    if (jobId && status === 'authenticated') {
      fetchJobDetails();
    } else if (status !== 'loading' && !jobId) {
      // Sem jobId, voltar para o início do fluxo
      router.push('/post-job');
    }
  }, [status, jobId, router, session]);
  
  const fetchJobDetails = async () => {
    try {
      const response = await fetch(`/api/recruiter/jobs/${jobId}`);
      if (!response.ok) {
        throw new Error('Erro ao carregar detalhes da vaga');
      }
      
      const data = await response.json();
      setJob(data.job);
    } catch (error) {
      console.error('Erro:', error);
      setError('Não foi possível carregar os detalhes da vaga. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };
  
  const handlePaymentInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPaymentInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handlePlanChange = (planId: string) => {
    setSelectedPlan(planId);
  };
  
  const getCurrentPlan = () => {
    return PLANS.find(plan => plan.id === selectedPlan);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!job || !jobId) {
      setError('Informações da vaga não encontradas');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      // Simular processamento de pagamento
      // Em produção, você integraria com Stripe, PayPal, etc.
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Após "pagamento" bem sucedido, atualizar status da vaga para ACTIVE
      const response = await fetch(`/api/recruiter/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'ACTIVE',
          publishedAt: new Date().toISOString()
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar status da vaga');
      }
      
      // Redirecionar para página de sucesso
      router.push('/post-job/success');
    } catch (error: any) {
      console.error('Erro:', error);
      setError(error.message || 'Ocorreu um erro ao processar o pagamento.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (status === 'loading' || loading) {
    return (
      <Layout title="Carregando... | RemoteJobsBR">
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout title="Pagamento | RemoteJobsBR">
      <div className="max-w-6xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-2">Finalizar Publicação</h1>
        <p className="text-gray-600 mb-8">Escolha um plano e finalize o pagamento para publicar sua vaga.</p>
        
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        {job && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white shadow-md rounded-lg overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold mb-6">Escolha seu plano</h2>
                  
                  <div className="space-y-4">
                    {PLANS.map(plan => (
                      <div 
                        key={plan.id}
                        className={`border rounded-lg p-4 transition-all ${
                          selectedPlan === plan.id 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-blue-300'
                        } ${plan.featured ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}
                      >
                        <label className="flex items-start cursor-pointer">
                          <input 
                            type="radio"
                            name="plan"
                            value={plan.id}
                            checked={selectedPlan === plan.id}
                            onChange={() => handlePlanChange(plan.id)}
                            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                          />
                          <div className="ml-3 flex-1">
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="font-medium text-gray-900">{plan.name}</span>
                                {plan.featured && (
                                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    Mais Popular
                                  </span>
                                )}
                              </div>
                              <span className="text-xl font-bold text-gray-900">R${plan.price}</span>
                            </div>
                            <p className="text-sm text-gray-500 mb-2">Duração: {plan.duration} dias</p>
                            <ul className="mt-2 space-y-1">
                              {plan.features.map((feature, index) => (
                                <li key={index} className="flex items-start">
                                  <svg className="h-5 w-5 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-sm text-gray-600">{feature}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6">
                  <h2 className="text-xl font-semibold mb-6">Detalhes do Pagamento</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="cardName" className="block text-sm font-medium text-gray-700 mb-1">
                        Nome no Cartão
                      </label>
                      <input
                        type="text"
                        id="cardName"
                        name="cardName"
                        required
                        value={paymentInfo.cardName}
                        onChange={handlePaymentInfoChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Nome completo"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-700 mb-1">
                        Número do Cartão
                      </label>
                      <input
                        type="text"
                        id="cardNumber"
                        name="cardNumber"
                        required
                        value={paymentInfo.cardNumber}
                        onChange={handlePaymentInfoChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="1234 5678 9012 3456"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="expiry" className="block text-sm font-medium text-gray-700 mb-1">
                          Data de Expiração
                        </label>
                        <input
                          type="text"
                          id="expiry"
                          name="expiry"
                          required
                          value={paymentInfo.expiry}
                          onChange={handlePaymentInfoChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="MM/AA"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="cvc" className="block text-sm font-medium text-gray-700 mb-1">
                          CVC
                        </label>
                        <input
                          type="text"
                          id="cvc"
                          name="cvc"
                          required
                          value={paymentInfo.cvc}
                          onChange={handlePaymentInfoChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="123"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`w-full ${
                        isSubmitting ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
                      } text-white py-3 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                    >
                      {isSubmitting ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processando Pagamento...
                        </span>
                      ) : (
                        `Pagar R$${getCurrentPlan()?.price} e Publicar Vaga`
                      )}
                    </button>
                    
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Seus dados de pagamento estão seguros e criptografados.
                    </p>
                  </div>
                </form>
              </div>
            </div>
            
            <div className="lg:col-span-1">
              <div className="bg-white shadow-md rounded-lg p-6 sticky top-24">
                <h2 className="text-xl font-semibold mb-4">Resumo do Pedido</h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-700">Sua vaga</h3>
                    <p className="text-gray-900 font-medium">{job.title}</p>
                    <p className="text-sm text-gray-500">{job.location}</p>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="font-medium text-gray-700 mb-2">Plano selecionado</h3>
                    <p className="font-medium">{getCurrentPlan()?.name}</p>
                    <p className="text-sm text-gray-500">Duração: {getCurrentPlan()?.duration} dias</p>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Subtotal</span>
                      <span>R${getCurrentPlan()?.price}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Impostos</span>
                      <span>R$0,00</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200">
                      <span>Total</span>
                      <span>R${getCurrentPlan()?.price}</span>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-500 mt-4">
                    <p>
                      Ao finalizar a compra você concorda com nossos{' '}
                      <a href="/terms" className="text-blue-600 hover:text-blue-500">
                        Termos de Serviço
                      </a>
                      {' '}e{' '}
                      <a href="/privacy" className="text-blue-600 hover:text-blue-500">
                        Política de Privacidade
                      </a>
                      .
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
} 