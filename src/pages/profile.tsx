import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Layout from '@/components/common/Layout';
import { UserRole, ExperienceLevel } from '@prisma/client';

type FormData = {
  name: string;
  title: string;
  bio: string;
  location: string;
  phone: string;
  email: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  resumeUrl: string;
  desiredSalary: string;
  availableForWork: boolean;
  yearsOfExperience: string;
  experienceLevel: ExperienceLevel | '';
  skills: string;
  preferredWorkTypes: string[];
  preferredLocations: string[];
};

const workTypeOptions = [
  { value: 'full-time', label: 'Tempo Integral' },
  { value: 'part-time', label: 'Meio Período' },
  { value: 'contract', label: 'Contrato' },
  { value: 'freelance', label: 'Freelancer' },
  { value: 'internship', label: 'Estágio' },
];

const locationOptions = [
  { value: 'remote', label: 'Remoto' },
  { value: 'hybrid', label: 'Híbrido' },
  { value: 'on-site', label: 'Presencial' },
];

const experienceLevelOptions = [
  { value: 'ENTRY', label: 'Júnior (1-2 anos)' },
  { value: 'MID', label: 'Pleno (3-5 anos)' },
  { value: 'SENIOR', label: 'Sênior (5+ anos)' },
  { value: 'LEAD', label: 'Líder/Gerente' },
];

