import { useState } from 'react';

interface SimpleFilterProps {
  selectedJobTypes: string[];
  selectedExperienceLevels: string[];
  selectedIndustries: string[];
  selectedLocations: string[];
  onJobTypeChange: (types: string[]) => void;
  onExperienceLevelChange: (levels: string[]) => void;
  onIndustryChange: (industries: string[]) => void;
  onLocationChange: (locations: string[]) => void;
  onClearFilters: () => void;
}

export default function SimpleFilter({
  selectedJobTypes,
  selectedExperienceLevels,
  selectedIndustries,
  selectedLocations,
  onJobTypeChange,
  onExperienceLevelChange,
  onIndustryChange,
  onLocationChange,
  onClearFilters
}: SimpleFilterProps) {
  // Opções de tipo de contrato
  const jobTypeOptions = [
    { id: 'FULL_TIME', label: 'Tempo integral' },
    { id: 'PART_TIME', label: 'Meio período' },
    { id: 'CONTRACT', label: 'Contrato' },
    { id: 'INTERNSHIP', label: 'Estágio' },
    { id: 'FREELANCE', label: 'Freelance' }
  ];

  // Opções de nível de experiência
  const experienceLevelOptions = [
    { id: 'ENTRY', label: 'Júnior' },
    { id: 'MID', label: 'Pleno' },
    { id: 'SENIOR', label: 'Sênior' },
    { id: 'LEAD', label: 'Líder' }
  ];

  // Opções de indústria/área
  const industryOptions = [
    { id: 'tech', label: 'Tecnologia' },
    { id: 'finance', label: 'Finanças' },
    { id: 'healthcare', label: 'Saúde' },
    { id: 'education', label: 'Educação' },
    { id: 'ecommerce', label: 'E-commerce' },
    { id: 'marketing', label: 'Marketing' }
  ];

  // Opções de localização
  const locationOptions = [
    { id: 'worldwide', label: 'Mundial' },
    { id: 'latam', label: 'América Latina' },
    { id: 'brazil', label: 'Brasil' }
  ];

  // Handlers para os checkboxes
  const handleJobTypeChange = (typeId: string) => {
    if (selectedJobTypes.includes(typeId)) {
      onJobTypeChange(selectedJobTypes.filter(id => id !== typeId));
    } else {
      onJobTypeChange([...selectedJobTypes, typeId]);
    }
  };

  const handleExperienceLevelChange = (levelId: string) => {
    if (selectedExperienceLevels.includes(levelId)) {
      onExperienceLevelChange(selectedExperienceLevels.filter(id => id !== levelId));
    } else {
      onExperienceLevelChange([...selectedExperienceLevels, levelId]);
    }
  };

  const handleIndustryChange = (industryId: string) => {
    if (selectedIndustries.includes(industryId)) {
      onIndustryChange(selectedIndustries.filter(id => id !== industryId));
    } else {
      onIndustryChange([...selectedIndustries, industryId]);
    }
  };

  const handleLocationChange = (locationId: string) => {
    if (selectedLocations.includes(locationId)) {
      onLocationChange(selectedLocations.filter(id => id !== locationId));
    } else {
      onLocationChange([...selectedLocations, locationId]);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium">Filtros</h2>
        {(selectedJobTypes.length > 0 || 
          selectedExperienceLevels.length > 0 || 
          selectedIndustries.length > 0 || 
          selectedLocations.length > 0) && (
          <button 
            onClick={onClearFilters}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Tipo de Contrato */}
      <div className="mb-6">
        <h3 className="font-medium mb-3">Tipo de Contrato</h3>
        <div className="space-y-2">
          {jobTypeOptions.map((option) => (
            <label key={option.id} className="flex items-center">
              <input
                type="checkbox"
                className="form-checkbox h-4 w-4 text-blue-600"
                checked={selectedJobTypes.includes(option.id)}
                onChange={() => handleJobTypeChange(option.id)}
              />
              <span className="ml-2 text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Nível de Experiência */}
      <div className="mb-6">
        <h3 className="font-medium mb-3">Nível de Experiência</h3>
        <div className="space-y-2">
          {experienceLevelOptions.map((option) => (
            <label key={option.id} className="flex items-center">
              <input
                type="checkbox"
                className="form-checkbox h-4 w-4 text-blue-600"
                checked={selectedExperienceLevels.includes(option.id)}
                onChange={() => handleExperienceLevelChange(option.id)}
              />
              <span className="ml-2 text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Indústria/Área */}
      <div className="mb-6">
        <h3 className="font-medium mb-3">Indústria / Área</h3>
        <div className="space-y-2">
          {industryOptions.map((option) => (
            <label key={option.id} className="flex items-center">
              <input
                type="checkbox"
                className="form-checkbox h-4 w-4 text-blue-600"
                checked={selectedIndustries.includes(option.id)}
                onChange={() => handleIndustryChange(option.id)}
              />
              <span className="ml-2 text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Localização */}
      <div className="mb-6">
        <h3 className="font-medium mb-3">Localização</h3>
        <div className="space-y-2">
          {locationOptions.map((option) => (
            <label key={option.id} className="flex items-center">
              <input
                type="checkbox"
                className="form-checkbox h-4 w-4 text-blue-600"
                checked={selectedLocations.includes(option.id)}
                onChange={() => handleLocationChange(option.id)}
              />
              <span className="ml-2 text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
} 