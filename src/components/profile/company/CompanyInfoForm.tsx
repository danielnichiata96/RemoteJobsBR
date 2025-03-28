import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';

const companyInfoSchema = z.object({
  name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  description: z.string().max(1000, 'A descrição deve ter no máximo 1000 caracteres').optional(),
  industry: z.string().min(2, 'O setor deve ter pelo menos 2 caracteres').optional(),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  location: z.string().min(2, 'A localização deve ter pelo menos 2 caracteres').optional(),
  size: z.string().optional(),
  foundedYear: z.coerce.number().min(1800, 'Ano inválido').max(new Date().getFullYear(), 'Ano não pode ser no futuro').optional(),
  contactName: z.string().min(2, 'O nome do contato deve ter pelo menos 2 caracteres').optional(),
  contactEmail: z.string().email('Email inválido').optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  linkedinUrl: z.string().url('URL do LinkedIn inválida').optional().or(z.literal('')),
  twitterUrl: z.string().url('URL do Twitter inválida').optional().or(z.literal('')),
});

type CompanyInfoFormData = z.infer<typeof companyInfoSchema>;

interface CompanyInfoFormProps {
  userData: any;
  onSubmit: (data: CompanyInfoFormData) => Promise<void>;
}

export default function CompanyInfoForm({ userData, onSubmit }: CompanyInfoFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CompanyInfoFormData>({
    resolver: zodResolver(companyInfoSchema),
    defaultValues: {
      name: userData.name || '',
      email: userData.email || '',
      description: userData.description || '',
      industry: userData.industry || '',
      website: userData.website || '',
      location: userData.location || '',
      size: userData.size || '',
      foundedYear: userData.foundedYear || undefined,
      contactName: userData.contactName || '',
      contactEmail: userData.contactEmail || '',
      contactPhone: userData.contactPhone || '',
      linkedinUrl: userData.linkedinUrl || '',
      twitterUrl: userData.twitterUrl || '',
    },
  });

  const handleFormSubmit = async (data: CompanyInfoFormData) => {
    try {
      setIsSubmitting(true);
      await onSubmit(data);
    } catch (error) {
      console.error('Erro ao salvar informações:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Opções para tamanho da empresa
  const companySizes = [
    { value: '', label: 'Selecione...' },
    { value: '1-10', label: '1-10 funcionários' },
    { value: '11-50', label: '11-50 funcionários' },
    { value: '51-200', label: '51-200 funcionários' },
    { value: '201-500', label: '201-500 funcionários' },
    { value: '501-1000', label: '501-1000 funcionários' },
    { value: '1001-5000', label: '1001-5000 funcionários' },
    { value: '5001+', label: 'Mais de 5000 funcionários' },
  ];

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Informações da Empresa</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome da Empresa *</label>
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
            <label className="block text-sm font-medium text-gray-700">Site</label>
            <input
              type="url"
              {...register('website')}
              placeholder="https://www.suaempresa.com"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
            {errors.website && (
              <p className="mt-1 text-sm text-red-600">{errors.website.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Setor/Indústria</label>
            <input
              type="text"
              {...register('industry')}
              placeholder="Ex: Tecnologia, Saúde, Finanças"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
            {errors.industry && (
              <p className="mt-1 text-sm text-red-600">{errors.industry.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Localização</label>
            <input
              type="text"
              {...register('location')}
              placeholder="Ex: San Francisco, EUA"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
            {errors.location && (
              <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Tamanho da Empresa</label>
            <select
              {...register('size')}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            >
              {companySizes.map((size) => (
                <option key={size.value} value={size.value}>
                  {size.label}
                </option>
              ))}
            </select>
            {errors.size && (
              <p className="mt-1 text-sm text-red-600">{errors.size.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Ano de Fundação</label>
            <input
              type="number"
              {...register('foundedYear')}
              min="1800"
              max={new Date().getFullYear()}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
            {errors.foundedYear && (
              <p className="mt-1 text-sm text-red-600">{errors.foundedYear.message}</p>
            )}
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700">Descrição da Empresa</label>
          <textarea
            {...register('description')}
            rows={4}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            placeholder="Descreva sua empresa, cultura, valores e o que você está buscando nos candidatos..."
          ></textarea>
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
          )}
        </div>

        <div className="mt-6">
          <h3 className="text-md font-medium text-gray-700 mb-4">Informações de Contato</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome do Contato</label>
              <input
                type="text"
                {...register('contactName')}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
              {errors.contactName && (
                <p className="mt-1 text-sm text-red-600">{errors.contactName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email de Contato</label>
              <input
                type="email"
                {...register('contactEmail')}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
              {errors.contactEmail && (
                <p className="mt-1 text-sm text-red-600">{errors.contactEmail.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Telefone de Contato</label>
              <input
                type="tel"
                {...register('contactPhone')}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
              {errors.contactPhone && (
                <p className="mt-1 text-sm text-red-600">{errors.contactPhone.message}</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-md font-medium text-gray-700 mb-4">Redes Sociais</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">LinkedIn</label>
              <input
                type="url"
                {...register('linkedinUrl')}
                placeholder="https://linkedin.com/company/sua-empresa"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
              {errors.linkedinUrl && (
                <p className="mt-1 text-sm text-red-600">{errors.linkedinUrl.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Twitter</label>
              <input
                type="url"
                {...register('twitterUrl')}
                placeholder="https://twitter.com/suaempresa"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
              {errors.twitterUrl && (
                <p className="mt-1 text-sm text-red-600">{errors.twitterUrl.message}</p>
              )}
            </div>
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