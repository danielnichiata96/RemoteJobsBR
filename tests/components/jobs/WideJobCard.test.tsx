import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import WideJobCard from '@/components/jobs/WideJobCard';
import { JobType, ExperienceLevel } from '@/types/models';

// Mock Next.js modules
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // Simulate image error if src is specific invalid value
    if (props.src === 'invalid-logo-url') {
      if (props.onError) {
        // Call onError asynchronously to avoid React render warning
        setTimeout(() => props.onError(), 0); 
      }
      return null; // Don't render the img tag in error state
    }
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
  const baseMockJob: Job = {
    id: '123456',
    title: 'Senior React Developer',
    description: 'Develop amazing things with React.',
    requirements: '5+ years of React experience',
    responsibilities: 'Build and maintain frontend features',
    jobType: 'FULL_TIME',
    experienceLevel: 'SENIOR',
    skills: ['React', 'TypeScript', 'Next.js'],
    location: 'Remote - Worldwide',
    workplaceType: 'REMOTE',
    createdAt: new Date('2022-01-15T10:00:00Z').toISOString(),
    publishedAt: new Date('2022-01-15T10:00:00Z').toISOString(),
    company: {
      id: 'company-abc',
      name: 'Tech Company',
      logo: null,
      websiteUrl: 'https://techcompany.com'
    },
    companyLogo: 'https://img.logo.dev/techcompany.com',
    applicationUrl: 'https://apply.example.com/123',
    isSaved: false,
    source: 'direct',
    sourceId: null,
    sourceLogo: null,
    sourceUrl: null,
    companyId: 'company-abc',
    tags: [],
    country: 'Worldwide',
    minSalary: null,
    maxSalary: null,
    currency: null,
    salaryCycle: null,
    showSalary: false,
    status: 'ACTIVE',
    visas: [],
    languages: [],
    applicationEmail: null,
    updatedAt: new Date().toISOString(),
    expiresAt: null,
    viewCount: 0,
    clickCount: 0,
  };

  // Specific mock for testing the logo fallback
  const mockJobWithoutValidLogo = {
    ...baseMockJob,
    companyLogo: 'invalid-logo-url', // Use the specific invalid URL
  };
  
  // Mock job with an actual logo URL for image test
  const mockJobWithLogo = {
    ...baseMockJob, // Inherits the valid logo URL
  };

  it('renders the job title and company name', () => {
    render(<WideJobCard job={baseMockJob} />);
    expect(screen.getByText('Senior React Developer')).toBeInTheDocument();
    expect(screen.getByText('Tech Company')).toBeInTheDocument();
  });

  it('renders job location and job type', () => {
    render(<WideJobCard job={baseMockJob} />);
    expect(screen.getByText('Remote - Worldwide')).toBeInTheDocument();
    expect(screen.getByText('Tempo Integral')).toBeInTheDocument();
  });
  
  it('renders the company logo when a valid logo URL is provided', () => {
    render(<WideJobCard job={mockJobWithLogo} />);
    const logoImage = screen.getByAltText('Tech Company logo');
    expect(logoImage).toBeInTheDocument();
    expect(logoImage).toHaveAttribute('src', 'https://img.logo.dev/techcompany.com');
  });

  it('renders default company initial when logo URL is invalid/missing', async () => {
    // Use the mock job with the invalid logo URL
    render(<WideJobCard job={mockJobWithoutValidLogo} />); 
    
    // Check that the image is NOT rendered (or attempt failed)
    expect(screen.queryByAltText('Tech Company logo')).not.toBeInTheDocument();

    // Use waitFor to wait for the asynchronous state update and re-render
    await waitFor(() => {
      // Check that the fallback initial IS rendered
      const logoInitial = screen.getByText('T');
      expect(logoInitial).toBeInTheDocument();
    });
  });

  it('includes a link to the job details page', () => {
    render(<WideJobCard job={baseMockJob} />);
    const link = document.querySelector(`a[href="/jobs/123456"]`);
    expect(link).toBeInTheDocument();
  });

  it('includes a save job button', () => {
    render(<WideJobCard job={baseMockJob} />);
    const saveButton = screen.getByTestId('save-job-button');
    expect(saveButton).toBeInTheDocument();
  });

  it('renders experience level correctly', () => {
    render(<WideJobCard job={baseMockJob} />);
    expect(screen.getByText('Sênior')).toBeInTheDocument();
  });
}); 