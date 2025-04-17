import { NextPage } from 'next';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { JobSource, UserRole, JobSourceRunStats } from '@prisma/client'; // Import RunStats
import pino from 'pino';
import { formatDistanceToNow } from 'date-fns'; // Import date-fns function
import { ptBR } from 'date-fns/locale'; // Optional: Import locale for formatting
import { toast } from 'react-toastify'; // Assuming react-toastify is installed
// Import a toast library if you have one, e.g.:
// import { toast } from 'react-toastify';

const logger = pino({ browser: { asObject: true } });

// Simple type for expected config structures
type SourceConfig = {
    boardToken?: string;
    jobBoardName?: string;
};

// Define a type for the API response data
// Selecting specific fields + adding potential calculated fields later
type SourceHealthData = Pick<
    JobSource,
    'id' | 'name' | 'type' | 'isEnabled' | 'lastFetched' | 'companyWebsite' | 'config' // Include config for getConfigSourceValue
> & {
    healthStatus: string;
    latestRun: JobSourceRunStats | null;
};

// Fetcher function for SWR
const fetcher = async (url: string): Promise<SourceHealthData[]> => {
    const res = await fetch(url);
    if (!res.ok) {
        const error = new Error('An error occurred while fetching the data.') as any;
        // Attach extra info to the error object.
        try {
            error.info = await res.json();
        }
        catch (e) { /* Ignore if response is not JSON */ }
        error.status = res.status;
        throw error;
    }
    return res.json();
};

// Helper component for the health status indicator dot
const HealthIndicator = ({ status }: { status: string }) => {
    let bgColor = 'bg-gray-300'; // Default: Unknown
    let title = 'Health Unknown';

    switch (status) {
        case 'Healthy':
            bgColor = 'bg-green-500';
            title = 'Healthy';
            break;
        case 'Warning':
            bgColor = 'bg-yellow-400';
            title = 'Warning';
            break;
        case 'Error':
            bgColor = 'bg-red-500';
            title = 'Error';
            break;
    }

    return (
        <span className={`h-3 w-3 ${bgColor} rounded-full inline-block`} title={title}></span>
    );
};

