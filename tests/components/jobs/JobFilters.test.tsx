import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import JobFilters, { FilterState } from '@/components/jobs/JobFilters'; // Adjust import path if needed

// Mock props generator
const getMockProps = (overrides: Partial<React.ComponentProps<typeof JobFilters>> = {}): React.ComponentProps<typeof JobFilters> => ({
    searchTerm: '',
    selectedJobTypes: [],
    selectedExperienceLevels: [],
    selectedTechnologies: [],
    isRemoteOnly: false,
    onSearchTermChange: jest.fn(),
    onJobTypeChange: jest.fn(),
    onExperienceLevelChange: jest.fn(),
    onTechnologyChange: jest.fn(),
    onRemoteChange: jest.fn(),
    onClearFilters: jest.fn(),
    onSearchSubmit: jest.fn(),
    aggregations: { jobTypes: {}, experienceLevels: {}, technologies: {} },
    ...overrides,
});

describe('<JobFilters />', () => {

    it('renders the search input and filter toggle button', () => {
        render(<JobFilters {...getMockProps()} />);

        // Check for search input placeholder
        expect(screen.getByPlaceholderText(/Busque por cargo, tecnologia ou empresa/i)).toBeInTheDocument();

        // Check for filter toggle button
        expect(screen.getByRole('button', { name: /filtros/i })).toBeInTheDocument();
    });

    it('does not show filter options initially', () => {
        render(<JobFilters {...getMockProps()} />);
        // Check that a filter group heading is NOT visible
        expect(screen.queryByRole('heading', { name: /tipo de contrato/i })).not.toBeInTheDocument();
    });

    it('toggles filter options visibility on button click', () => {
        render(<JobFilters {...getMockProps()} />);
        const toggleButton = screen.getByRole('button', { name: /filtros/i });

        // Initially hidden
        expect(screen.queryByRole('heading', { name: /tipo de contrato/i })).not.toBeInTheDocument();

        // Click to show
        fireEvent.click(toggleButton);
        expect(screen.getByRole('heading', { name: /tipo de contrato/i })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /nível de experiência/i })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /tecnologia/i })).toBeInTheDocument();

        // Click to hide again
        fireEvent.click(toggleButton);
        expect(screen.queryByRole('heading', { name: /tipo de contrato/i })).not.toBeInTheDocument();
    });

    it('calls onSearchTermChange when search input changes', () => {
        const mockHandler = jest.fn();
        render(<JobFilters {...getMockProps({ onSearchTermChange: mockHandler })} />);
        const searchInput = screen.getByPlaceholderText(/Busque por cargo, tecnologia ou empresa/i);

        fireEvent.change(searchInput, { target: { value: 'React Developer' } });

        expect(mockHandler).toHaveBeenCalledTimes(1);
        expect(mockHandler).toHaveBeenCalledWith('React Developer');
    });

    it('calls onJobTypeChange when a job type checkbox is clicked', () => {
        const mockHandler = jest.fn();
        render(<JobFilters {...getMockProps({ onJobTypeChange: mockHandler })} />);
        const toggleButton = screen.getByRole('button', { name: /filtros/i });

        // Open filters
        fireEvent.click(toggleButton);

        // Find and click the 'Tempo Integral' checkbox
        // Use label text and associated control finding
        const checkbox = screen.getByLabelText(/Tempo Integral/i);
        fireEvent.click(checkbox);

        expect(mockHandler).toHaveBeenCalledTimes(1);
        expect(mockHandler).toHaveBeenCalledWith('FULL_TIME'); // Check for the value
    });

    it('calls onClearFilters when the clear button is clicked', () => {
        const mockHandler = jest.fn();
        render(<JobFilters {...getMockProps({ onClearFilters: mockHandler })} />);
        const toggleButton = screen.getByRole('button', { name: /filtros/i });

        // Open filters
        fireEvent.click(toggleButton);

        // Find and click the clear button
        const clearButton = screen.getByRole('button', { name: /limpar filtros/i });
        fireEvent.click(clearButton);

        expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    it('calls onSearchSubmit and closes filters when the apply button is clicked', () => {
        const mockHandler = jest.fn();
        render(<JobFilters {...getMockProps({ onSearchSubmit: mockHandler })} />);
        const toggleButton = screen.getByRole('button', { name: /filtros/i });

        // Open filters
        fireEvent.click(toggleButton);
        expect(screen.getByRole('heading', { name: /tipo de contrato/i })).toBeInTheDocument(); // Verify filters are open

        // Find and click the apply button
        const applyButton = screen.getByRole('button', { name: /aplicar filtros/i });
        fireEvent.click(applyButton);

        // Check handler called
        expect(mockHandler).toHaveBeenCalledTimes(1);

        // Check filters are closed
        expect(screen.queryByRole('heading', { name: /tipo de contrato/i })).not.toBeInTheDocument();
    });

    // Test aggregation counts display
    it('displays counts next to filter options when provided', () => {
        const mockAggregations = {
            jobTypes: { FULL_TIME: 15, CONTRACT: 3 },
            experienceLevels: { MID: 5, SENIOR: 10 },
            technologies: { React: 8, Node: 4 }
        };
        render(<JobFilters {...getMockProps({ aggregations: mockAggregations })} />);
        const toggleButton = screen.getByRole('button', { name: /filtros/i });
        fireEvent.click(toggleButton); // Open filters

        expect(screen.getByLabelText(/Tempo Integral \(15\)/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Contrato \(3\)/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Meio Período \(0\)/i)).toBeInTheDocument(); // Check zero count display

        expect(screen.getByLabelText(/Pleno \(5\)/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Sênior \(10\)/i)).toBeInTheDocument();

        expect(screen.getByLabelText(/React \(8\)/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Node\.js \(4\)/i)).toBeInTheDocument(); // Escaped dot
    });

    // Test disabled state based on counts
    it('disables filter options with zero count', () => {
         const mockAggregations = {
            jobTypes: { FULL_TIME: 15 },
            experienceLevels: { SENIOR: 10 },
            technologies: { React: 8 }
        };
        render(<JobFilters {...getMockProps({ aggregations: mockAggregations })} />);
        const toggleButton = screen.getByRole('button', { name: /filtros/i });
        fireEvent.click(toggleButton); // Open filters

        // Enabled
        expect(screen.getByLabelText(/Tempo Integral \(15\)/i)).not.toBeDisabled();
        expect(screen.getByLabelText(/Sênior \(10\)/i)).not.toBeDisabled();
        expect(screen.getByLabelText(/React \(8\)/i)).not.toBeDisabled();

        // Disabled (count is 0 and not selected)
        expect(screen.getByLabelText(/Meio Período \(0\)/i)).toBeDisabled();
        expect(screen.getByLabelText(/Júnior \(0\)/i)).toBeDisabled();
        expect(screen.getByLabelText(/Node\.js \(0\)/i)).toBeDisabled();
    });

     it('does not disable a selected filter option even if its count becomes zero', () => {
         const mockAggregations = {
            jobTypes: { FULL_TIME: 0 }, // Count becomes 0 after selection
            experienceLevels: {}, 
            technologies: {}
        };
        render(<JobFilters {...getMockProps({
             aggregations: mockAggregations,
             selectedJobTypes: ['FULL_TIME'] // Pre-select it
            })} 
        />);
        const toggleButton = screen.getByRole('button', { name: /filtros/i });
        fireEvent.click(toggleButton); // Open filters

        // Should still be enabled because it's selected
        const fullTimeCheckbox = screen.getByLabelText(/Tempo Integral \(0\)/i);
        expect(fullTimeCheckbox).not.toBeDisabled();
        expect(fullTimeCheckbox).toBeChecked();
    });

    // Add the debounce test case
    it('debounces search term input before calling onSearchTermChange', () => {
        jest.useFakeTimers(); // Use fake timers for this test
        const mockHandler = jest.fn();
        const delay = 500; // Must match the delay in JobFilters.tsx

        render(<JobFilters {...getMockProps({ onSearchTermChange: mockHandler })} />);
        const searchInput = screen.getByPlaceholderText(/Busque por cargo, tecnologia ou empresa/i);

        // Simulate typing quickly
        fireEvent.change(searchInput, { target: { value: 'React' } });
        fireEvent.change(searchInput, { target: { value: 'React N' } });
        fireEvent.change(searchInput, { target: { value: 'React Native' } });

        // Handler should not have been called yet
        expect(mockHandler).not.toHaveBeenCalled();

        // Advance timers just below the delay
        jest.advanceTimersByTime(delay - 1);
        expect(mockHandler).not.toHaveBeenCalled();

        // Advance timers past the delay
        jest.advanceTimersByTime(1);
        expect(mockHandler).toHaveBeenCalledTimes(1);
        expect(mockHandler).toHaveBeenCalledWith('React Native'); // Called with the latest value
        
        // Simulate another change after debounce
        fireEvent.change(searchInput, { target: { value: 'Developer' } });
        expect(mockHandler).toHaveBeenCalledTimes(1); // Still called only once

        // Advance time again
        jest.advanceTimersByTime(delay);
        expect(mockHandler).toHaveBeenCalledTimes(2);
        expect(mockHandler).toHaveBeenCalledWith('Developer');

        jest.useRealTimers(); // Restore real timers
    });

    // Add more tests here...

}); 