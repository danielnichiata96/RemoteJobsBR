import { createMocks, MockResponse, MockRequest } from 'node-mocks-http';
import { getServerSession } from 'next-auth/next';
import { prisma } from '../../../../../../src/lib/prisma'; // Adjusted path
import { UserRole, JobSource } from '@prisma/client';
import { JobProcessingService } from '../../../../../../src/lib/services/jobProcessingService'; // Import the actual service
import handler from '@/pages/api/admin/sources/[sourceId]/rerun';

// --- Mocks ---

// Mock the JobProcessingService directly
const mockProcessJobSourceById = jest.fn();
jest.mock('@/lib/services/jobProcessingService', () => { // Use path alias
  // Mock the constructor
  return {
    JobProcessingService: jest.fn().mockImplementation(() => {
      // The constructor returns an instance with the mocked method
      return {
        processJobSourceById: mockProcessJobSourceById,
      };
    }),
  };
});

// Mock Prisma
jest.mock('@/lib/prisma', () => ({ // Use path alias
  prisma: {
    jobSource: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock NextAuth getServerSession
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

// Mock the default export of next-auth
jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Mock pino logger
jest.mock('pino', () => jest.fn(() => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  child: jest.fn().mockReturnThis(),
})));

// Type helpers for mocks
const mockGetServerSession = getServerSession as jest.Mock;
const mockPrismaJobSourceFindUnique = prisma.jobSource.findUnique as jest.Mock;

// Type for HTTP mocks
type ApiRequest = MockRequest<any> & { query: { sourceId?: string } };
type ApiResponse = MockResponse<any>;

// --- Test Suite ---

describe('/api/admin/sources/[sourceId]/rerun API Route', () => {
    const testSourceId = 'test-rerun-source-id';
    const adminSession = {
        user: { id: 'admin-1', role: UserRole.ADMIN },
        expires: 'some-date',
    };
    const candidateSession = {
        user: { id: 'candidate-1', role: UserRole.CANDIDATE },
        expires: 'some-date',
    };

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
        // IMPORTANT: Also clear the mock implementation details if necessary
        // (Not strictly needed here as mockProcessJobSourceById is cleared by clearAllMocks)
        // mockProcessJobSourceById.mockClear(); 
        // Ensure the constructor mock is also cleared if it holds state (it doesn't here)
        // (JobProcessingService as jest.Mock).mockClear(); 
    });

    it('should return 405 if method is not POST', async () => {
        const { req, res } = createMocks<ApiRequest, ApiResponse>({
            method: 'GET',
            query: { sourceId: testSourceId },
        });

        await handler(req, res);

        expect(res._getStatusCode()).toBe(405);
        expect(res._getHeaders()).toEqual(expect.objectContaining({ allow: ['POST'] }));
        expect(JSON.parse(res._getData())).toEqual({ message: 'Method GET Not Allowed' });
    });

    it('should return 400 if sourceId is missing', async () => {
        const { req, res } = createMocks<ApiRequest, ApiResponse>({
            method: 'POST',
            query: {}, // No sourceId
        });
        (getServerSession as jest.Mock).mockResolvedValue(adminSession); // Assume admin is logged in

        await handler(req, res);

        expect(res._getStatusCode()).toBe(400);
        expect(JSON.parse(res._getData())).toEqual({ message: 'Bad Request: Missing sourceId' });
    });

    it('should return 403 if user is not authenticated', async () => {
        (getServerSession as jest.Mock).mockResolvedValue(null); // No session
        const { req, res } = createMocks<ApiRequest, ApiResponse>({
            method: 'POST',
            query: { sourceId: testSourceId },
        });

        await handler(req, res);

        expect(res._getStatusCode()).toBe(403);
        expect(JSON.parse(res._getData())).toEqual({ message: 'Forbidden: Access denied' });
    });

    it('should return 403 if user is not an ADMIN', async () => {
        (getServerSession as jest.Mock).mockResolvedValue(candidateSession); // Non-admin user
        const { req, res } = createMocks<ApiRequest, ApiResponse>({
            method: 'POST',
            query: { sourceId: testSourceId },
        });

        await handler(req, res);

        expect(res._getStatusCode()).toBe(403);
        expect(JSON.parse(res._getData())).toEqual({ message: 'Forbidden: Access denied' });
    });

    it('should return 404 if job source is not found', async () => {
        (getServerSession as jest.Mock).mockResolvedValue(adminSession);
        (prisma.jobSource.findUnique as jest.Mock).mockResolvedValue(null); // Simulate not found
        const { req, res } = createMocks<ApiRequest, ApiResponse>({
            method: 'POST',
            query: { sourceId: testSourceId },
        });

        await handler(req, res);

        expect(prisma.jobSource.findUnique).toHaveBeenCalledWith({ where: { id: testSourceId } });
        expect(res._getStatusCode()).toBe(404);
        expect(JSON.parse(res._getData())).toEqual({ message: 'Job source not found' });
    });

    it('should return 500 if database find operation fails', async () => {
        (getServerSession as jest.Mock).mockResolvedValue(adminSession);
        (prisma.jobSource.findUnique as jest.Mock).mockRejectedValue(new Error('DB Find Error')); // Simulate DB error
        const { req, res } = createMocks<ApiRequest, ApiResponse>({
            method: 'POST',
            query: { sourceId: testSourceId },
        });

        await handler(req, res);

        expect(res._getStatusCode()).toBe(500);
        expect(JSON.parse(res._getData())).toEqual({ message: 'Internal Server Error' });
    });

    it('should return 400 if the job source is disabled', async () => {
        const mockSource: JobSource = {
            id: testSourceId,
            name: 'Disabled Source',
            type: 'greenhouse',
            isEnabled: false,
            lastFetched: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            companyWebsite: null,
            logoUrl: null,
            config: {}
        };
        (getServerSession as jest.Mock).mockResolvedValue(adminSession);
        (prisma.jobSource.findUnique as jest.Mock).mockResolvedValue(mockSource);
        const { req, res } = createMocks<ApiRequest, ApiResponse>({
            method: 'POST',
            query: { sourceId: testSourceId },
        });

        await handler(req, res);

        expect(prisma.jobSource.findUnique).toHaveBeenCalledWith({ where: { id: testSourceId } });
        expect(mockProcessJobSourceById).not.toHaveBeenCalled(); 
        expect(res._getStatusCode()).toBe(400);
        expect(JSON.parse(res._getData())).toEqual({ message: 'Cannot re-run a disabled job source' });
    });

    it('should return 500 if triggering the job processing fails (mock rejects)', async () => {
        const mockSource: JobSource = {
            id: testSourceId,
            name: 'Enabled Source',
            type: 'greenhouse',
            isEnabled: true,
            lastFetched: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            companyWebsite: null,
            logoUrl: null,
            config: {}
        };
        mockGetServerSession.mockResolvedValue(adminSession);
        mockPrismaJobSourceFindUnique.mockResolvedValue(mockSource);

        // Configure the mock method to reject
        const processingError = new Error('Processing Error');
        mockProcessJobSourceById.mockRejectedValue(processingError);

        const { req, res } = createMocks<ApiRequest, ApiResponse>({
            method: 'POST',
            query: { sourceId: testSourceId },
        });

        await handler(req, res); // Call the handler

        // API responds 200 immediately
        expect(res._getStatusCode()).toBe(200);
        expect(JSON.parse(res._getData())).toEqual({ message: `Re-run triggered for source ${testSourceId}` });

        // Allow async operations initiated by the handler to complete
        await new Promise(process.nextTick);

        // Check that the service method was called
        expect(JobProcessingService).toHaveBeenCalledTimes(1); // Constructor called
        expect(mockProcessJobSourceById).toHaveBeenCalledTimes(1);
        expect(mockProcessJobSourceById).toHaveBeenCalledWith(testSourceId);
        
        // We can't easily check the internal .catch() logging, but 
        // we know the mock was called and it rejected.
    });

    it('should successfully trigger the re-run for an enabled source (mock resolves)', async () => {
        const mockSource: JobSource = {
            id: testSourceId,
            name: 'Enabled Source',
            type: 'greenhouse',
            isEnabled: true,
            lastFetched: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            companyWebsite: null,
            logoUrl: null,
            config: {}
        };
        mockGetServerSession.mockResolvedValue(adminSession);
        mockPrismaJobSourceFindUnique.mockResolvedValue(mockSource);

        // Configure the mock method to resolve
        mockProcessJobSourceById.mockResolvedValue(undefined);

        const { req, res } = createMocks<ApiRequest, ApiResponse>({
            method: 'POST',
            query: { sourceId: testSourceId },
        });

        await handler(req, res);

        expect(prisma.jobSource.findUnique).toHaveBeenCalledWith({ where: { id: testSourceId } });
        expect(res._getStatusCode()).toBe(200);
        expect(JSON.parse(res._getData())).toEqual({ message: `Re-run triggered for source ${testSourceId}` });

        // Allow async operations to complete
        await new Promise(process.nextTick);

        // Check that the service method was called
        expect(JobProcessingService).toHaveBeenCalledTimes(1); // Constructor called
        expect(mockProcessJobSourceById).toHaveBeenCalledTimes(1);
        expect(mockProcessJobSourceById).toHaveBeenCalledWith(testSourceId);
    });
}); 