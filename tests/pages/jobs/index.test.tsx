import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import JobsPage from '@/pages/jobs/index';
import { Job, JobType, ExperienceLevel } from '@/types/models';

// Mock dependencies
jest.mock('next/head', () => {
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

jest.mock('@/components/common/Layout', () => {
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
  };
});

jest.mock('@/components/jobs/WideJobCard', () => {
  return {
    __esModule: true,
    default: ({ job }: { job: Job }) => (
      <div data-testid="job-card">
        <h3>{job.title}</h3>
        <p>{job.company}</p>
      </div>
    ),
  };
});

// Mock window.location
const mockLocation = { href: '' };
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('JobsPage component', () => {
  // Mock job data
  const mockJobs: Job[] = [
    {
      id: '1',
      title: 'Frontend Developer',
      company: 'TechCorp',
      location: 'Remote - Worldwide',
      jobType: 'FULL_TIME' as JobType,
      experienceLevel: 'MID' as ExperienceLevel,
      workplaceType: 'REMOTE',
      description: 'A job description',
      requirements: 'Job requirements',
      responsibilities: 'Job responsibilities',
      publishedAt: new Date('2023-01-01').toISOString(),
      createdAt: new Date('2023-01-01').toISOString(),
      skills: ['React', 'JavaScript'],
      tags: ['Frontend', 'Web Development'],
    },
    {
      id: '2',
      title: 'Backend Developer',
      company: 'DataSystems',
      location: 'Remote - LATAM',
      jobType: 'FULL_TIME' as JobType,
      experienceLevel: 'SENIOR' as ExperienceLevel,
      workplaceType: 'REMOTE',
      description: 'Another job description',
      requirements: 'Job requirements',
      responsibilities: 'Job responsibilities',
      publishedAt: new Date('2023-01-05').toISOString(),
      createdAt: new Date('2023-01-05').toISOString(),
      skills: ['Node.js', 'PostgreSQL'],
      tags: ['Backend', 'API Development'],
    },
  ];

  const defaultProps = {
    jobs: mockJobs,
    totalJobs: 2,
    page: 1,
    totalPages: 1,
  };

  it('renders the job listing page with heading', () => {
    render(<JobsPage {...defaultProps} />);
    expect(screen.getByText('Vagas Remotas Internacionais')).toBeInTheDocument();
  });

  it('renders the search form', () => {
    render(<JobsPage {...defaultProps} />);
    expect(screen.getByPlaceholderText('Busque por cargo, tecnologia ou empresa...')).toBeInTheDocument();
    expect(screen.getByText('Buscar')).toBeInTheDocument();
    expect(screen.getByText('Filtros')).toBeInTheDocument();
  });

  it('renders all job cards', () => {
    render(<JobsPage {...defaultProps} />);
    const jobCards = screen.getAllByTestId('job-card');
    expect(jobCards).toHaveLength(2);
    
    // Check if jobs titles are displayed
    expect(screen.getByText('Frontend Developer')).toBeInTheDocument();
    expect(screen.getByText('Backend Developer')).toBeInTheDocument();
  });

  it('shows filter options when filter button is clicked', () => {
    render(<JobsPage {...defaultProps} />);
    
    // Filters should be hidden initially
    expect(screen.queryByText('Tipo de Contrato')).not.toBeInTheDocument();
    
    // Click the filter button
    fireEvent.click(screen.getByText('Filtros'));
    
    // Filter options should be visible
    expect(screen.getByText('Tipo de Contrato')).toBeInTheDocument();
    expect(screen.getByText('Nível de Experiência')).toBeInTheDocument();
    expect(screen.getByText('Outras Opções')).toBeInTheDocument();
  });

  it('updates search term when input is changed', () => {
    render(<JobsPage {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Busque por cargo, tecnologia ou empresa...');
    fireEvent.change(searchInput, { target: { value: 'React' } });
    
    expect(searchInput).toHaveValue('React');
  });

  it('redirects with correct query parameters when search form is submitted', () => {
    render(<JobsPage {...defaultProps} />);
    
    // Set search term
    const searchInput = screen.getByPlaceholderText('Busque por cargo, tecnologia ou empresa...');
    fireEvent.change(searchInput, { target: { value: 'React' } });
    
    // Submit the form
    const searchButton = screen.getByText('Buscar');
    fireEvent.click(searchButton);
    
    // Check if window.location.href is set correctly
    expect(mockLocation.href).toBe('/jobs?search=React');
  });
}); 