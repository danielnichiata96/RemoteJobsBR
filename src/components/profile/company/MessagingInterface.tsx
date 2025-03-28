import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { 
  PaperAirplaneIcon, 
  PaperClipIcon, 
  UserCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

// Enum para os tipos de mensagem
enum MessageType {
  TEXT = 'text',
  FILE = 'file',
}

// Interface para as mensagens
interface Message {
  id: string;
  type: MessageType;
  content: string;
  sender: 'company' | 'candidate';
  timestamp: Date;
  fileUrl?: string;
  fileName?: string;
}

// Interface para os contatos (candidatos)
interface Contact {
  id: string;
  name: string;
  avatar?: string;
  jobTitle: string;
  unreadCount: number;
  lastMessage?: {
    content: string;
    timestamp: Date;
  };
  isOnline?: boolean;
}

interface MessagingInterfaceProps {
  companyId: string;
  companyName: string;
  companyAvatar?: string;
}

export default function MessagingInterface({ 
  companyId, 
  companyName,
  companyAvatar
}: MessagingInterfaceProps) {
  // Estado para armazenar contatos
  const [contacts, setContacts] = useState<Contact[]>([
    {
      id: '1',
      name: 'João Silva',
      avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
      jobTitle: 'Desenvolvedor Full Stack',
      unreadCount: 2,
      lastMessage: {
        content: 'Quando teremos o resultado da entrevista?',
        timestamp: new Date('2023-06-18T14:30:00')
      },
      isOnline: true
    },
    {
      id: '2',
      name: 'Maria Souza',
      avatar: 'https://randomuser.me/api/portraits/women/2.jpg',
      jobTitle: 'UX/UI Designer',
      unreadCount: 0,
      lastMessage: {
        content: 'Obrigada pelo feedback!',
        timestamp: new Date('2023-06-17T10:15:00')
      },
      isOnline: false
    },
    {
      id: '3',
      name: 'Pedro Santos',
      jobTitle: 'DevOps Engineer',
      unreadCount: 0,
      lastMessage: {
        content: 'Confirmo minha presença na entrevista amanhã às 14h.',
        timestamp: new Date('2023-06-15T16:45:00')
      },
      isOnline: true
    }
  ]);

  // Estado para o contato selecionado
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  
  // Estado para as mensagens da conversa atual
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Estado para a mensagem sendo digitada
  const [messageText, setMessageText] = useState('');
  
  // Estado para o arquivo sendo anexado
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  
  // Referência para o contêiner de mensagens para rolagem
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Simula o carregamento de mensagens quando um contato é selecionado
  useEffect(() => {
    if (selectedContact) {
      // Simulação de API - em uma implementação real, seria uma chamada de API
      const mockMessages: Message[] = [
        {
          id: uuidv4(),
          type: MessageType.TEXT,
          content: `Olá ${selectedContact.name}, obrigado por se candidatar para a vaga de ${selectedContact.jobTitle}.`,
          sender: 'company',
          timestamp: new Date('2023-06-14T10:00:00')
        },
        {
          id: uuidv4(),
          type: MessageType.TEXT,
          content: 'Olá! Obrigado pela oportunidade. Estou muito interessado nesta posição.',
          sender: 'candidate',
          timestamp: new Date('2023-06-14T10:05:00')
        },
        {
          id: uuidv4(),
          type: MessageType.TEXT,
          content: 'Gostaríamos de agendar uma entrevista com você. Você está disponível na próxima semana?',
          sender: 'company',
          timestamp: new Date('2023-06-14T10:10:00')
        },
        {
          id: uuidv4(),
          type: MessageType.TEXT,
          content: 'Sim, estou disponível. Qual seria o melhor horário para vocês?',
          sender: 'candidate',
          timestamp: new Date('2023-06-14T10:15:00')
        },
        {
          id: uuidv4(),
          type: MessageType.FILE,
          content: 'Aqui está a descrição detalhada da vaga e o processo de entrevista.',
          sender: 'company',
          timestamp: new Date('2023-06-14T10:20:00'),
          fileUrl: '/files/job-description.pdf',
          fileName: 'Descrição da Vaga.pdf'
        }
      ];

      // Se for o primeiro contato, adicione a última mensagem específica
      if (selectedContact.id === '1') {
        mockMessages.push({
          id: uuidv4(),
          type: MessageType.TEXT,
          content: 'Quando teremos o resultado da entrevista?',
          sender: 'candidate',
          timestamp: new Date('2023-06-18T14:30:00')
        });
      } else if (selectedContact.id === '2') {
        mockMessages.push({
          id: uuidv4(),
          type: MessageType.TEXT,
          content: 'Gostaríamos de informar que você passou para a próxima fase! Parabéns!',
          sender: 'company',
          timestamp: new Date('2023-06-17T09:30:00')
        });
        mockMessages.push({
          id: uuidv4(),
          type: MessageType.TEXT,
          content: 'Obrigada pelo feedback!',
          sender: 'candidate',
          timestamp: new Date('2023-06-17T10:15:00')
        });
      } else if (selectedContact.id === '3') {
        mockMessages.push({
          id: uuidv4(),
          type: MessageType.TEXT,
          content: 'Podemos agendar sua entrevista para amanhã às 14h?',
          sender: 'company',
          timestamp: new Date('2023-06-15T16:30:00')
        });
        mockMessages.push({
          id: uuidv4(),
          type: MessageType.TEXT,
          content: 'Confirmo minha presença na entrevista amanhã às 14h.',
          sender: 'candidate',
          timestamp: new Date('2023-06-15T16:45:00')
        });
      }

      setMessages(mockMessages);

      // Marcar mensagens como lidas quando selecionar o contato
      setContacts(prevContacts =>
        prevContacts.map(c =>
          c.id === selectedContact.id ? { ...c, unreadCount: 0 } : c
        )
      );
    }
  }, [selectedContact]);

  // Efeito para rolar para o final da lista de mensagens quando novas mensagens são adicionadas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Função para formatar a data da mensagem
  const formatMessageDate = (date: Date) => {
    return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: pt });
  };

  // Função para formatar a data da última mensagem na lista de contatos
  const formatLastMessageDate = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return format(date, "HH:mm", { locale: pt });
    } else if (diffInHours < 48) {
      return 'Ontem';
    } else {
      return format(date, "dd/MM/yyyy", { locale: pt });
    }
  };

  // Função para enviar uma mensagem
  const sendMessage = () => {
    if ((!messageText.trim() && !attachedFile) || !selectedContact) return;

    // Criar uma nova mensagem de texto
    if (messageText.trim()) {
      const newTextMessage: Message = {
        id: uuidv4(),
        type: MessageType.TEXT,
        content: messageText.trim(),
        sender: 'company',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, newTextMessage]);
      
      // Atualizar o último contato com a última mensagem
      setContacts(prev => 
        prev.map(c => 
          c.id === selectedContact.id 
            ? { 
                ...c, 
                lastMessage: { 
                  content: messageText.trim(), 
                  timestamp: new Date() 
                } 
              } 
            : c
        )
      );
      
      setMessageText('');
    }

    // Criar uma nova mensagem de arquivo, se houver um arquivo anexado
    if (attachedFile) {
      const newFileMessage: Message = {
        id: uuidv4(),
        type: MessageType.FILE,
        content: `Arquivo anexado: ${attachedFile.name}`,
        sender: 'company',
        timestamp: new Date(),
        fileUrl: URL.createObjectURL(attachedFile),
        fileName: attachedFile.name
      };
      
      setMessages(prev => [...prev, newFileMessage]);
      setAttachedFile(null);
    }
  };

  // Função para lidar com a tecla Enter no campo de mensagem
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Função para lidar com o upload de arquivos
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachedFile(e.target.files[0]);
    }
  };

  // Função para cancelar o anexo de arquivo
  const cancelAttachment = () => {
    setAttachedFile(null);
  };

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <div className="flex h-[600px]">
        {/* Barra lateral de contatos */}
        <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Mensagens</h2>
            <p className="text-sm text-gray-500">Comunique-se com candidatos</p>
          </div>
          
          <div className="divide-y divide-gray-200">
            {contacts.map(contact => (
              <div 
                key={contact.id}
                className={`p-4 hover:bg-gray-50 cursor-pointer ${
                  selectedContact?.id === contact.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => setSelectedContact(contact)}
              >
                <div className="flex items-start">
                  <div className="relative flex-shrink-0">
                    {contact.avatar ? (
                      <img 
                        src={contact.avatar} 
                        alt={contact.name} 
                        className="h-10 w-10 rounded-full"
                      />
                    ) : (
                      <UserCircleIcon className="h-10 w-10 text-gray-400" />
                    )}
                    {contact.isOnline && (
                      <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-white" />
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        {contact.name}
                      </p>
                      {contact.lastMessage && (
                        <p className="text-xs text-gray-500">
                          {formatLastMessageDate(contact.lastMessage.timestamp)}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {contact.jobTitle}
                    </p>
                    {contact.lastMessage && (
                      <p className="mt-1 text-sm text-gray-600 truncate">
                        {contact.lastMessage.content}
                      </p>
                    )}
                  </div>
                  {contact.unreadCount > 0 && (
                    <span className="ml-2 flex-shrink-0 inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      {contact.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Área de conversa */}
        <div className="flex-1 flex flex-col">
          {selectedContact ? (
            <>
              {/* Cabeçalho do chat */}
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center">
                <div className="relative flex-shrink-0">
                  {selectedContact.avatar ? (
                    <img 
                      src={selectedContact.avatar} 
                      alt={selectedContact.name} 
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <UserCircleIcon className="h-8 w-8 text-gray-400" />
                  )}
                  {selectedContact.isOnline && (
                    <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-green-400 ring-1 ring-white" />
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">
                    {selectedContact.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {selectedContact.jobTitle}
                  </p>
                </div>
              </div>
              
              {/* Lista de mensagens */}
              <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                <div className="space-y-4">
                  {messages.map(message => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.sender === 'company' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md p-3 rounded-lg ${
                          message.sender === 'company'
                            ? 'bg-blue-600 text-white rounded-br-none'
                            : 'bg-gray-200 text-gray-800 rounded-bl-none'
                        }`}
                      >
                        {message.type === MessageType.TEXT ? (
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        ) : (
                          <div>
                            <p className="text-sm">{message.content}</p>
                            <a 
                              href={message.fileUrl} 
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`mt-2 flex items-center px-3 py-2 rounded ${
                                message.sender === 'company'
                                  ? 'bg-blue-700 hover:bg-blue-800'
                                  : 'bg-gray-300 hover:bg-gray-400 text-gray-800'
                              }`}
                            >
                              <PaperClipIcon className="h-4 w-4 mr-2" />
                              <span className="text-xs truncate">{message.fileName}</span>
                            </a>
                          </div>
                        )}
                        <p
                          className={`text-xs mt-1 ${
                            message.sender === 'company' ? 'text-blue-200' : 'text-gray-500'
                          }`}
                        >
                          {formatMessageDate(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>
              
              {/* Área de composição de mensagem */}
              <div className="p-4 border-t border-gray-200 bg-white">
                {attachedFile && (
                  <div className="mb-2 p-2 bg-gray-100 rounded-md flex items-center justify-between">
                    <div className="flex items-center text-sm text-gray-600">
                      <PaperClipIcon className="h-4 w-4 mr-1" />
                      <span className="truncate max-w-xs">{attachedFile.name}</span>
                    </div>
                    <button
                      onClick={cancelAttachment}
                      className="text-gray-500 hover:text-red-500"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                )}
                <div className="flex items-center">
                  <label htmlFor="file-upload" className="cursor-pointer mr-2">
                    <PaperClipIcon className="h-6 w-6 text-gray-500 hover:text-gray-700" />
                    <input
                      id="file-upload"
                      type="file"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                  <div className="flex-1 relative">
                    <textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Digite sua mensagem..."
                      className="block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 resize-none h-12 max-h-32"
                      style={{ minHeight: '3rem' }}
                    />
                  </div>
                  <button
                    onClick={sendMessage}
                    disabled={!messageText.trim() && !attachedFile}
                    className="ml-2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PaperAirplaneIcon className="h-5 w-5 transform rotate-90" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50">
              <div className="text-center">
                <UserCircleIcon className="mx-auto h-16 w-16 text-gray-400" />
                <h3 className="mt-2 text-lg font-medium text-gray-900">Mensagens</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Selecione um candidato para iniciar ou continuar uma conversa.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 