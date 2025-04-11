// tests/api/jobs/saved/[jobId].test.ts

// TODO: Test suite currently fails due to persistent ESM syntax errors.
// Jest/SWC struggles to parse nested ESM dependencies (like jose, @panva/hkdf, uuid, preact-render-to-string)
// pulled in by next-auth. Attempts to fix with transformIgnorePatterns and moduleNameMapper were unsuccessful.
// Needs further investigation into Jest/SWC configuration or alternative transformers.

import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/jobs/saved/[jobId]'; // Adjust path
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma'; // Adjust path

// Mock next-auth
jest.mock('next-auth/next');
const mockGetServerSession = getServerSession as jest.Mock;

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    job: {
      findUnique: jest.fn(),
    },
    savedJob: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const mockUserId = 'user-123';
const mockJobId = 'job-456';
const mockUser = { id: mockUserId, email: 'test@example.com' };
const mockJob = { id: mockJobId };
const mockSavedJobEntry = { id: 'saved-789', candidateId: mockUserId, jobId: mockJobId };

describe('/api/jobs/saved/[jobId]', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockGetServerSession.mockClear();
    (prisma.user.findUnique as jest.Mock).mockClear();
    (prisma.job.findUnique as jest.Mock).mockClear();
    (prisma.savedJob.findUnique as jest.Mock).mockClear();
    (prisma.savedJob.create as jest.Mock).mockClear();
    (prisma.savedJob.delete as jest.Mock).mockClear();
  });

  it('should return 401 if user is not authenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const { req, res } = createMocks({ method: 'POST', query: { jobId: mockJobId } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Não autorizado' });
  });

  it('should return 400 if jobId is missing', async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { email: mockUser.email } });
    const { req, res } = createMocks({ method: 'POST', query: {} }); // No jobId
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({ error: 'ID da vaga é obrigatório' });
  });

  it('should return 404 if user not found in DB', async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { email: mockUser.email } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
    const { req, res } = createMocks({ method: 'POST', query: { jobId: mockJobId } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(404);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Usuário não encontrado' });
  });

  // --- POST Tests ---
  it('POST: should save a job successfully if not already saved', async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { email: mockUser.email } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
    (prisma.job.findUnique as jest.Mock).mockResolvedValueOnce(mockJob);
    (prisma.savedJob.findUnique as jest.Mock).mockResolvedValueOnce(null); // Not saved yet
    (prisma.savedJob.create as jest.Mock).mockResolvedValueOnce(mockSavedJobEntry);

    const { req, res } = createMocks({ method: 'POST', query: { jobId: mockJobId } });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(201);
    expect(prisma.savedJob.create).toHaveBeenCalledWith({
      data: { candidateId: mockUserId, jobId: mockJobId },
    });
    expect(JSON.parse(res._getData())).toEqual({
      message: 'Vaga salva com sucesso',
      isSaved: true,
      savedJob: mockSavedJobEntry,
    });
  });

  it('POST: should return 200 if job is already saved', async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { email: mockUser.email } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
    (prisma.job.findUnique as jest.Mock).mockResolvedValueOnce(mockJob);
    (prisma.savedJob.findUnique as jest.Mock).mockResolvedValueOnce(mockSavedJobEntry); // Already saved

    const { req, res } = createMocks({ method: 'POST', query: { jobId: mockJobId } });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(prisma.savedJob.create).not.toHaveBeenCalled();
    expect(JSON.parse(res._getData())).toEqual({ message: 'Vaga já está salva', isSaved: true });
  });

  it('POST: should return 404 if job does not exist', async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { email: mockUser.email } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
    (prisma.job.findUnique as jest.Mock).mockResolvedValueOnce(null); // Job not found

    const { req, res } = createMocks({ method: 'POST', query: { jobId: mockJobId } });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(404);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Vaga não encontrada' });
  });

  // --- DELETE Tests ---
  it('DELETE: should unsave a job successfully if it exists', async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { email: mockUser.email } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
    (prisma.savedJob.findUnique as jest.Mock).mockResolvedValueOnce(mockSavedJobEntry); // Found saved job
    (prisma.savedJob.delete as jest.Mock).mockResolvedValueOnce({}); // Mock successful deletion

    const { req, res } = createMocks({ method: 'DELETE', query: { jobId: mockJobId } });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(prisma.savedJob.delete).toHaveBeenCalledWith({
      where: { candidateId_jobId: { candidateId: mockUserId, jobId: mockJobId } },
    });
    expect(JSON.parse(res._getData())).toEqual({
      message: 'Vaga removida dos salvos com sucesso',
      isSaved: false,
    });
  });

  it('DELETE: should return 404 if saved job not found', async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { email: mockUser.email } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
    (prisma.savedJob.findUnique as jest.Mock).mockResolvedValueOnce(null); // Not found

    const { req, res } = createMocks({ method: 'DELETE', query: { jobId: mockJobId } });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(404);
    expect(prisma.savedJob.delete).not.toHaveBeenCalled();
    expect(JSON.parse(res._getData())).toEqual({ error: 'Vaga salva não encontrada' });
  });

  // --- GET Tests ---
  it('GET: should return isSaved: true if job is saved', async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { email: mockUser.email } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
    (prisma.savedJob.findUnique as jest.Mock).mockResolvedValueOnce(mockSavedJobEntry);

    const { req, res } = createMocks({ method: 'GET', query: { jobId: mockJobId } });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ isSaved: true, savedJob: mockSavedJobEntry });
  });

  it('GET: should return isSaved: false if job is not saved', async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { email: mockUser.email } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
    (prisma.savedJob.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const { req, res } = createMocks({ method: 'GET', query: { jobId: mockJobId } });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ isSaved: false, savedJob: null });
  });

  // --- Other Methods ---
  it('should return 405 for unsupported methods', async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { email: mockUser.email } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
    const { req, res } = createMocks({ method: 'PUT', query: { jobId: mockJobId } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Método não permitido' });
  });

  // --- Error Handling ---
  it('should return 500 if prisma throws an unexpected error', async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { email: mockUser.email } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
    (prisma.savedJob.findUnique as jest.Mock).mockRejectedValueOnce(new Error('Database connection error'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { req, res } = createMocks({ method: 'GET', query: { jobId: mockJobId } });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Erro ao processar a operação de vaga salva' });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
}); 