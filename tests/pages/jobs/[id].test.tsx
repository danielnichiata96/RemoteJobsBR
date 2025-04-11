// tests/pages/jobs/[id].test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useRouter } from 'next/router';
import JobDetailPage, { getServerSideProps } from '@/pages/jobs/[id].tsx';
import { useTrackJobClick } from '@/hooks/useTrackJobClick';
import { prisma } from '@/lib/prisma';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Mock dependencies
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));
jest.mock('@/hooks/useTrackJobClick', () => ({
  useTrackJobClick: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    job: {
      findUnique: jest.fn(),
    },
  },
}));
jest.mock('date-fns', () => ({
  ...jest.requireActual('date-fns'), // Keep actual implementations
  formatDistanceToNow: jest.fn(),   // Mock this specific function
}));
jest.mock('date-fns/locale', () => ({
  ptBR: jest.fn(), // Mock locale object if needed, or keep actual
}));

// Mock data
const mockJob = {
  id: 'job123',
  title: 'Software Engineer',
  description: '<p>Job Description</p>',
  location: 'Remote - Brazil',
  country: 'Brazil',
  createdAt: new Date('2024-01-10T10:00:00Z').toISOString(),
  publishedAt: new Date('2024-01-15T12:00:00Z').toISOString(),
  jobType: 'FULL_TIME',
  experienceLevel: 'SENIOR',
  workplaceType: 'REMOTE',
  requirements: '<p>Requirements</p>',
  company: {
    id: 'comp456',
    name: 'Tech Corp',
    logo: 'https://example.com/logo.png',
    websiteUrl: 'https://example.com'
  },
  applicationUrl: 'https://example.com/apply',
};

describe('Job Detail Page', () => {
  let mockRouterPush: jest.Mock;
  let mockTrackClick: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouterPush = jest.fn();
    mockTrackClick = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ push: mockRouterPush, isFallback: false });
    (useTrackJobClick as jest.Mock).mockReturnValue({ trackClick: mockTrackClick });
    (formatDistanceToNow as jest.Mock).mockReturnValue('há 5 dias'); // Default mock return
  });

  // --- Component Rendering Tests ---

  it('renders job details correctly with full data', () => {
    render(<JobDetailPage job={mockJob} error={null} />);

    expect(screen.getByRole('heading', { name: /Software Engineer/i })).toBeInTheDocument();
    expect(screen.getByText(/Tech Corp/i)).toBeInTheDocument();
    expect(screen.getByText(/Remote - Brazil/i)).toBeInTheDocument();
    expect(screen.getByText(/Tempo Integral/i)).toBeInTheDocument();
    expect(screen.getByText(/Sênior/i)).toBeInTheDocument();
    expect(screen.getByText(/Publicada há 5 dias/i)).toBeInTheDocument();
    expect(screen.getByText(/Job Description/i)).toBeInTheDocument();
    expect(screen.getByText(/Requirements/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Candidatar-se agora/i })).toBeInTheDocument();
  });

  it('renders fallback when company name is missing', () => {
    const jobWithoutCompany = { ...mockJob, company: { ...mockJob.company, name: null } };
    render(<JobDetailPage job={jobWithoutCompany} error={null} />);
    expect(screen.getByText('Empresa não informada')).toBeInTheDocument();
  });

  it('renders fallback when location is missing', () => {
    const jobWithoutLocation = { ...mockJob, location: null };
    render(<JobDetailPage job={jobWithoutLocation} error={null} />);
    expect(screen.getByText('Localização não informada')).toBeInTheDocument();
  });

  it('renders fallback for date when publishedAt and createdAt are invalid/missing', () => {
    (formatDistanceToNow as jest.Mock).mockImplementation(() => {
      // Simulate the internal logic's fallback
      return 'há tempo indeterminado';
    });
    const jobWithoutDates = { ...mockJob, publishedAt: null, createdAt: 'invalid-date' };
    render(<JobDetailPage job={jobWithoutDates} error={null} />);
    expect(screen.getByText(/Publicada há tempo indeterminado/i)).toBeInTheDocument();
  });

  it('displays error message when getServerSideProps returns an error', () => {
    render(<JobDetailPage job={null} error="Failed to fetch job data." />);
    expect(screen.getByText(/Failed to fetch job data./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Voltar para vagas/i })).toBeInTheDocument();
  });

  it('displays not found message when job is null', () => {
    render(<JobDetailPage job={null} error={null} />);
    expect(screen.getByText(/Vaga não encontrada/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Voltar para vagas/i })).toBeInTheDocument();
  });

  // --- Interaction Tests ---
  it('calls trackClick and opens link when apply button is clicked', async () => {
    render(<JobDetailPage job={mockJob} error={null} />);
    const applyButton = screen.getByRole('button', { name: /Candidatar-se agora/i });

    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(mockTrackClick).toHaveBeenCalledWith(mockJob.id, mockJob.applicationUrl, false);
    });
  });

  // --- getServerSideProps Tests ---

  // Add tests for getServerSideProps later if needed, focusing on component logic first.
}); 