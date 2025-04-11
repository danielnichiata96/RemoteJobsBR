import React, { useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';

// Define types for props (can be refined later)
type FilterAggregations = {
    jobTypes?: { [key: string]: number };
    experienceLevels?: { [key: string]: number };
    technologies?: { [key: string]: number };
};

type JobFiltersProps = {
    // Filter Values
    searchTerm: string;
    selectedJobTypes: string[];
    selectedExperienceLevels: string[];
    selectedTechnologies: string[];
    isRemoteOnly: boolean;

    // Handlers / Callbacks
    onSearchTermChange: (value: string) => void;
    onJobTypeChange: (value: string) => void;
    onExperienceLevelChange: (value: string) => void;
    onTechnologyChange: (value: string) => void;
    onRemoteChange: () => void;
    onClearFilters: () => void;
    onSearchSubmit: (e?: React.FormEvent) => void; // Renamed from onApplyFilters / handleSearch

    // Data for display
    aggregations?: FilterAggregations;
};

// Define options locally within the component for now
const jobTypeOptions = [
    { value: 'FULL_TIME', label: 'Tempo Integral' },
    { value: 'PART_TIME', label: 'Meio Período' },
    { value: 'CONTRACT', label: 'Contrato' },
    { value: 'INTERNSHIP', label: 'Estágio' },
    { value: 'FREELANCE', label: 'Freelance' },
];

const experienceLevelOptions = [
    { value: 'ENTRY', label: 'Júnior' },
    { value: 'MID', label: 'Pleno' },
    { value: 'SENIOR', label: 'Sênior' },
    { value: 'LEAD', label: 'Líder' },
];

const technologyOptions = [
    { value: 'React', label: 'React' },
    { value: 'Node.js', label: 'Node.js' },
    { value: 'TypeScript', label: 'TypeScript' },
    { value: 'Python', label: 'Python' },
    { value: 'Next.js', label: 'Next.js' },
    { value: 'AWS', label: 'AWS' },
    { value: 'Docker', label: 'Docker' },
    { value: 'JavaScript', label: 'JavaScript' },
];


export default function JobFilters({
    searchTerm: initialSearchTerm,
    selectedJobTypes,
    selectedExperienceLevels,
    selectedTechnologies,
    isRemoteOnly,
    onSearchTermChange,
    onJobTypeChange,
    onExperienceLevelChange,
    onTechnologyChange,
    onRemoteChange,
    onClearFilters,
    onSearchSubmit,
    aggregations,
}: JobFiltersProps) {
    const [showFilters, setShowFilters] = useState(false);
    const [localSearchTerm, setLocalSearchTerm] = useState(initialSearchTerm);
    const debouncedSearchTerm = useDebounce(localSearchTerm, 500);

    useEffect(() => {
        if (debouncedSearchTerm !== initialSearchTerm) {
            onSearchTermChange(debouncedSearchTerm);
        }
    }, [debouncedSearchTerm, initialSearchTerm, onSearchTermChange]);

    useEffect(() => {
        setLocalSearchTerm(initialSearchTerm);
    }, [initialSearchTerm]);

    const handleFilterToggle = () => {
        setShowFilters(!showFilters);
    };

    const handleApplyAndClose = () => {
        onSearchSubmit();
        setShowFilters(false);
    };

    return (
        <div className="bg-gray-50 py-6 mb-8 rounded-lg shadow-sm border border-gray-200">
            <div className="container mx-auto px-4">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                    Encontre sua Vaga Remota
                </h2>
                <form onSubmit={onSearchSubmit} className="mb-0">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-grow">
                            <input
                                type="text"
                                placeholder="Busque por cargo, tecnologia ou empresa..."
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                                value={localSearchTerm}
                                onChange={(e) => setLocalSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            type="submit"
                            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition duration-200"
                        >
                            Buscar
                        </button>
                        <button
                            type="button"
                            onClick={handleFilterToggle}
                            className="w-full md:w-auto bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition duration-200 flex items-center justify-center md:justify-start"
                        >
                            <span>Filtros</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>

                    {showFilters && (
                        <div className="mt-4 bg-white p-6 rounded-lg shadow-md border border-gray-200">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                <div>
                                    <h3 className="font-medium text-gray-900 mb-3">Tipo de Contrato</h3>
                                    <div className="space-y-2">
                                        {jobTypeOptions.map(option => {
                                            const count = aggregations?.jobTypes?.[option.value] || 0;
                                            const isDisabled = !count && !selectedJobTypes.includes(option.value);
                                            return (
                                                <label key={option.value} className={`flex items-center ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                                    <input
                                                        type="checkbox"
                                                        className={`h-4 w-4 text-primary-600 focus:ring-primary-500 rounded ${isDisabled ? 'cursor-not-allowed' : ''}`}
                                                        checked={selectedJobTypes.includes(option.value)}
                                                        onChange={() => !isDisabled && onJobTypeChange(option.value)}
                                                        disabled={isDisabled}
                                                    />
                                                    <span className={`ml-2 text-gray-700 ${isDisabled ? 'text-gray-400' : ''}`}>
                                                        {option.label} ({count})
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-medium text-gray-900 mb-3">Nível de Experiência</h3>
                                    <div className="space-y-2">
                                        {experienceLevelOptions.map(option => {
                                            const count = aggregations?.experienceLevels?.[option.value] || 0;
                                            const isDisabled = !count && !selectedExperienceLevels.includes(option.value);
                                            return (
                                                <label key={option.value} className={`flex items-center ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                                    <input
                                                        type="checkbox"
                                                        className={`h-4 w-4 text-primary-600 focus:ring-primary-500 rounded ${isDisabled ? 'cursor-not-allowed' : ''}`}
                                                        checked={selectedExperienceLevels.includes(option.value)}
                                                        onChange={() => !isDisabled && onExperienceLevelChange(option.value)}
                                                        disabled={isDisabled}
                                                    />
                                                    <span className={`ml-2 text-gray-700 ${isDisabled ? 'text-gray-400' : ''}`}>
                                                        {option.label} ({count})
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-medium text-gray-900 mb-3">Tecnologia</h3>
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                        {technologyOptions.map(option => {
                                            const count = aggregations?.technologies?.[option.value] ||
                                                          aggregations?.technologies?.[option.value.toLowerCase()] ||
                                                          0;
                                            const isDisabled = !count && !selectedTechnologies.includes(option.value);
                                            return (
                                                <label key={option.value} className={`flex items-center ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                                    <input
                                                        type="checkbox"
                                                        className={`h-4 w-4 text-primary-600 focus:ring-primary-500 rounded ${isDisabled ? 'cursor-not-allowed' : ''}`}
                                                        checked={selectedTechnologies.includes(option.value)}
                                                        onChange={() => !isDisabled && onTechnologyChange(option.value)}
                                                        disabled={isDisabled}
                                                    />
                                                    <span className={`ml-2 text-gray-700 ${isDisabled ? 'text-gray-400' : ''}`}>
                                                        {option.label} ({count})
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-medium text-gray-900 mb-3">Localização</h3>
                                    <div className="space-y-2">
                                       <label className="flex items-center cursor-pointer">
                                          <input
                                             type="checkbox"
                                             className="h-4 w-4 text-primary-600 focus:ring-primary-500 rounded"
                                             checked={isRemoteOnly}
                                             onChange={onRemoteChange}
                                          />
                                          <span className="ml-2 text-gray-700">Apenas Remoto</span>
                                       </label>
                                    </div>
                                 </div>
                            </div>
                            <div className="mt-6 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4">
                                <button
                                    type="button"
                                    onClick={onClearFilters}
                                    className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
                                >
                                    Limpar Filtros
                                </button>
                                <button
                                    type="button"
                                    onClick={handleApplyAndClose}
                                    className="w-full sm:w-auto px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-medium transition duration-200"
                                >
                                    Aplicar Filtros
                                </button>
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
} 