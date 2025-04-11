import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SessionProvider, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import SavedJobsPage from '@/pages/saved-jobs';
import WideJobCard from '@/components/jobs/WideJobCard'; // Need to mock this?

// Mock next-auth
jest.mock('next-auth/react');
const mockUseSession = useSession as jest.Mock;

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));
const mockUseRouter = useRouter as jest.Mock;
const mockReplace = jest.fn();
const mockPush = jest.fn();

// Mock fetch
global.fetch = jest.fn();

// Mock WideJobCard to simplify testing
jest.mock('@/components/jobs/WideJobCard', () => {
  return jest.fn(({ job }) => (
    <div data-testid={`job-card-${job.id}`}>
      <h3>{job.title}</h3>
      <p>{job.company.name}</p>
      {/* Simulate SaveJobButton interaction if needed, or assume it works */}
    </div>
  ));
});

const mockSavedJobs = [
  { id: 'job1', title: 'Saved Job 1', company: { name: 'Company A' }, isSaved: true },
  { id: 'job2', title: 'Saved Job 2', company: { name: 'Company B' }, isSaved: true },
];

// Helper to wrap component with SessionProvider
const renderWithSession = (ui: React.ReactElement, session: any, status: string = 'authenticated') => {
  mockUseSession.mockReturnValue({ data: session, status });
  mockUseRouter.mockReturnValue({ replace: mockReplace, push: mockPush });
  return render(<SessionProvider session={session}>{ui}</SessionProvider>);
};

describe('SavedJobsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('redirects to login if user is unauthenticated', () => {
    renderWithSession(<SavedJobsPage />, null, 'unauthenticated');
    expect(mockReplace).toHaveBeenCalledWith('/login?returnTo=/saved-jobs');
  });

  it('shows loading skeleton initially when authenticated', () => {
    const session = { user: { id: 'user1' } };
    // Don't resolve fetch immediately
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); 
    renderWithSession(<SavedJobsPage />, session);
    expect(screen.getByTestId('job-list-skeleton')).toBeInTheDocument(); // Assuming JobListSkeleton has this test id
  });

  it('fetches and displays saved jobs when authenticated', async () => {
    const session = { user: { id: 'user1' } };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSavedJobs,
    });

    renderWithSession(<SavedJobsPage />, session);

    await waitFor(() => {
      expect(screen.getByTestId('job-card-job1')).toBeInTheDocument();
      expect(screen.getByText('Saved Job 1')).toBeInTheDocument();
      expect(screen.getByText('Company A')).toBeInTheDocument();
      expect(screen.getByTestId('job-card-job2')).toBeInTheDocument();
      expect(screen.getByText('Saved Job 2')).toBeInTheDocument();
      expect(screen.getByText('Company B')).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/users/me/saved-jobs');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('displays empty state message when no jobs are saved', async () => {
    const session = { user: { id: 'user1' } };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [], // Empty array
    });

    renderWithSession(<SavedJobsPage />, session);

    await waitFor(() => {
      expect(screen.getByText(/Nenhuma vaga salva ainda/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Explorar Vagas/i })).toBeInTheDocument();
    });
  });

  it('displays error message when fetch fails', async () => {
    const session = { user: { id: 'user1' } };
    const errorMessage = 'Failed to load jobs';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      statusText: 'Server Error',
      json: async () => ({ message: errorMessage }),
    });
     // Mock console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    renderWithSession(<SavedJobsPage />, session);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('clicking "Explorar Vagas" button navigates to home', async () => {
    const session = { user: { id: 'user1' } };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    renderWithSession(<SavedJobsPage />, session);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Explorar Vagas/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Explorar Vagas/i }));
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  // Add tests for optimistic update if implemented more thoroughly (e.g., unsaving from this page)
}); 