import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Tag } from '@prisma/client';

const jobPostingSchema = z.object({
  title: z.string().min(5, 'O título deve ter pelo menos 5 caracteres'),
  description: z.string().min(50, 'A descrição deve ter pelo menos 50 caracteres'),
  requirements: z.string().min(20, 'Os requisitos devem ter pelo menos 20 caracteres'),
  responsibilities: z.string().optional(),
  location: z.string().min(2, 'A localização deve ter pelo menos 2 caracteres'),
  locationType: z.enum(['remote', 'onsite', 'hybrid']),
  employmentType: z.enum(['full-time', 'part-time', 'contract', 'temporary', 'internship']),
  salaryRange: z.string().optional(),
  minExperience: z.enum(['entry', 'junior', 'mid', 'senior', 'lead']),
  applicationDeadline: z.string().optional(),
  benefits: z.string().optional(),
  department: z.string().optional(),
  showSalary: z.boolean().default(false),
});

type JobPostingFormData = z.infer<typeof jobPostingSchema>;

interface JobFormProps {
  initialData?: Partial<JobPostingFormData>;
  onSubmit: (data: JobPostingFormData) => Promise<void>;
  isEdit?: boolean;
  availableTags?: Tag[];
}

export default function JobPostingForm({
  initialData = {},
  onSubmit,
  isEdit = false,
  availableTags = [],
}: JobFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialData.tags?.map((tag: any) => tag.id) || []);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<JobPostingFormData>({
    resolver: zodResolver(jobPostingSchema),
    defaultValues: {
      title: initialData.title || '',
      description: initialData.description || '',
      requirements: initialData.requirements || '',
      responsibilities: initialData.responsibilities || '',
      location: initialData.location || '',
      locationType: initialData.locationType || 'onsite',
      employmentType: initialData.employmentType || 'full-time',
      salaryRange: initialData.salaryRange || '',
      minExperience: initialData.minExperience || 'mid',
      applicationDeadline: initialData.applicationDeadline ? new Date(initialData.applicationDeadline).toISOString().split('T')[0] : '',
      benefits: initialData.benefits || '',
      department: initialData.department || '',
      showSalary: initialData.showSalary || false,
    },
  });

  const handleFormSubmit = async (data: JobPostingFormData) => {
    try {
      setIsSubmitting(true);
      // Adicionar tags selecionadas ao enviar o formulário
      await onSubmit({
        ...data,
        tags: selectedTags,
      } as any);
      if (!isEdit) {
        reset();
        setSelectedTags([]);
      }
    } catch (error) {
      console.error('Erro ao salvar vaga:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId) 
        : [...prev, tagId]
    );
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">
          {isEdit ? 'Editar Vaga' : 'Publicar Nova Vaga'}
        </h2>

        <div className="grid grid-cols-1 gap-6">
          {/* Informações básicas */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Título da Vaga *</label>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Localização *</label>
              <input
                type="text"
                {...register('location')}
                placeholder="Ex: São Paulo, SP"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
              {errors.location && (
                <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Tipo de Trabalho *</label>
              <select
                {...register('locationType')}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              >
                <option value="remote">Remoto</option>
                <option value="onsite">Presencial</option>
                <option value="hybrid">Híbrido</option>
              </select>
              {errors.locationType && (
                <p className="mt-1 text-sm text-red-600">{errors.locationType.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Tipo de Contratação *</label>
              <select
                {...register('employmentType')}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              >
                <option value="full-time">Tempo integral</option>
                <option value="part-time">Meio período</option>
                <option value="contract">Contrato</option>
                <option value="temporary">Temporário</option>
                <option value="internship">Estágio</option>
              </select>
              {errors.employmentType && (
                <p className="mt-1 text-sm text-red-600">{errors.employmentType.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Nível de Experiência *</label>
              <select
                {...register('minExperience')}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              >
                <option value="entry">Entrada (0-1 ano)</option>
                <option value="junior">Júnior (1-2 anos)</option>
                <option value="mid">Pleno (2-5 anos)</option>
                <option value="senior">Sênior (5+ anos)</option>
                <option value="lead">Líder / Especialista</option>
              </select>
              {errors.minExperience && (
                <p className="mt-1 text-sm text-red-600">{errors.minExperience.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Departamento</label>
              <input
                type="text"
                {...register('department')}
                placeholder="Ex: Engenharia, Marketing, Produto"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
              {errors.department && (
                <p className="mt-1 text-sm text-red-600">{errors.department.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Data limite para candidaturas</label>
              <input
                type="date"
                {...register('applicationDeadline')}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
              {errors.applicationDeadline && (
                <p className="mt-1 text-sm text-red-600">{errors.applicationDeadline.message}</p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <label className="block text-sm font-medium text-gray-700">Faixa Salarial</label>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  {...register('showSalary')}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-500">Exibir na vaga</span>
              </div>
            </div>
            <input
              type="text"
              {...register('salaryRange')}
              placeholder="Ex: R$ 5.000 - R$ 7.000 ou 'A combinar'"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
            {errors.salaryRange && (
              <p className="mt-1 text-sm text-red-600">{errors.salaryRange.message}</p>
            )}
          </div>

          {/* Descrição detalhada */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Descrição da Vaga *</label>
            <textarea
              {...register('description')}
              rows={5}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              placeholder="Descreva detalhadamente a vaga, responsabilidades gerais e o perfil que você busca..."
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Requisitos *</label>
            <textarea
              {...register('requirements')}
              rows={4}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              placeholder="Liste os requisitos necessários para a vaga..."
            />
            {errors.requirements && (
              <p className="mt-1 text-sm text-red-600">{errors.requirements.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Responsabilidades</label>
            <textarea
              {...register('responsibilities')}
              rows={4}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              placeholder="Detalhe as principais responsabilidades e atividades do cargo..."
            />
            {errors.responsibilities && (
              <p className="mt-1 text-sm text-red-600">{errors.responsibilities.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Benefícios</label>
            <textarea
              {...register('benefits')}
              rows={3}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              placeholder="Liste os benefícios oferecidos pela empresa para esta vaga..."
            />
            {errors.benefits && (
              <p className="mt-1 text-sm text-red-600">{errors.benefits.message}</p>
            )}
          </div>
          
          {/* Tags/Habilidades */}
          {availableTags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Habilidades e Tecnologias</label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <button
                    type="button"
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      selectedTags.includes(tag.id)
                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                        : 'bg-gray-100 text-gray-800 border-gray-200'
                    } border`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Selecione as habilidades e tecnologias relevantes para esta vaga.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Limpar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isSubmitting ? 'Salvando...' : isEdit ? 'Atualizar Vaga' : 'Publicar Vaga'}
        </button>
      </div>
    </form>
  );
} 