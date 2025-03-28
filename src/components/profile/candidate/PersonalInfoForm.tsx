import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserRole, ExperienceLevel } from '@prisma/client';
import { useState } from 'react';

const personalInfoSchema = z.object({
  name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  title: z.string().min(2, 'O título profissional deve ter pelo menos 2 caracteres'),
  location: z.string().min(2, 'A localização deve ter pelo menos 2 caracteres'),
  phone: z.string().optional(),
  bio: z.string().max(1000, 'A bio deve ter no máximo 1000 caracteres').optional(),
  linkedinUrl: z.string().url('URL do LinkedIn inválida').optional().or(z.literal('')),
  githubUrl: z.string().url('URL do GitHub inválida').optional().or(z.literal('')),
  portfolioUrl: z.string().url('URL do portfólio inválida').optional().or(z.literal('')),
  yearsOfExperience: z.coerce.number().min(0, 'Valor inválido').optional(),
  experienceLevel: z.nativeEnum(ExperienceLevel).optional(),
  desiredSalary: z.coerce.number().min(0, 'Valor inválido').optional(),
  availableForWork: z.boolean().default(true),
});

type PersonalInfoFormData = z.infer<typeof personalInfoSchema>;

interface PersonalInfoFormProps {
  userData: any;
  onSubmit: (data: PersonalInfoFormData) => Promise<void>;
}

export default function PersonalInfoForm({ userData, onSubmit }: PersonalInfoFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PersonalInfoFormData>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      name: userData.name || '',
      email: userData.email || '',
      title: userData.title || '',
      location: userData.location || '',
      phone: userData.phone || '',
      bio: userData.bio || '',
      linkedinUrl: userData.linkedinUrl || '',
      githubUrl: userData.githubUrl || '',
      portfolioUrl: userData.portfolioUrl || '',
      yearsOfExperience: userData.yearsOfExperience || 0,
      experienceLevel: userData.experienceLevel || undefined,
      desiredSalary: userData.desiredSalary || 0,
      availableForWork: userData.availableForWork !== false,
    },
  });

  const handleFormSubmit = async (data: PersonalInfoFormData) => {
    try {
      setIsSubmitting(true);
      await onSubmit(data);
    } catch (error) {
      console.error('Erro ao salvar informações:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Informações Pessoais</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome Completo *</label>
            <input
              type="text"
              {...register('name')}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email *</label>
            <input
              type="email"
              {...register('email')}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              disabled
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Título Profissional *</label>
            <input
              type="text"
              {...register('title')}
              placeholder="Ex: Desenvolvedor Full Stack"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Localização *</label>
            <input
              type="text"
              {...register('location')}
              placeholder="Ex: São Paulo, Brasil"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
            {errors.location && (
              <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Telefone</label>
            <input
              type="tel"
              {...register('phone')}
              placeholder="+55 (11) 12345-6789"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
            {errors.phone && (
              <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Nível de Experiência</label>
            <select
              {...register('experienceLevel')}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            >
              <option value="">Selecione...</option>
              <option value="ENTRY">Iniciante</option>
              <option value="MID">Intermediário</option>
              <option value="SENIOR">Sênior</option>
              <option value="LEAD">Líder/Especialista</option>
            </select>
            {errors.experienceLevel && (
              <p className="mt-1 text-sm text-red-600">{errors.experienceLevel.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Anos de Experiência</label>
            <input
              type="number"
              {...register('yearsOfExperience')}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
            {errors.yearsOfExperience && (
              <p className="mt-1 text-sm text-red-600">{errors.yearsOfExperience.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Salário Desejado (USD)</label>
            <input
              type="number"
              {...register('desiredSalary')}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
            {errors.desiredSalary && (
              <p className="mt-1 text-sm text-red-600">{errors.desiredSalary.message}</p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">Bio</label>
          <textarea
            {...register('bio')}
            rows={4}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            placeholder="Conte um pouco sobre você, sua experiência e objetivos profissionais..."
          ></textarea>
          {errors.bio && (
            <p className="mt-1 text-sm text-red-600">{errors.bio.message}</p>
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              {...register('availableForWork')}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-700">
              Disponível para novas oportunidades
            </label>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <h3 className="text-md font-medium text-gray-700">Links</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">LinkedIn</label>
            <input
              type="url"
              {...register('linkedinUrl')}
              placeholder="https://linkedin.com/in/seu-perfil"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
            {errors.linkedinUrl && (
              <p className="mt-1 text-sm text-red-600">{errors.linkedinUrl.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">GitHub</label>
            <input
              type="url"
              {...register('githubUrl')}
              placeholder="https://github.com/seu-usuario"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
            {errors.githubUrl && (
              <p className="mt-1 text-sm text-red-600">{errors.githubUrl.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Portfólio</label>
            <input
              type="url"
              {...register('portfolioUrl')}
              placeholder="https://seu-portfolio.com"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
            {errors.portfolioUrl && (
              <p className="mt-1 text-sm text-red-600">{errors.portfolioUrl.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </form>
  );
}