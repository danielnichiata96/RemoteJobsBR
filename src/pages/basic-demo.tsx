import { useState } from 'react';

export default function BasicDemo(props) {
  // Dados simulados de candidatos
  const initialCandidates = [
    {
      id: '1',
      name: 'João Silva',
      email: 'joao.silva@example.com',
      skills: ['React', 'TypeScript', 'Node.js'],
      status: 'pending',
      appliedAt: '2023-06-18'
    },
    {
      id: '2',
      name: 'Maria Souza',
      email: 'maria.souza@example.com',
      skills: ['UI/UX Design', 'Figma', 'Adobe XD'],
      status: 'interviewing',
      appliedAt: '2023-06-15'
    },
    {
      id: '3',
      name: 'Pedro Santos',
      email: 'pedro.santos@example.com',
      skills: ['Python', 'Django', 'AWS'],
      status: 'reviewed',
      appliedAt: '2023-06-10'
    }
  ];

  const [candidates, setCandidates] = useState(initialCandidates);
  const [filter, setFilter] = useState('all');
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  // Função para filtrar candidatos
  const filteredCandidates = filter === 'all' 
    ? candidates 
    : candidates.filter(c => c.status === filter);

  // Função para obter texto do status
  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'reviewed': return 'Analisado';
      case 'interviewing': return 'Em entrevista';
      case 'rejected': return 'Rejeitado';
      case 'hired': return 'Contratado';
      default: return '';
    }
  };

  // Função para obter emoji do status
  const getStatusEmoji = (status) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'reviewed': return '✅';
      case 'interviewing': return '👥';
      case 'rejected': return '❌';
      case 'hired': return '🎉';
      default: return '';
    }
  };

  // Função para atualizar status
  const updateStatus = (id, newStatus) => {
    setCandidates(candidates.map(c => 
      c.id === id ? {...c, status: newStatus} : c
    ));
    
    if (selectedCandidate && selectedCandidate.id === id) {
      setSelectedCandidate({...selectedCandidate, status: newStatus});
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen p-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Demonstração de Gerenciamento de Candidaturas</h1>
        
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Candidaturas para: Desenvolvedor Full Stack</h2>
            
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className="border rounded px-2 py-1"
            >
              <option value="all">Todos</option>
              <option value="pending">Pendentes</option>
              <option value="reviewed">Analisados</option>
              <option value="interviewing">Em entrevista</option>
              <option value="rejected">Rejeitados</option>
              <option value="hired">Contratados</option>
            </select>
          </div>
          
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidato</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Habilidades</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCandidates.map(candidate => (
                <tr key={candidate.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{candidate.name}</div>
                    <div className="text-sm text-gray-500">{candidate.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {candidate.skills.map((skill, index) => (
                        <span key={index} className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="mr-1">{getStatusEmoji(candidate.status)}</span>
                      <span className="text-sm text-gray-700">{getStatusText(candidate.status)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => setSelectedCandidate(candidate)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Ver detalhes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {selectedCandidate && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-screen overflow-y-auto">
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-medium text-gray-900">{selectedCandidate.name}</h3>
                <button 
                  onClick={() => setSelectedCandidate(null)} 
                  className="text-gray-400 hover:text-gray-500"
                >
                  ✕
                </button>
              </div>
              
              <div className="mt-4">
                <div className="flex items-center mb-2">
                  <span className="mr-1">{getStatusEmoji(selectedCandidate.status)}</span>
                  <span className="text-sm text-gray-700">{getStatusText(selectedCandidate.status)}</span>
                </div>
                
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Email:</span> {selectedCandidate.email}
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  <span className="font-medium">Data de candidatura:</span> {selectedCandidate.appliedAt}
                </p>
                
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">Habilidades</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedCandidate.skills.map((skill, index) => (
                      <span key={index} className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">Ações</h4>
                  <div className="space-y-2">
                    {selectedCandidate.status === 'pending' && (
                      <button
                        onClick={() => updateStatus(selectedCandidate.id, 'reviewed')}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                      >
                        Marcar como Analisado
                      </button>
                    )}
                    
                    {['pending', 'reviewed'].includes(selectedCandidate.status) && (
                      <button
                        onClick={() => updateStatus(selectedCandidate.id, 'interviewing')}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
                      >
                        Chamar para Entrevista
                      </button>
                    )}
                    
                    {selectedCandidate.status === 'interviewing' && (
                      <button
                        onClick={() => updateStatus(selectedCandidate.id, 'hired')}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                      >
                        Marcar como Contratado
                      </button>
                    )}
                    
                    {['pending', 'reviewed', 'interviewing'].includes(selectedCandidate.status) && (
                      <button
                        onClick={() => updateStatus(selectedCandidate.id, 'rejected')}
                        className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Rejeitar Candidatura
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 