import { useState } from 'react';

// Reuse the FilterCounts type (assuming it might be moved to a shared types file later)
interface FilterCounts {
  jobTypes: Record<string, number>;
  experienceLevels: Record<string, number>;
  industries: Record<string, number>;
  locations: Record<string, number>;
}

interface SimpleFilterProps {
  selectedJobTypes: string[];
  selectedExperienceLevels: string[];
  selectedIndustries: string[];
  selectedLocations: string[];
  filterCounts: FilterCounts | null; // Add filterCounts prop
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
  filterCounts, // Receive filterCounts
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
    // Add more industries as needed
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

  // Helper to get count, defaulting to 0
  const getCount = (counts: Record<string, number> | undefined, key: string): number => {
      return counts?.[key] || 0;
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
          {jobTypeOptions.map((option) => {
            const count = getCount(filterCounts?.jobTypes, option.id);
            return (
              <label key={option.id} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  checked={selectedJobTypes.includes(option.id)}
                  onChange={() => handleJobTypeChange(option.id)}
                  // Disable if count is 0 and not selected (optional)
                  // disabled={count === 0 && !selectedJobTypes.includes(option.id)}
                />
                <span className={`ml-2 ${count === 0 && !selectedJobTypes.includes(option.id) ? 'text-gray-400' : 'text-gray-700'}`}>
                  {option.label} 
                  {filterCounts && <span className="text-xs text-gray-500">({count})</span>}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Nível de Experiência */}
      <div className="mb-6">
        <h3 className="font-medium mb-3">Nível de Experiência</h3>
        <div className="space-y-2">
          {experienceLevelOptions.map((option) => {
            const count = getCount(filterCounts?.experienceLevels, option.id);
            return (
              <label key={option.id} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  checked={selectedExperienceLevels.includes(option.id)}
                  onChange={() => handleExperienceLevelChange(option.id)}
                  // disabled={count === 0 && !selectedExperienceLevels.includes(option.id)}
                />
                <span className={`ml-2 ${count === 0 && !selectedExperienceLevels.includes(option.id) ? 'text-gray-400' : 'text-gray-700'}`}>
                  {option.label} 
                  {filterCounts && <span className="text-xs text-gray-500">({count})</span>}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Indústria/Área */}
      <div className="mb-6">
        <h3 className="font-medium mb-3">Indústria / Área</h3>
        <div className="space-y-2">
          {industryOptions.map((option) => {
            const count = getCount(filterCounts?.industries, option.id);
            return (
              <label key={option.id} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  checked={selectedIndustries.includes(option.id)}
                  onChange={() => handleIndustryChange(option.id)}
                  // disabled={count === 0 && !selectedIndustries.includes(option.id)}
                />
                <span className={`ml-2 ${count === 0 && !selectedIndustries.includes(option.id) ? 'text-gray-400' : 'text-gray-700'}`}>
                  {option.label} 
                  {filterCounts && <span className="text-xs text-gray-500">({count})</span>}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Localização */}
      <div className="mb-6">
        <h3 className="font-medium mb-3">Localização</h3>
        <div className="space-y-2">
          {locationOptions.map((option) => {
            const count = getCount(filterCounts?.locations, option.id);
            return (
              <label key={option.id} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  checked={selectedLocations.includes(option.id)}
                  onChange={() => handleLocationChange(option.id)}
                  // disabled={count === 0 && !selectedLocations.includes(option.id)}
                />
                <span className={`ml-2 ${count === 0 && !selectedLocations.includes(option.id) ? 'text-gray-400' : 'text-gray-700'}`}>
                  {option.label} 
                  {filterCounts && <span className="text-xs text-gray-500">({count})</span>}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
} 