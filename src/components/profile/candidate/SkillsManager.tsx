import { useState } from 'react';
import { z } from 'zod';

interface SkillsManagerProps {
  initialSkills: string[];
  onSkillsChange: (skills: string[]) => Promise<void>;
}

export default function SkillsManager({ initialSkills, onSkillsChange }: SkillsManagerProps) {
  const [skills, setSkills] = useState<string[]>(initialSkills || []);
  const [newSkill, setNewSkill] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddSkill = async () => {
    const trimmedSkill = newSkill.trim();
    
    if (!trimmedSkill) {
      setError('A habilidade não pode estar vazia');
      return;
    }

    if (skills.includes(trimmedSkill)) {
      setError('Esta habilidade já foi adicionada');
      return;
    }

    setError(null);
    const updatedSkills = [...skills, trimmedSkill];
    setSkills(updatedSkills);
    setNewSkill('');

    try {
      setIsSubmitting(true);
      await onSkillsChange(updatedSkills);
    } catch (error) {
      console.error('Erro ao adicionar habilidade:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveSkill = async (skillToRemove: string) => {
    const updatedSkills = skills.filter(skill => skill !== skillToRemove);
    setSkills(updatedSkills);

    try {
      setIsSubmitting(true);
      await onSkillsChange(updatedSkills);
    } catch (error) {
      console.error('Erro ao remover habilidade:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSkill();
    }
  };

  // Sugestões de habilidades comuns para desenvolvedores
  const suggestedSkills = [
    'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python',
    'Java', 'C#', 'Angular', 'Vue.js', 'AWS', 'Docker', 'Kubernetes',
    'GraphQL', 'REST API', 'SQL', 'NoSQL', 'Git', 'CI/CD', 
    'Agile', 'Scrum', 'DevOps', 'TDD', 'Inglês fluente'
  ].filter(skill => !skills.includes(skill)).slice(0, 8);

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Habilidades</h2>
      
      <div className="mb-4">
        <div className="flex">
          <input
            type="text"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Adicione uma habilidade técnica..."
            className="flex-1 border border-gray-300 rounded-l-md shadow-sm p-2"
            disabled={isSubmitting}
          />
          <button
            onClick={handleAddSkill}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Adicionar
          </button>
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>

      {suggestedSkills.length > 0 && (
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-2">Sugestões:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedSkills.map(skill => (
              <button
                key={skill}
                onClick={() => {
                  setNewSkill(skill);
                }}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                {skill}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <h3 className="text-md font-medium text-gray-700 mb-2">Suas habilidades:</h3>
        
        {skills.length === 0 ? (
          <p className="text-sm text-gray-500">
            Você ainda não adicionou nenhuma habilidade. Adicione habilidades para aumentar suas chances de conseguir uma vaga.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {skills.map(skill => (
              <div
                key={skill}
                className="flex items-center bg-blue-100 text-blue-800 rounded-full px-3 py-1"
              >
                <span className="text-sm">{skill}</span>
                <button
                  onClick={() => handleRemoveSkill(skill)}
                  disabled={isSubmitting}
                  className="ml-2 text-blue-600 hover:text-blue-800 focus:outline-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 text-sm text-gray-600">
        <p>
          <strong>Dica:</strong> Adicione habilidades específicas e relevantes para o tipo de trabalho que você busca.
          Inclua tanto habilidades técnicas quanto soft skills importantes para trabalho remoto.
        </p>
      </div>
    </div>
  );
} 