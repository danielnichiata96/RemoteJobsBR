import { useState } from 'react';
import { JobType, ExperienceLevel } from '@/types/job';

interface FilterProps {
  onFilterChange: (filters: {
    jobTypes: string[];
    experienceLevels: string[];
    industries: string[];
    locations: string[];
  }) => void;
}

export default function SimpleFilter({ onFilterChange }: FilterProps) {
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const [selectedExperienceLevels, setSelectedExperienceLevels] = useState<string[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);

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

  const industryOptions = [
    { value: 'tech', label: 'Tecnologia' },
    { value: 'finance', label: 'Finanças' },
    { value: 'education', label: 'Educação' },
    { value: 'healthcare', label: 'Saúde' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'design', label: 'Design' },
  ];

  const locationOptions = [
    { value: 'worldwide', label: 'Worldwide' },
    { value: 'latam', label: 'LATAM' },
    { value: 'brazil', label: 'Brasil' },
  ];

  const handleJobTypeChange = (value: string) => {
    const newTypes = selectedJobTypes.includes(value)
      ? selectedJobTypes.filter(type => type !== value)
      : [...selectedJobTypes, value];
    
    setSelectedJobTypes(newTypes);
    updateFilters(newTypes, selectedExperienceLevels, selectedIndustries, selectedLocations);
  };

  const handleExperienceLevelChange = (value: string) => {
    const newLevels = selectedExperienceLevels.includes(value)
      ? selectedExperienceLevels.filter(level => level !== value)
      : [...selectedExperienceLevels, value];
    
    setSelectedExperienceLevels(newLevels);
    updateFilters(selectedJobTypes, newLevels, selectedIndustries, selectedLocations);
  };

  const handleIndustryChange = (value: string) => {
    const newIndustries = selectedIndustries.includes(value)
      ? selectedIndustries.filter(industry => industry !== value)
      : [...selectedIndustries, value];
    
    setSelectedIndustries(newIndustries);
    updateFilters(selectedJobTypes, selectedExperienceLevels, newIndustries, selectedLocations);
  };

  const handleLocationChange = (value: string) => {
    const newLocations = selectedLocations.includes(value)
      ? selectedLocations.filter(location => location !== value)
      : [...selectedLocations, value];
    
    setSelectedLocations(newLocations);
    updateFilters(selectedJobTypes, selectedExperienceLevels, selectedIndustries, newLocations);
  };

  const updateFilters = (
    jobTypes: string[], 
    experienceLevels: string[], 
    industries: string[],
    locations: string[]
  ) => {
    onFilterChange({
      jobTypes,
      experienceLevels,
      industries,
      locations
    });
  };

  const clearFilters = () => {
    setSelectedJobTypes([]);
    setSelectedExperienceLevels([]);
    setSelectedIndustries([]);
    setSelectedLocations([]);
    updateFilters([], [], [], []);
  };

  return (
    <div className="mb-6 bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Filtros</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Tipos de contrato */}
        <div>
          <h3 className="font-medium text-gray-800 mb-3">Tipo de Contrato</h3>
          <div className="space-y-2">
            {jobTypeOptions.map(option => (
              <label key={option.value} className="flex items-center cursor-pointer">
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
              <label key={option.value} className="flex items-center cursor-pointer">
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

        {/* Indústria / Área */}
        <div>
          <h3 className="font-medium text-gray-800 mb-3">Área / Indústria</h3>
          <div className="space-y-2">
            {industryOptions.map(option => (
              <label key={option.value} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 rounded"
                  checked={selectedIndustries.includes(option.value)}
                  onChange={() => handleIndustryChange(option.value)}
                />
                <span className="ml-2 text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Localização */}
        <div>
          <h3 className="font-medium text-gray-800 mb-3">Localização</h3>
          <div className="space-y-2">
            {locationOptions.map(option => (
              <label key={option.value} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 rounded"
                  checked={selectedLocations.includes(option.value)}
                  onChange={() => handleLocationChange(option.value)}
                />
                <span className="ml-2 text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 text-right">
        <button
          onClick={clearFilters}
          className="text-gray-600 hover:text-gray-800 text-sm font-medium"
        >
          Limpar filtros
        </button>
      </div>
    </div>
  );
} 