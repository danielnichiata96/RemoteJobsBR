import { renderHook, act } from '@testing-library/react';
import { useTrackJobClick } from '@/hooks/useTrackJobClick';

// Mock fetch globally
global.fetch = jest.fn();

// Mock window methods
const mockWindowOpen = jest.fn();
const mockAlert = jest.fn();
let mockLocationHref = '';

// Store original window properties to restore later if needed
const originalWindowOpen = window.open;
const originalWindowAlert = window.alert;
const originalWindowLocation = window.location;

Object.defineProperty(window, 'open', { value: mockWindowOpen, writable: true });
Object.defineProperty(window, 'alert', { value: mockAlert, writable: true });
Object.defineProperty(window, 'location', {
  value: {
    ...originalWindowLocation, // Keep other properties like assign, reload etc.
    get href() {
      return mockLocationHref;
    },
    set href(val: string) {
      mockLocationHref = val;
      // console.log(`window.location.href set to: ${val}`); // Optional: for debugging tests
    },
  },
  writable: true, // Allow redefining/restoring later
});

describe('useTrackJobClick', () => {
  beforeEach(() => {
    // Reset mocks before each test
    (global.fetch as jest.Mock).mockClear();
    mockWindowOpen.mockClear();
    mockAlert.mockClear();
    mockLocationHref = ''; // Reset mock href

    // Default fetch mock to success
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Success' }), // Mock json if needed
    });
  });

  // Optional: Restore original window functions after all tests if necessary
  // afterAll(() => {
  //   Object.defineProperty(window, 'open', { value: originalWindowOpen });
  //   Object.defineProperty(window, 'alert', { value: originalWindowAlert });
  //   Object.defineProperty(window, 'location', { value: originalWindowLocation });
  // });

  it('should track click and open target URL in new tab', async () => {
    const { result } = renderHook(() => useTrackJobClick());
    const jobId = 'job123';
    const targetUrl = 'https://example.com/apply';

    let hookResult: boolean | undefined;
    await act(async () => {
      hookResult = await result.current.trackClick(jobId, targetUrl);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(`/api/jobs/${jobId}/track-click`, {
      method: 'POST',
    });
    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    expect(mockWindowOpen).toHaveBeenCalledWith(targetUrl, '_blank', 'noopener,noreferrer');
    expect(mockLocationHref).toBe(''); // href should not be set
    expect(mockAlert).not.toHaveBeenCalled();
    expect(hookResult).toBe(true);
  });

  it('should track click and navigate to mailto URL', async () => {
    const { result } = renderHook(() => useTrackJobClick());
    const jobId = 'job456';
    const targetUrl = 'mailto:test@example.com?subject=Apply';

    let hookResult: boolean | undefined;
    await act(async () => {
      hookResult = await result.current.trackClick(jobId, targetUrl, true);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(`/api/jobs/${jobId}/track-click`, {
      method: 'POST',
    });
    expect(mockWindowOpen).not.toHaveBeenCalled();
    expect(mockLocationHref).toBe(targetUrl);
    expect(mockAlert).not.toHaveBeenCalled();
    expect(hookResult).toBe(true);
  });

  it('should extract internal ID when jobId is prefixed', async () => {
    const { result } = renderHook(() => useTrackJobClick());
    const prefixedJobId = 'gh_job789';
    const internalId = 'job789';
    const targetUrl = 'https://anothersite.com';

    let hookResult: boolean | undefined;
    await act(async () => {
      hookResult = await result.current.trackClick(prefixedJobId, targetUrl);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(`/api/jobs/${internalId}/track-click`, { // Check internal ID is used
      method: 'POST',
    });
    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    expect(mockWindowOpen).toHaveBeenCalledWith(targetUrl, '_blank', 'noopener,noreferrer');
    expect(hookResult).toBe(true);
  });

  it('should still open URL even if fetch fails with non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });
    const { result } = renderHook(() => useTrackJobClick());
    const jobId = 'jobFailApi';
    const targetUrl = 'https://fail.com';

    let hookResult: boolean | undefined;
    await act(async () => {
      hookResult = await result.current.trackClick(jobId, targetUrl);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    expect(mockWindowOpen).toHaveBeenCalledWith(targetUrl, '_blank', 'noopener,noreferrer');
    expect(mockAlert).not.toHaveBeenCalled(); // Should not alert on API error
    expect(hookResult).toBe(true); // Hook indicates success as link was opened
  });

  it('should still open URL even if fetch throws network error', async () => {
    const networkError = new Error('Network failure');
    (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);
    const { result } = renderHook(() => useTrackJobClick());
    const jobId = 'jobFailNetwork';
    const targetUrl = 'https://network-error.com';

    let hookResult: boolean | undefined;
    await act(async () => {
      hookResult = await result.current.trackClick(jobId, targetUrl);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    expect(mockWindowOpen).toHaveBeenCalledWith(targetUrl, '_blank', 'noopener,noreferrer');
    expect(mockAlert).not.toHaveBeenCalled();
    expect(hookResult).toBe(false); // Hook indicates failure as tracking failed
  });

  it('should show alert and return false if jobId is invalid (undefined)', async () => {
    const { result } = renderHook(() => useTrackJobClick());
    const targetUrl = 'https://valid-url.com';

    let hookResult: boolean | undefined;
    await act(async () => {
      hookResult = await result.current.trackClick(undefined, targetUrl);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockWindowOpen).not.toHaveBeenCalled();
    expect(mockLocationHref).toBe('');
    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockAlert).toHaveBeenCalledWith('Não foi possível rastrear o clique ou URL de aplicação inválida.');
    expect(hookResult).toBe(false);
  });

  it('should show alert and return false if jobId is invalid (empty string)', async () => {
    const { result } = renderHook(() => useTrackJobClick());
    const targetUrl = 'https://valid-url.com';

    let hookResult: boolean | undefined;
    await act(async () => {
      hookResult = await result.current.trackClick('', targetUrl);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockWindowOpen).not.toHaveBeenCalled();
    expect(mockLocationHref).toBe('');
    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockAlert).toHaveBeenCalledWith('Não foi possível rastrear o clique ou URL de aplicação inválida.');
    expect(hookResult).toBe(false);
  });

  it('should show alert and return false if targetUrl is invalid (null)', async () => {
    const { result } = renderHook(() => useTrackJobClick());
    const jobId = 'jobValidId';

    let hookResult: boolean | undefined;
    await act(async () => {
      hookResult = await result.current.trackClick(jobId, null);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockWindowOpen).not.toHaveBeenCalled();
    expect(mockLocationHref).toBe('');
    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockAlert).toHaveBeenCalledWith('Não foi possível rastrear o clique ou URL de aplicação inválida.');
    expect(hookResult).toBe(false);
  });

  it('should show alert and return false if targetUrl is invalid (undefined)', async () => {
    const { result } = renderHook(() => useTrackJobClick());
    const jobId = 'jobValidId';

    let hookResult: boolean | undefined;
    await act(async () => {
      hookResult = await result.current.trackClick(jobId, undefined);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockWindowOpen).not.toHaveBeenCalled();
    expect(mockLocationHref).toBe('');
    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockAlert).toHaveBeenCalledWith('Não foi possível rastrear o clique ou URL de aplicação inválida.');
    expect(hookResult).toBe(false);
  });
}); 