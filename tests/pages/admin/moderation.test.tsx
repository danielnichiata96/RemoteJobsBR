import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import useSWR, { mutate } from 'swr';
import ModerationPage from '../../../src/pages/admin/moderation'; // Corrected path
import { JobStatus } from '@prisma/client';

// --- Mocks --- 

// Mock SWR
jest.mock('swr', () => ({
  __esModule: true, // Needed for ES Module mocking
  default: jest.fn(),
  mutate: jest.fn(),
}));

// Mock pino logger
jest.mock('pino', () => jest.fn(() => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
})));

// Mock fetch API globally
global.fetch = jest.fn();

// Mock window.alert (as it's used for error feedback)
global.alert = jest.fn();

// --- Helper Data --- 
const mockPendingJobs = [
  {
    id: 'job-uuid-1',
    title: 'Software Engineer',
    source: 'Greenhouse',
    sourceId: 'gh123',
    status: JobStatus.PENDING_REVIEW,
    assessmentStatus: 'PENDING',
    createdAt: new Date('2023-10-26T10:00:00.000Z'),
    updatedAt: new Date('2023-10-27T11:00:00.000Z'),
    company: { name: 'Tech Corp', logo: 'techcorp.png' },
    // Add other required Job fields with default/mock values
    description: '',
    url: '',
    location: '',
    normalizedLocation: '',
    normalizedTitle: '',
    relevanceScore: null,
    companyId: 'comp-uuid-1'
  },
  {
    id: 'job-uuid-2',
    title: 'Product Manager',
    source: 'Lever',
    sourceId: 'lv456',
    status: JobStatus.PENDING_REVIEW,
    assessmentStatus: 'PENDING',
    createdAt: new Date('2023-10-25T09:00:00.000Z'),
    updatedAt: new Date('2023-10-28T12:00:00.000Z'),
    company: { name: 'Innovate Ltd', logo: null },
    description: '',
    url: '',
    location: '',
    normalizedLocation: '',
    normalizedTitle: '',
    relevanceScore: null,
    companyId: 'comp-uuid-2'
  },
];