const AdminSourceHealth: NextPage = (props) => { // Removed unused props
    const { data: session, status } = useSession();
    const router = useRouter();
    const [isLoadingPage, setIsLoadingPage] = useState(true);
    // State to track loading status for each toggle button
    const [isToggling, setIsToggling] = useState<{ [key: string]: boolean }>({});
    // State to track loading status for each re-run button
    const [isReRunning, setIsReRunning] = useState<{ [key: string]: boolean }>({});

    const SWR_KEY = status === 'authenticated' && session?.user?.role === UserRole.ADMIN ? '/api/admin/sources/health' : null;

    // Fetch data using SWR
    const { data: sources, error: fetchError, mutate } = useSWR<SourceHealthData[]>(
        SWR_KEY,
        fetcher,
        { refreshInterval: 30000 } // Optional: Auto-refresh data every 30 seconds
    );

    // --- Toggle Enable/Disable Handler ---
    const handleToggleEnable = async (sourceId: string, currentState: boolean) => {
        setIsToggling(prev => ({ ...prev, [sourceId]: true }));
        logger.info({ sourceId, currentState }, 'Attempting to toggle source status...');

        try {
            const res = await fetch(`/api/admin/sources/${sourceId}/toggle`, {
                method: 'PATCH',
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const errorMsg = errorData.message || `Failed to toggle status (${res.status})`;
                throw new Error(errorMsg);
            }

            // Don't use optimistic update for toggle, rely on mutate
            await mutate(SWR_KEY); // Revalidate to get definitive state

            const newState = !currentState;
            logger.info({ sourceId, newState }, 'Source status toggled successfully.');
            toast.success(`Source ${newState ? 'enabled' : 'disabled'} successfully.`);

        } catch (error: any) {
            logger.error({ error, sourceId }, 'Error toggling source status');
            toast.error(`Error: ${error.message || 'Could not toggle source status.'}`);
            // Revalidate on error to ensure consistency
            await mutate(SWR_KEY);
        } finally {
            setIsToggling(prev => ({ ...prev, [sourceId]: false }));
        }
    };

    // --- Re-run Handler ---
    const handleReRun = async (sourceId: string) => {
        setIsReRunning(prev => ({ ...prev, [sourceId]: true }));
        logger.info({ sourceId }, 'Attempting to trigger source re-run...');

        try {
            const res = await fetch(`/api/admin/sources/${sourceId}/rerun`, {
                method: 'POST',
            });

            const responseData = await res.json(); // Always try to parse JSON

            if (!res.ok) {
                const errorMsg = responseData.message || `Failed to trigger re-run (${res.status})`;
                throw new Error(errorMsg);
            }

            logger.info({ sourceId }, responseData.message || 'Source re-run triggered successfully.');
            toast.success(responseData.message || `Re-run triggered for source ${sourceId}.`);

            // Optionally trigger a delayed refresh
            setTimeout(() => mutate(SWR_KEY), 5000); // Revalidate after 5s

        } catch (error: any) {
            logger.error({ error, sourceId }, 'Error triggering source re-run');
            toast.error(`Error: ${error.message || 'Could not trigger re-run.'}`);
        } finally {
            setIsReRunning(prev => ({ ...prev, [sourceId]: false }));
        }
    };

    useEffect(() => {
        if (status === 'loading') {
            return;
        }

        if (status === 'unauthenticated' || (status === 'authenticated' && session?.user?.role !== UserRole.ADMIN)) {
            logger.warn('Redirecting unauthorized user from admin page');
            router.push('/');
        } else {
            setIsLoadingPage(false);
        }
    }, [status, session]);

    // Handle different loading/error states
    if (isLoadingPage || status === 'loading') {
        return <div className="p-4 text-center">Loading session...</div>;
    }

    if (fetchError) {
        logger.error({ error: fetchError, status: fetchError.status, info: fetchError.info }, 'Error fetching source health data');
        return <div className="p-4 text-center text-red-600">Error loading source health: {fetchError.info?.message || fetchError.message}</div>;
    }

    if (!sources) {
        return <div className="p-4 text-center">Loading source health data...</div>;
    }

    // Helper to extract relevant config value
    const getConfigSourceValue = (source: Pick<JobSource, 'type' | 'config'>): string => {
        try {
            const config = (typeof source.config === 'object' && source.config !== null)
                           ? source.config as SourceConfig
                           : {} as SourceConfig;
            const sourceTypeLower = source.type?.toLowerCase();
            if (sourceTypeLower === 'greenhouse' && config?.boardToken) {
                return `Token: ${config.boardToken}`;
            } 
            return 'N/A';
        } catch (e) {
            return 'Invalid Config';
        }
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Job Source Health Dashboard</h1>

            {/* Optional: Add a general error display area here if needed */}

            {sources.length === 0 ? (
                <p>No job sources found.</p>
            ) : (
                <div className="overflow-x-auto shadow-md rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Health</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Run Status</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Run</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Website</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Config</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sources.map((source, index) => (
                                <tr key={source.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                                        <HealthIndicator status={source.healthStatus} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{source.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{source.type}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${source.isEnabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {source.isEnabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {source.latestRun?.status || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {source.latestRun?.runEndedAt
                                            ? formatDistanceToNow(new Date(source.latestRun.runEndedAt), { addSuffix: true, locale: ptBR })
                                            : (source.lastFetched ? `${formatDistanceToNow(new Date(source.lastFetched), { addSuffix: true, locale: ptBR })} (Fetch Only)`: 'Never')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {source.companyWebsite ? (
                                            <a href={source.companyWebsite} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900">
                                                Visit
                                            </a>
                                        ) : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono text-xs">{getConfigSourceValue(source)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center space-x-2">
                                        <button
                                            onClick={() => handleToggleEnable(source.id, source.isEnabled)}
                                            className={`px-3 py-1 text-xs font-semibold rounded-full ${source.isEnabled
                                                ? 'bg-red-100 text-red-800 hover:bg-red-200'
                                                : 'bg-green-100 text-green-800 hover:bg-green-200'}
                                                focus:outline-none focus:ring-2 focus:ring-offset-2 ${source.isEnabled ? 'focus:ring-red-500' : 'focus:ring-green-500'}
                                                disabled:opacity-50 disabled:cursor-not-allowed`
                                            }
                                            disabled={isToggling[source.id] || isReRunning[source.id]} // Disable if toggling or re-running
                                        >
                                            {isToggling[source.id] ? '...' : (source.isEnabled ? 'Disable' : 'Enable')}
                                        </button>
                                        <button
                                            onClick={() => handleReRun(source.id)}
                                            className={`px-3 py-1 text-xs font-semibold rounded-full 
                                                bg-blue-100 text-blue-800 hover:bg-blue-200
                                                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                                                disabled:opacity-50 disabled:cursor-not-allowed`
                                            }
                                            disabled={!source.isEnabled || isToggling[source.id] || isReRunning[source.id]} // Disable if source is disabled, or during any action
                                            title={!source.isEnabled ? "Source must be enabled to re-run" : "Trigger a new fetch for this source"}
                                        >
                                             {isReRunning[source.id] ? '...' : 'Re-run'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AdminSourceHealth;

// Optional: Add getServerSideProps for server-side protection if client-side is not enough
// export const getServerSideProps: GetServerSideProps = async (context) => {
//   const session = await getSession(context);
//   // @ts-ignore
//   if (!session || session.user?.role !== UserRole.ADMIN) {
//     return {
//       redirect: {
//         destination: '/', // Or login page
//         permanent: false,
//       },
//     };
//   }
//   return { props: { session } }; // Pass session if needed
// }; 