import { useState, useEffect, useRef, useCallback } from 'react';
import { debounce } from 'lodash'; // Assuming lodash is available or install it

interface Suggestion {
  value: string;
  type: 'title' | 'company';
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const searchBarRef = useRef<HTMLDivElement>(null); // Ref for the main div

  // Update internal state if the external value prop changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Debounced function to fetch suggestions
  const fetchSuggestions = useCallback(
    debounce(async (query: string) => {
      if (query.trim().length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        setLoadingSuggestions(false);
        return;
      }
      setLoadingSuggestions(true);
      try {
        const response = await fetch(`/api/jobs/suggestions?query=${encodeURIComponent(query)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch suggestions');
        }
        const data = await response.json();
        setSuggestions(data.suggestions || []);
        setShowSuggestions(true); // Show suggestions once fetched
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300), // 300ms debounce time
    []
  );

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    fetchSuggestions(newValue);
  };

  // Handle form submission (when user presses Enter or clicks button)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onChange(inputValue); // Trigger the main search with the current input
    setShowSuggestions(false); // Hide suggestions on submit
  };

  // Handle clicking a suggestion
  const handleSuggestionClick = (suggestionValue: string) => {
    setInputValue(suggestionValue);
    onChange(suggestionValue); // Trigger the main search immediately
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Handle clearing the input
  const handleClear = () => {
    setInputValue('');
    onChange('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchBarRef.current && !searchBarRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={searchBarRef}>
      <form onSubmit={handleSubmit}>
        <div className="flex rounded-lg overflow-hidden shadow-sm border border-gray-200">
          <input
            type="text"
            value={inputValue} // Use internal state for input value
            onChange={handleChange}
            onFocus={() => inputValue.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)} // Show existing suggestions on focus if available
            placeholder="Pesquise por cargo, empresa, tecnologia..."
            className="flex-grow px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-autocomplete="list"
            aria-controls="suggestions-list"
          />
          {/* Clear Button */}
          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-16 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              aria-label="Limpar pesquisa"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          {/* Submit Button */}
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 flex items-center justify-center"
            aria-label="Pesquisar"
          >
            {loadingSuggestions ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
               </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </form>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <ul 
          id="suggestions-list"
          className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
          role="listbox"
        >
          {suggestions.map((suggestion, index) => (
            <li 
              key={index}
              onClick={() => handleSuggestionClick(suggestion.value)}
              className="px-4 py-2 hover:bg-blue-50 cursor-pointer flex justify-between items-center"
              role="option"
              aria-selected="false" // Basic accessibility, can be enhanced with keyboard nav
            >
              <span>{suggestion.value}</span>
              <span className="text-xs text-gray-400 ml-2 capitalize">{suggestion.type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 