export default function Profile(props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', content: '' });
  const [userData, setUserData] = useState<any>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    title: '',
    bio: '',
    location: '',
    phone: '',
    email: '',
    linkedinUrl: '',
    githubUrl: '',
    portfolioUrl: '',
    resumeUrl: '',
    desiredSalary: '',
    availableForWork: true,
    yearsOfExperience: '',
    experienceLevel: '',
    skills: '',
    preferredWorkTypes: [],
    preferredLocations: [],
  });

  // Redirecionar se não estiver autenticado
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?returnTo=/profile');
    }
  }, [status, router]);

  // Buscar dados do usuário
  useEffect(() => {
    if (session?.user?.email) {
      fetchUserData();
    }
  }, [session]);

  const fetchUserData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/user/profile');
      if (!response.ok) throw new Error('Falha ao carregar perfil');
      
      const data = await response.json();
      setUserData(data);
      
      // Preencher o formulário com os dados do usuário
      setFormData({
        name: data.name || '',
        title: data.title || '',
        bio: data.bio || '',
        location: data.location || '',
        phone: data.phone || '',
        email: data.email || '',
        linkedinUrl: data.linkedinUrl || '',
        githubUrl: data.githubUrl || '',
        portfolioUrl: data.portfolioUrl || '',
        resumeUrl: data.resumeUrl || '',
        desiredSalary: data.desiredSalary?.toString() || '',
        availableForWork: data.availableForWork ?? true,
        yearsOfExperience: data.yearsOfExperience?.toString() || '',
        experienceLevel: data.experienceLevel || '',
        skills: data.skills?.join(', ') || '',
        preferredWorkTypes: data.preferredWorkTypes || [],
        preferredLocations: data.preferredLocations || [],
      });
    } catch (error) {
      setMessage({
        type: 'error',
        content: 'Erro ao carregar perfil. Tente novamente.'
      });
      console.error('Erro ao buscar dados do perfil:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleMultiSelectChange = (name: string, value: string) => {
    setFormData(prev => {
      const current = [...prev[name as keyof Pick<FormData, 'preferredWorkTypes' | 'preferredLocations'>]];
      
      if (current.includes(value)) {
        return { ...prev, [name]: current.filter(item => item !== value) };
      } else {
        return { ...prev, [name]: [...current, value] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: '', content: '' });

    try {
      // Transformar os dados antes de enviar
      const dataToSubmit = {
        ...formData,
        desiredSalary: formData.desiredSalary ? parseFloat(formData.desiredSalary) : null,
        yearsOfExperience: formData.yearsOfExperience ? parseInt(formData.yearsOfExperience) : null,
        skills: formData.skills.split(',').map(skill => skill.trim()).filter(Boolean),
      };

      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSubmit),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao atualizar perfil');
      }

      const result = await response.json();
      setUserData(result);
      setMessage({
        type: 'success',
        content: 'Perfil atualizado com sucesso!'
      });
      setIsEditing(false);
    } catch (error: any) {
      setMessage({
        type: 'error',
        content: error.message || 'Erro ao atualizar perfil. Tente novamente.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <Layout title="Meu Perfil | RemoteJobsBR">
        <div className="min-h-screen bg-gray-50 py-10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white shadow-md rounded-lg p-8 flex justify-center items-center">
              <p className="text-lg">Carregando...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!session) {
    return null; // Redirecionar via useEffect
  }

  return (
    <Layout title="Meu Perfil | RemoteJobsBR">
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow-md rounded-lg p-8">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md"
                >
                  Editar Perfil
                </button>
              )}
            </div>

            {message.content && (
              <div className={`p-4 mb-6 rounded-md ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {message.content}
              </div>
            )}

            {isEditing ? (
              <form onSubmit={handleSubmit}>
                <div className="space-y-6">
                  {/* Informações básicas */}
                  <div>
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Informações Básicas</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                          Nome Completo
                        </label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                          required
                        />
                      </div>

                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          className="block w-full border-gray-300 rounded-md shadow-sm bg-gray-100 sm:text-sm"
                          disabled
                        />
                        <p className="mt-1 text-xs text-gray-500">O email não pode ser alterado</p>
                      </div>

                      <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                          Título Profissional
                        </label>
                        <input
                          type="text"
                          id="title"
                          name="title"
                          value={formData.title}
                          onChange={handleInputChange}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                          placeholder="Ex: Desenvolvedor Full Stack"
                        />
                      </div>

                      <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                          Telefone
                        </label>
                        <input
                          type="tel"
                          id="phone"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                          placeholder="+55 (XX) XXXXX-XXXX"
                        />
                      </div>

                      <div>
                        <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                          Localização
                        </label>
                        <input
                          type="text"
                          id="location"
                          name="location"
                          value={formData.location}
                          onChange={handleInputChange}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                          placeholder="Cidade, Estado, País"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                          Biografia
                        </label>
                        <textarea
                          id="bio"
                          name="bio"
                          rows={4}
                          value={formData.bio}
                          onChange={handleInputChange}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                          placeholder="Conte um pouco sobre você, sua experiência e objetivos de carreira"
                        ></textarea>
                      </div>
                    </div>
                  </div>

                  {/* Experiência Profissional */}
                  <div>
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Experiência Profissional</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="experienceLevel" className="block text-sm font-medium text-gray-700 mb-1">
                          Nível de Experiência
                        </label>
                        <select
                          id="experienceLevel"
                          name="experienceLevel"
                          value={formData.experienceLevel}
                          onChange={handleInputChange}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        >
                          <option value="">Selecione um nível</option>
                          {experienceLevelOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="yearsOfExperience" className="block text-sm font-medium text-gray-700 mb-1">
                          Anos de Experiência
                        </label>
                        <input
                          type="number"
                          id="yearsOfExperience"
                          name="yearsOfExperience"
                          min="0"
                          max="50"
                          value={formData.yearsOfExperience}
                          onChange={handleInputChange}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label htmlFor="skills" className="block text-sm font-medium text-gray-700 mb-1">
                          Habilidades
                        </label>
                        <input
                          type="text"
                          id="skills"
                          name="skills"
                          value={formData.skills}
                          onChange={handleInputChange}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                          placeholder="React, Node.js, TypeScript, Python (separados por vírgula)"
                        />
                        <p className="mt-1 text-xs text-gray-500">Separe as habilidades por vírgula</p>
                      </div>
                    </div>
                  </div>

                  {/* Preferências */}
                  <div>
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Preferências de Trabalho</h2>
                    
                    <div className="mb-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="availableForWork"
                          name="availableForWork"
                          checked={formData.availableForWork}
                          onChange={handleCheckboxChange}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <label htmlFor="availableForWork" className="ml-2 block text-sm text-gray-700">
                          Disponível para novas oportunidades
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="desiredSalary" className="block text-sm font-medium text-gray-700 mb-1">
                          Pretensão Salarial (USD/ano)
                        </label>
                        <input
                          type="number"
                          id="desiredSalary"
                          name="desiredSalary"
                          min="0"
                          step="1000"
                          value={formData.desiredSalary}
                          onChange={handleInputChange}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                          placeholder="Ex: 60000"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <span className="block text-sm font-medium text-gray-700 mb-2">
                        Tipos de Trabalho Preferidos
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {workTypeOptions.map(option => (
                          <label key={option.value} className="inline-flex items-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                              checked={formData.preferredWorkTypes.includes(option.value)}
                              onChange={() => handleMultiSelectChange('preferredWorkTypes', option.value)}
                            />
                            <span className="ml-2 mr-4 text-sm text-gray-700">{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4">
                      <span className="block text-sm font-medium text-gray-700 mb-2">
                        Locais de Trabalho Preferidos
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {locationOptions.map(option => (
                          <label key={option.value} className="inline-flex items-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                              checked={formData.preferredLocations.includes(option.value)}
                              onChange={() => handleMultiSelectChange('preferredLocations', option.value)}
                            />
                            <span className="ml-2 mr-4 text-sm text-gray-700">{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Links */}
                  <div>
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Links</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="linkedinUrl" className="block text-sm font-medium text-gray-700 mb-1">
                          LinkedIn
                        </label>
                        <input
                          type="url"
                          id="linkedinUrl"
                          name="linkedinUrl"
                          value={formData.linkedinUrl}
                          onChange={handleInputChange}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                          placeholder="https://linkedin.com/in/seu-perfil"
                        />
                      </div>

                      <div>
                        <label htmlFor="githubUrl" className="block text-sm font-medium text-gray-700 mb-1">
                          GitHub
                        </label>
                        <input
                          type="url"
                          id="githubUrl"
                          name="githubUrl"
                          value={formData.githubUrl}
                          onChange={handleInputChange}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                          placeholder="https://github.com/seu-usuario"
                        />
                      </div>

                      <div>
                        <label htmlFor="portfolioUrl" className="block text-sm font-medium text-gray-700 mb-1">
                          Website/Portfólio
                        </label>
                        <input
                          type="url"
                          id="portfolioUrl"
                          name="portfolioUrl"
                          value={formData.portfolioUrl}
                          onChange={handleInputChange}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                          placeholder="https://seusite.com"
                        />
                      </div>

                      <div>
                        <label htmlFor="resumeUrl" className="block text-sm font-medium text-gray-700 mb-1">
                          Link para Currículo
                        </label>
                        <input
                          type="url"
                          id="resumeUrl"
                          name="resumeUrl"
                          value={formData.resumeUrl}
                          onChange={handleInputChange}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                          placeholder="https://exemplo.com/seu-curriculo.pdf"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md"
                      disabled={isLoading}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Salvando...' : 'Salvar Perfil'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="space-y-8">
                {/* Visão do perfil */}
                <div>
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Informações Básicas</h2>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Nome</p>
                        <p className="font-medium">{userData?.name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-medium">{userData?.email || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Título Profissional</p>
                        <p className="font-medium">{userData?.title || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Telefone</p>
                        <p className="font-medium">{userData?.phone || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Localização</p>
                        <p className="font-medium">{userData?.location || '-'}</p>
                      </div>
                    </div>
                    {userData?.bio && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-500">Biografia</p>
                        <p className="whitespace-pre-line">{userData.bio}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Experiência Profissional</h2>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Nível de Experiência</p>
                        <p className="font-medium">
                          {userData?.experienceLevel
                            ? experienceLevelOptions.find(opt => opt.value === userData.experienceLevel)?.label
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Anos de Experiência</p>
                        <p className="font-medium">{userData?.yearsOfExperience || '-'}</p>
                      </div>
                    </div>
                    {userData?.skills && userData.skills.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-500 mb-2">Habilidades</p>
                        <div className="flex flex-wrap gap-2">
                          {userData.skills.map((skill: string) => (
                            <span key={skill} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Preferências de Trabalho</h2>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="mb-4">
                      <p className="text-sm text-gray-500">Disponibilidade</p>
                      <p className="font-medium">
                        {userData?.availableForWork 
                          ? '✅ Disponível para novas oportunidades' 
                          : '❌ Não disponível para novas oportunidades'}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Pretensão Salarial (USD/ano)</p>
                        <p className="font-medium">
                          {userData?.desiredSalary 
                            ? `$${userData.desiredSalary.toLocaleString()}` 
                            : '-'}
                        </p>
                      </div>
                    </div>

                    {userData?.preferredWorkTypes && userData.preferredWorkTypes.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-500 mb-2">Tipos de Trabalho Preferidos</p>
                        <div className="flex flex-wrap gap-2">
                          {userData.preferredWorkTypes.map((type: string) => (
                            <span key={type} className="bg-green-100 text-green-800 px-2 py-1 rounded-md text-sm">
                              {workTypeOptions.find(opt => opt.value === type)?.label || type}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {userData?.preferredLocations && userData.preferredLocations.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-500 mb-2">Locais de Trabalho Preferidos</p>
                        <div className="flex flex-wrap gap-2">
                          {userData.preferredLocations.map((location: string) => (
                            <span key={location} className="bg-purple-100 text-purple-800 px-2 py-1 rounded-md text-sm">
                              {locationOptions.find(opt => opt.value === location)?.label || location}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Links</h2>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">LinkedIn</p>
                        {userData?.linkedinUrl ? (
                          <a href={userData.linkedinUrl} target="_blank" rel="noopener noreferrer" 
                             className="text-blue-600 hover:underline">
                            {userData.linkedinUrl}
                          </a>
                        ) : (
                          <p>-</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">GitHub</p>
                        {userData?.githubUrl ? (
                          <a href={userData.githubUrl} target="_blank" rel="noopener noreferrer"
                             className="text-blue-600 hover:underline">
                            {userData.githubUrl}
                          </a>
                        ) : (
                          <p>-</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Website/Portfólio</p>
                        {userData?.portfolioUrl ? (
                          <a href={userData.portfolioUrl} target="_blank" rel="noopener noreferrer"
                             className="text-blue-600 hover:underline">
                            {userData.portfolioUrl}
                          </a>
                        ) : (
                          <p>-</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Currículo</p>
                        {userData?.resumeUrl ? (
                          <a href={userData.resumeUrl} target="_blank" rel="noopener noreferrer"
                             className="text-blue-600 hover:underline">
                            Ver Currículo
                          </a>
                        ) : (
                          <p>-</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
} 