describe('<ModerationPage />', () => {
  const useSWRMock = useSWR as jest.Mock;
  const mutateMock = mutate as jest.Mock;
  const fetchMock = global.fetch as jest.Mock;

  beforeEach(() => {
    // Reset mocks before each test
    useSWRMock.mockReset();
    mutateMock.mockReset();
    fetchMock.mockReset();
    (global.alert as jest.Mock).mockClear();
  });

  it('renders loading state initially', () => {
    useSWRMock.mockReturnValue({ data: undefined, error: undefined, isLoading: true });
    render(<ModerationPage />);
    expect(screen.getByText(/Loading pending jobs.../i)).toBeInTheDocument();
  });

  it('renders error state', () => {
    const errorMessage = 'Failed to fetch';
    useSWRMock.mockReturnValue({ data: undefined, error: new Error(errorMessage), isLoading: false });
    render(<ModerationPage />);
    expect(screen.getByText(`Error loading jobs: ${errorMessage}`)).toBeInTheDocument();
  });

  it('renders "no jobs pending" message when data is empty', () => {
    useSWRMock.mockReturnValue({ data: { jobs: [] }, error: undefined, isLoading: false });
    render(<ModerationPage />);
    expect(screen.getByText(/No jobs currently pending review./i)).toBeInTheDocument();
  });

  it('renders table with pending jobs', () => {
    useSWRMock.mockReturnValue({ data: { jobs: mockPendingJobs }, error: undefined, isLoading: false });
    render(<ModerationPage />);

    // Check for table headers
    expect(screen.getByRole('columnheader', { name: /Company/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Job Title/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Source/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Last Updated/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Actions/i })).toBeInTheDocument();

    // Check for job data
    expect(screen.getByText('Tech Corp')).toBeInTheDocument();
    expect(screen.getByAltText('Tech Corp logo')).toBeInTheDocument();
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
    expect(screen.getByText(/ID: gh123/i)).toBeInTheDocument(); // Check for sourceId
    expect(screen.getByText('Greenhouse')).toBeInTheDocument();
    expect(screen.getByText(new Date(mockPendingJobs[0].updatedAt).toLocaleDateString())).toBeInTheDocument();

    expect(screen.getByText('Innovate Ltd')).toBeInTheDocument();
    expect(screen.queryByAltText('Innovate Ltd logo')).not.toBeInTheDocument(); // Check logo is absent
    expect(screen.getByText('Product Manager')).toBeInTheDocument();
    expect(screen.getByText(/ID: lv456/i)).toBeInTheDocument();
    expect(screen.getByText('Lever')).toBeInTheDocument();
    expect(screen.getByText(new Date(mockPendingJobs[1].updatedAt).toLocaleDateString())).toBeInTheDocument();

    // Check for action buttons (associated with each row)
    const approveButtons = screen.getAllByRole('button', { name: /Approve/i });
    const rejectButtons = screen.getAllByRole('button', { name: /Reject/i });
    expect(approveButtons).toHaveLength(mockPendingJobs.length);
    expect(rejectButtons).toHaveLength(mockPendingJobs.length);
  });

  it('calls moderate API and mutates SWR cache on Approve click', async () => {
    useSWRMock.mockReturnValue({ data: { jobs: [mockPendingJobs[0]] }, error: undefined, isLoading: false });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Success' }) });

    render(<ModerationPage />);

    const approveButton = screen.getByRole('button', { name: /Approve/i });
    fireEvent.click(approveButton);

    // Wait for fetch to be called
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/jobs/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: mockPendingJobs[0].id, action: 'APPROVE' }),
    });

    // Check if SWR mutate was called to refresh data
    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith('/api/admin/jobs/pending');
    expect(global.alert).not.toHaveBeenCalled(); // No alert on success
  });

  it('calls moderate API and mutates SWR cache on Reject click', async () => {
    useSWRMock.mockReturnValue({ data: { jobs: [mockPendingJobs[1]] }, error: undefined, isLoading: false });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Success' }) });

    render(<ModerationPage />);

    const rejectButton = screen.getByRole('button', { name: /Reject/i });
    fireEvent.click(rejectButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/jobs/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: mockPendingJobs[1].id, action: 'REJECT' }),
    });

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith('/api/admin/jobs/pending');
    expect(global.alert).not.toHaveBeenCalled();
  });

  it('shows alert on API error during moderation', async () => {
    useSWRMock.mockReturnValue({ data: { jobs: [mockPendingJobs[0]] }, error: undefined, isLoading: false });
    const errorMsg = 'Something went wrong';
    fetchMock.mockResolvedValueOnce({ 
      ok: false, 
      status: 500, 
      json: async () => ({ message: errorMsg })
    });

    render(<ModerationPage />);

    const approveButton = screen.getByRole('button', { name: /Approve/i });
    fireEvent.click(approveButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Check if alert was shown with the error message
    await waitFor(() => expect(global.alert).toHaveBeenCalledTimes(1));
    expect(global.alert).toHaveBeenCalledWith(expect.stringContaining(errorMsg));

    // Mutate should NOT have been called on error
    expect(mutateMock).not.toHaveBeenCalled();
  });

    it('shows alert on network error during moderation', async () => {
    useSWRMock.mockReturnValue({ data: { jobs: [mockPendingJobs[0]] }, error: undefined, isLoading: false });
    fetchMock.mockRejectedValueOnce(new Error('Network failed')); // Simulate network error

    render(<ModerationPage />);

    const approveButton = screen.getByRole('button', { name: /Approve/i });
    fireEvent.click(approveButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await waitFor(() => expect(global.alert).toHaveBeenCalledTimes(1));
    expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('An error occurred'));
    expect(mutateMock).not.toHaveBeenCalled();
  });

}); 