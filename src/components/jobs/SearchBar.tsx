import { useState } from 'react';

interface SearchBarProps {
  onSearch: (term: string) => void;
  initialTerm?: string;
}

export default function SearchBar({ onSearch, initialTerm = '' }: SearchBarProps) {
  const [searchTerm, setSearchTerm] = useState(initialTerm);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchTerm);
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="flex">
        <input
          type="text"
          placeholder="Busque por cargo, tecnologia ou empresa..."
          className="flex-grow px-4 py-3 rounded-l-lg border border-gray-300 focus:ring-primary-500 focus:border-primary-500 focus:outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button
          type="submit"
          className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-r-lg transition duration-200"
        >
          Buscar
        </button>
      </div>
    </form>
  );
} 