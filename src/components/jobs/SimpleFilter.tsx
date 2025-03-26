import { useState } from 'react';
import { JobType, ExperienceLevel } from '@/types/job';

interface FilterProps {
  onFilterChange: (filters: {
    jobTypes: string[];
    experienceLevels: string[];
    remoteOnly: boolean;
  }) => void;
}

export default function SimpleFilter({ onFilterChange }: FilterProps) {
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const [selectedExperienceLevels, setSelectedExperienceLevels] = useState<string[]>([]);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const jobTypeOptions = [
    { value: JobType.FULL_TIME, label: 'Tempo Integral' },
    { value: JobType.PART_TIME, label: 'Meio Período' },
    { value: JobType.CONTRACT, label: 'Contrato' },
    { value: JobType.FREELANCE, label: 'Freelance' },
  ];

  const experienceLevelOptions = [
    { value: ExperienceLevel.ENTRY, label: 'Júnior' },
    { value: ExperienceLevel.MID, label: 'Pleno' },
    { value: ExperienceLevel.SENIOR, label: 'Sênior' },
    { value: ExperienceLevel.LEAD, label: 'Líder' },
  ];

  const handleJobTypeChange = (value: string) => {
    const newTypes = selectedJobTypes.includes(value)
      ? selectedJobTypes.filter(type => type !== value)
      : [...selectedJobTypes, value];
    
    setSelectedJobTypes(newTypes);
    updateFilters(newTypes, selectedExperienceLevels, remoteOnly);
  };

  const handleExperienceLevelChange = (value: string) => {
    const newLevels = selectedExperienceLevels.includes(value)
      ? selectedExperienceLevels.filter(level => level !== value)
      : [...selectedExperienceLevels, value];
    
    setSelectedExperienceLevels(newLevels);
    updateFilters(selectedJobTypes, newLevels, remoteOnly);
  };

  const handleRemoteOnlyChange = () => {
    setRemoteOnly(!remoteOnly);
    updateFilters(selectedJobTypes, selectedExperienceLevels, !remoteOnly);
  };

  const updateFilters = (jobTypes: string[], experienceLevels: string[], isRemoteOnly: boolean) => {
    onFilterChange({
      jobTypes,
      experienceLevels,
      remoteOnly: isRemoteOnly
    });
  };

  const clearFilters = () => {
    setSelectedJobTypes([]);
    setSelectedExperienceLevels([]);
    setRemoteOnly(false);
    updateFilters([], [], false);
  };

  return (
    <div className="mb-6">
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="flex items-center text-gray-700 font-medium mb-4 hover:text-primary-600 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>
        {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
      </button>

      {showFilters && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tipos de contrato */}
            <div>
              <h3 className="font-medium text-gray-800 mb-3">Tipo de Contrato</h3>
              <div className="space-y-2">
                {jobTypeOptions.map(option => (
                  <label key={option.value} className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 rounded"
                      checked={selectedJobTypes.includes(option.value)}
                      onChange={() => handleJobTypeChange(option.value)}
                    />
                    <span className="ml-2 text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Níveis de experiência */}
            <div>
              <h3 className="font-medium text-gray-800 mb-3">Nível de Experiência</h3>
              <div className="space-y-2">
                {experienceLevelOptions.map(option => (
                  <label key={option.value} className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 rounded"
                      checked={selectedExperienceLevels.includes(option.value)}
                      onChange={() => handleExperienceLevelChange(option.value)}
                    />
                    <span className="ml-2 text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Outras opções */}
            <div>
              <h3 className="font-medium text-gray-800 mb-3">Outras Opções</h3>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 rounded"
                    checked={remoteOnly}
                    onChange={handleRemoteOnlyChange}
                  />
                  <span className="ml-2 text-gray-700">Apenas 100% Remoto</span>
                </label>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={clearFilters}
              className="text-gray-600 hover:text-gray-800 mr-4"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 