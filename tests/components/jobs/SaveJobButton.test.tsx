import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionProvider, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import SaveJobButton from '@/components/jobs/SaveJobButton';

// Mock next-auth
jest.mock('next-auth/react');
const mockUseSession = useSession as jest.Mock;

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));
const mockUseRouter = useRouter as jest.Mock;
const mockPush = jest.fn();

// Mock fetch
global.fetch = jest.fn();

const mockJobId = 'job123';

// Helper to wrap component with SessionProvider
const renderWithSession = (ui: React.ReactElement, session: any) => {
  mockUseSession.mockReturnValue({ data: session, status: session ? 'authenticated' : 'unauthenticated' });
  mockUseRouter.mockReturnValue({ push: mockPush, asPath: '/some/path' });
  return render(<SessionProvider session={session}>{ui}</SessionProvider>);
};

describe('SaveJobButton', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    mockUseSession.mockClear();
    mockUseRouter.mockClear();
    mockPush.mockClear();
  });

  it('renders correctly when job is not saved (authenticated)', async () => {
    const session = { user: { id: 'user1' } };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ isSaved: false }),
    });
    renderWithSession(<SaveJobButton jobId={mockJobId} />, session);

    // Use findBy to wait for initial state
    expect(await screen.findByLabelText(/Salvar vaga/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Remover vaga dos salvos/i)).not.toBeInTheDocument();
  });

  it('renders correctly when job is saved (authenticated)', async () => {
    const session = { user: { id: 'user1' } };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ isSaved: true }),
    });
    renderWithSession(<SaveJobButton jobId={mockJobId} />, session);

    // Use findBy to wait for initial state
    expect(await screen.findByLabelText(/Remover vaga dos salvos/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Salvar vaga/i)).not.toBeInTheDocument();
  });

  it('renders icon only when showText is false', async () => {
    const session = { user: { id: 'user1' } };
     (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ isSaved: false }),
    });
    renderWithSession(<SaveJobButton jobId={mockJobId} showText={false} />, session);

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());

    // Check for icon presence (assuming HiOutlineHeart/HiHeart are used)
    // Use data-testid or specific SVG checks if possible
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.queryByText(/Salvar Vaga/i)).not.toBeInTheDocument();
  });

  it('calls fetch with POST to save job when clicked and not saved', async () => {
    const session = { user: { id: 'user1' } };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ isSaved: false }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    renderWithSession(<SaveJobButton jobId={mockJobId} />, session);
    
    // Find initial button
    const saveButton = await screen.findByLabelText(/Salvar vaga/i);
    fireEvent.click(saveButton);

    // Wait for the fetch call to resolve and state to potentially update
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    // Wait for the DOM to reflect the change
    await waitFor(() => {
      expect(screen.queryByLabelText(/Salvar vaga/i)).not.toBeInTheDocument();
    });
    expect(await screen.findByLabelText(/Remover vaga dos salvos/i)).toBeInTheDocument();
  });

  it('calls fetch with DELETE to unsave job when clicked and saved', async () => {
    const session = { user: { id: 'user1' } };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ isSaved: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    renderWithSession(<SaveJobButton jobId={mockJobId} />, session);
    
    // Find initial button
    const savedButton = await screen.findByLabelText(/Remover vaga dos salvos/i);
    fireEvent.click(savedButton);

    // Wait for the fetch call to resolve and state to potentially update
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    // Wait for the DOM to reflect the change
    await waitFor(() => {
      expect(screen.queryByLabelText(/Remover vaga dos salvos/i)).not.toBeInTheDocument();
    });
    expect(await screen.findByLabelText(/Salvar vaga/i)).toBeInTheDocument();
  });

  it('redirects to login if user is not authenticated when clicking save', async () => {
    // Initial state: unauthenticated
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    mockUseRouter.mockReturnValue({ push: mockPush, asPath: '/some/job/path' });

    // Render without session initially (or pass null)
    render(<SaveJobButton jobId={mockJobId} />); 
    
    // Wait for initial loading/check to finish (fetch shouldn't be called)
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(global.fetch).not.toHaveBeenCalled();

    const saveButton = screen.getByLabelText(/Salvar vaga/i);
    fireEvent.click(saveButton);

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/login?returnTo=/some/job/path');
  });

  it('handles fetch error when checking saved status', async () => {
    const session = { user: { id: 'user1' } };
    const errorToCheck = new Error('Network Error');
    (global.fetch as jest.Mock).mockRejectedValueOnce(errorToCheck);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    renderWithSession(<SaveJobButton jobId={mockJobId} />, session);

    // Wait for initial check to fail
    // Use findByLabelText to ensure button is rendered after loading state
    const button = await screen.findByLabelText(/Salvar vaga/i);
    expect(button).toBeInTheDocument();
    
    // Error should have been logged
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error checking saved status:', errorToCheck);

    consoleErrorSpy.mockRestore();
  });

  it('handles fetch error when toggling save status', async () => {
    const session = { user: { id: 'user1' } };
    const errorToThrow = new Error('Failed to save');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ isSaved: false }) })
      .mockRejectedValueOnce(errorToThrow);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    renderWithSession(<SaveJobButton jobId={mockJobId} />, session);
    
    // Find initial button and ensure it's rendered 
    const saveButton = await screen.findByLabelText(/Salvar vaga/i);
    
    // Add a small wait to ensure button is interactable
    await waitFor(() => expect(saveButton).not.toBeDisabled());
    
    // Log disabled state right before click for debugging
    console.log('Button disabled state before click:', saveButton.disabled);

    // Click and expect error
    fireEvent.click(saveButton);

    // Wait for the second fetch call (the toggle) to have happened
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2)); 

    // Button state should NOT have changed
    expect(screen.getByLabelText(/Salvar vaga/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Remover vaga dos salvos/i)).not.toBeInTheDocument();
    
    // Error should have been logged
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error toggling saved status:', errorToThrow);

    consoleErrorSpy.mockRestore();
  });
}); 