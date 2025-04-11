import React from 'react';
import { render, screen } from '@testing-library/react';
import WideJobCard from '@/components/jobs/WideJobCard';
import { JobType, ExperienceLevel } from '@/types/models';

// Mock Next.js modules
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt || ''} />;
  },
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock SaveJobButton component
jest.mock('@/components/jobs/SaveJobButton', () => ({
  __esModule: true,
  default: ({ jobId }: { jobId: string }) => (
    <button data-testid="save-job-button">{`Save Job ${jobId}`}</button>
  ),
}));

describe('WideJobCard component', () => {
  // Sample job data for testing
  const mockJob = {
    id: '123456',
    title: 'Senior React Developer',
    company: 'Tech Company',
    companyLogo: null,
    location: 'Remote - Worldwide',
    jobType: 'FULL_TIME' as JobType,
    experienceLevel: 'SENIOR' as ExperienceLevel,
    workplaceType: 'REMOTE',
    publishedAt: new Date('2023-01-01').toISOString(),
    createdAt: new Date('2023-01-01').toISOString(),
    description: 'Job description',
    requirements: 'Job requirements',
    responsibilities: 'Job responsibilities',
    skills: ['React', 'TypeScript'],
    tags: ['Frontend', 'Remote'],
  };

  it('renders the job title and company name', () => {
    render(<WideJobCard job={mockJob} />);
    
    // Check if job title and company name are displayed
    expect(screen.getByText('Senior React Developer')).toBeInTheDocument();
    expect(screen.getByText('Tech Company')).toBeInTheDocument();
  });

  it('renders job location and job type', () => {
    render(<WideJobCard job={mockJob} />);
    
    // Check if location and job type are displayed
    expect(screen.getByText('Remote - Worldwide')).toBeInTheDocument();
    
    // Check if job type is formatted and displayed
    expect(screen.getByText('Tempo Integral')).toBeInTheDocument();
  });

  it('renders default company logo when no logo is provided', () => {
    render(<WideJobCard job={mockJob} />);
    
    // When no logo is provided, it should display the first letter of the company name
    const logoInitial = screen.getByText('T');
    expect(logoInitial).toBeInTheDocument();
  });

  it('includes a link to the job details page', () => {
    render(<WideJobCard job={mockJob} />);
    
    // Check if link to job details exists
    const link = document.querySelector(`a[href="/jobs/123456"]`);
    expect(link).toBeInTheDocument();
  });

  it('includes a save job button', () => {
    render(<WideJobCard job={mockJob} />);
    
    // Check if save job button exists
    const saveButton = screen.getByTestId('save-job-button');
    expect(saveButton).toBeInTheDocument();
  });

  it('renders experience level correctly', () => {
    render(<WideJobCard job={mockJob} />);
    
    // Check if experience level is formatted and displayed
    expect(screen.getByText('Sênior')).toBeInTheDocument();
  });
}); 