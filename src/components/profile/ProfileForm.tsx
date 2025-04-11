import React, { useState } from 'react';
import { UserRole, ExperienceLevel } from '@prisma/client';

// Type definitions (copied from profile.tsx)
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

interface ProfileFormProps {
  initialData: FormData;
  isLoading: boolean;
  onSubmit: (formData: FormData) => Promise<void>; // Pass the current form data on submit
  onCancel: () => void;
}

// Helper function to initialize form state safely
const initializeState = (data: any): FormData => {
  // Provide defaults and ensure correct types
  return {
    name: data?.name || '',
    title: data?.title || '',
    bio: data?.bio || '',
    location: data?.location || '',
    phone: data?.phone || '',
    email: data?.email || '', // Email is usually read-only, but initialize safely
    linkedinUrl: data?.linkedinUrl || '',
    githubUrl: data?.githubUrl || '',
    portfolioUrl: data?.portfolioUrl || '',
    resumeUrl: data?.resumeUrl || '',
    desiredSalary: data?.desiredSalary?.toString() || '', // Convert number to string
    availableForWork: data?.availableForWork ?? true, // Default to true if null/undefined
    yearsOfExperience: data?.yearsOfExperience?.toString() || '', // Convert number to string
    experienceLevel: data?.experienceLevel || '',
    skills: Array.isArray(data?.skills) ? data.skills.join(', ') : (data?.skills || ''), // Convert array to string, handle null/string
    preferredWorkTypes: data?.preferredWorkTypes || [],
    preferredLocations: data?.preferredLocations || [],
  };
};

export default function ProfileForm({
  initialData,
  isLoading,
  onSubmit,
  onCancel,
}: ProfileFormProps) {
  // Use the helper function for safe state initialization
  const [formData, setFormData] = useState<FormData>(() => initializeState(initialData));

  // Re-initialize if initialData changes (e.g., after parent re-fetches)
  // Note: This might cause issues if the user is typing while initialData updates.
  // Consider if this re-sync is truly necessary or if initialData is stable after first load.
  React.useEffect(() => {
     setFormData(initializeState(initialData));
  }, [initialData]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData); // Pass the current state to the parent handler
  };

  return (
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
            onClick={onCancel}
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
  );
} 