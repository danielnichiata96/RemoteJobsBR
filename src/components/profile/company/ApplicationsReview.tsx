import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Fragment } from 'react';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon,
  EnvelopeIcon,
  PhoneIcon,
  DocumentTextIcon,
  UserIcon,
  CalendarIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';

// Interfaces para as tipagens
interface Candidate {
  id: string;
  name: string;
  email: string;
  phone?: string;
  coverLetter?: string;
  resume?: {
    url: string;
    fileName: string;
  };
  skills: string[];
  appliedAt: string;
  profileImageUrl?: string;
  location?: string;
  status: 'pending' | 'reviewed' | 'interviewing' | 'rejected' | 'hired';
}

interface ApplicationsReviewProps {
  jobId: string;
  jobTitle: string;
}

export default function ApplicationsReview({ jobId, jobTitle }: ApplicationsReviewProps) {
  // Estado para armazenar as candidaturas (seria obtido de uma API)
  const [applications, setApplications] = useState<Candidate[]>([
    {
      id: '1',
      name: 'João Silva',
      email: 'joao.silva@email.com',
      phone: '(11) 98765-4321',
      coverLetter: 'Estou muito interessado nesta posição porque tenho experiência relevante em projetos similares...',
      resume: {
        url: '/resumes/joao-silva-cv.pdf',
        fileName: 'joao-silva-cv.pdf'
      },
      skills: ['React', 'TypeScript', 'Node.js', 'MongoDB'],
      appliedAt: '2023-06-18T14:30:00Z',
      profileImageUrl: 'https://randomuser.me/api/portraits/men/1.jpg',
      location: 'São Paulo, SP',
      status: 'pending'
    },
    {
      id: '2',
      name: 'Maria Souza',
      email: 'maria.souza@email.com',
      phone: '(21) 98765-4321',
      coverLetter: 'Acredito que minha formação e experiência anterior fazem de mim uma candidata ideal para esta posição...',
      resume: {
        url: '/resumes/maria-souza-cv.pdf',
        fileName: 'maria-souza-cv.pdf'
      },
      skills: ['UI/UX Design', 'Figma', 'Adobe XD', 'Pesquisa de Usuário'],
      appliedAt: '2023-06-17T10:15:00Z',
      profileImageUrl: 'https://randomuser.me/api/portraits/women/2.jpg',
      location: 'Rio de Janeiro, RJ',
      status: 'interviewing'
    },
    {
      id: '3',
      name: 'Pedro Santos',
      email: 'pedro.santos@email.com',
      coverLetter: 'Gostaria de aplicar para esta posição porque meus interesses e habilidades se alinham perfeitamente...',
      resume: {
        url: '/resumes/pedro-santos-cv.pdf',
        fileName: 'pedro-santos-cv.pdf'
      },
      skills: ['Python', 'Django', 'SQL', 'AWS'],
      appliedAt: '2023-06-15T16:45:00Z',
      location: 'Belo Horizonte, MG',
      status: 'reviewed'
    }
  ]);

  // Estado para o modal de candidato selecionado
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estado para filtros
  const [filter, setFilter] = useState('all');

  // Função para atualizar o status de uma candidatura
  const updateApplicationStatus = (applicationId: string, newStatus: Candidate['status']) => {
    setApplications(applications.map(app => 
      app.id === applicationId ? { ...app, status: newStatus } : app
    ));

    if (selectedCandidate && selectedCandidate.id === applicationId) {
      setSelectedCandidate({ ...selectedCandidate, status: newStatus });
    }
  };

  const openCandidateModal = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setIsModalOpen(true);
  };

  const closeCandidateModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedCandidate(null), 200);
  };

  // Função para filtrar candidaturas
  const getFilteredApplications = () => {
    if (filter === 'all') return applications;
    return applications.filter(app => app.status === filter);
  };

  // Formatação de data
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: pt });
  };

  // Função para obter o ícone de status
  const getStatusIcon = (status: Candidate['status']) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" aria-hidden="true" />;
      case 'reviewed':
        return <CheckCircleIcon className="h-5 w-5 text-blue-500" aria-hidden="true" />;
      case 'interviewing':
        return <UserIcon className="h-5 w-5 text-purple-500" aria-hidden="true" />;
      case 'rejected':
        return <XCircleIcon className="h-5 w-5 text-red-500" aria-hidden="true" />;
      case 'hired':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" aria-hidden="true" />;
      default:
        return null;
    }
  };

  // Função para obter o texto do status
  const getStatusText = (status: Candidate['status']) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'reviewed': return 'Analisado';
      case 'interviewing': return 'Em entrevista';
      case 'rejected': return 'Rejeitado';
      case 'hired': return 'Contratado';
      default: return '';
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Candidaturas para: {jobTitle}</h2>
        <div className="flex space-x-2">
          {/* Filtros de status */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md"
          >
            <option value="all">Todos os status</option>
            <option value="pending">Pendentes</option>
            <option value="reviewed">Analisados</option>
            <option value="interviewing">Em entrevista</option>
            <option value="rejected">Rejeitados</option>
            <option value="hired">Contratados</option>
          </select>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Nenhuma candidatura recebida para esta vaga ainda.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Candidato
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Habilidades
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data da Candidatura
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getFilteredApplications().map((application) => (
                <tr key={application.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openCandidateModal(application)}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {application.profileImageUrl ? (
                          <img
                            className="h-10 w-10 rounded-full"
                            src={application.profileImageUrl}
                            alt={application.name}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <UserIcon className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{application.name}</div>
                        <div className="text-sm text-gray-500">{application.email}</div>
                        {application.location && (
                          <div className="text-xs text-gray-500 flex items-center">
                            <MapPinIcon className="h-3 w-3 mr-1" />
                            {application.location}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {application.skills.slice(0, 3).map((skill, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800"
                        >
                          {skill}
                        </span>
                      ))}
                      {application.skills.length > 3 && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                          +{application.skills.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <div className="flex items-center">
                        <CalendarIcon className="h-4 w-4 mr-1 text-gray-400" />
                        {formatDate(application.appliedAt)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(application.status)}
                      <span className="ml-1 text-sm text-gray-700">
                        {getStatusText(application.status)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openCandidateModal(application);
                      }}
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
      )}

      {/* Modal simples em vez do componente HeadlessUI */}
      {isModalOpen && selectedCandidate && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4 text-center sm:block sm:p-0">
            <div 
              className="fixed inset-0 bg-black bg-opacity-30 transition-opacity"
              onClick={closeCandidateModal}
            ></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
              <div className="bg-white p-6">
                <div className="flex justify-between items-start">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-12 w-12">
                      {selectedCandidate.profileImageUrl ? (
                        <img
                          className="h-12 w-12 rounded-full"
                          src={selectedCandidate.profileImageUrl}
                          alt={selectedCandidate.name}
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                          <UserIcon className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">
                        {selectedCandidate.name}
                      </h3>
                      <div className="flex items-center mt-1">
                        {getStatusIcon(selectedCandidate.status)}
                        <span className="ml-1 text-sm text-gray-700">
                          {getStatusText(selectedCandidate.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                    onClick={closeCandidateModal}
                  >
                    <span className="sr-only">Fechar</span>
                    <XCircleIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 uppercase">
                      Informações de Contato
                    </h4>
                    <div className="mt-2 space-y-3">
                      <div className="flex items-center">
                        <EnvelopeIcon className="h-5 w-5 text-gray-400 mr-2" />
                        <a href={`mailto:${selectedCandidate.email}`} className="text-blue-600 hover:underline">
                          {selectedCandidate.email}
                        </a>
                      </div>
                      {selectedCandidate.phone && (
                        <div className="flex items-center">
                          <PhoneIcon className="h-5 w-5 text-gray-400 mr-2" />
                          <a href={`tel:${selectedCandidate.phone}`} className="text-blue-600 hover:underline">
                            {selectedCandidate.phone}
                          </a>
                        </div>
                      )}
                      {selectedCandidate.location && (
                        <div className="flex items-center">
                          <MapPinIcon className="h-5 w-5 text-gray-400 mr-2" />
                          <span>{selectedCandidate.location}</span>
                        </div>
                      )}
                    </div>

                    <h4 className="mt-6 text-sm font-medium text-gray-500 uppercase">
                      Habilidades
                    </h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedCandidate.skills.map((skill, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>

                    <h4 className="mt-6 text-sm font-medium text-gray-500 uppercase">
                      Documentos
                    </h4>
                    <div className="mt-2">
                      {selectedCandidate.resume && (
                        <a
                          href={selectedCandidate.resume.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center p-3 border border-gray-200 rounded-md hover:bg-gray-50"
                        >
                          <DocumentTextIcon className="h-6 w-6 text-gray-400 mr-2" />
                          <div>
                            <div className="text-sm font-medium text-blue-600">
                              {selectedCandidate.resume.fileName}
                            </div>
                            <div className="text-xs text-gray-500">
                              Currículo do candidato
                            </div>
                          </div>
                        </a>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-500 uppercase">
                      Carta de Apresentação
                    </h4>
                    <div className="mt-2 bg-gray-50 p-4 rounded-md text-sm text-gray-700 max-h-80 overflow-y-auto">
                      {selectedCandidate.coverLetter ? (
                        <p className="whitespace-pre-line">{selectedCandidate.coverLetter}</p>
                      ) : (
                        <p className="italic text-gray-500">
                          Este candidato não enviou uma carta de apresentação.
                        </p>
                      )}
                    </div>

                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">
                        Data da Candidatura
                      </h4>
                      <div className="flex items-center text-sm">
                        <CalendarIcon className="h-5 w-5 text-gray-400 mr-2" />
                        {formatDate(selectedCandidate.appliedAt)}
                      </div>
                    </div>

                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">
                        Ações
                      </h4>
                      <div className="flex flex-col space-y-2">
                        {selectedCandidate.status === 'pending' && (
                          <button
                            onClick={() => updateApplicationStatus(selectedCandidate.id, 'reviewed')}
                            className="flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            Marcar como Analisado
                          </button>
                        )}
                        {['pending', 'reviewed'].includes(selectedCandidate.status) && (
                          <button
                            onClick={() => updateApplicationStatus(selectedCandidate.id, 'interviewing')}
                            className="flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                          >
                            Chamar para Entrevista
                          </button>
                        )}
                        {['pending', 'reviewed', 'interviewing'].includes(selectedCandidate.status) && (
                          <button
                            onClick={() => updateApplicationStatus(selectedCandidate.id, 'rejected')}
                            className="flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            Rejeitar Candidatura
                          </button>
                        )}
                        {selectedCandidate.status === 'interviewing' && (
                          <button
                            onClick={() => updateApplicationStatus(selectedCandidate.id, 'hired')}
                            className="flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                          >
                            Marcar como Contratado
                          </button>
                        )}
                        <a
                          href={`mailto:${selectedCandidate.email}`}
                          className="flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                        >
                          <EnvelopeIcon className="h-5 w-5 mr-2" />
                          Enviar Email
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 