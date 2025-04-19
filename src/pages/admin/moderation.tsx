import React from 'react';
import useSWR, { mutate } from 'swr';
import { Job, User } from '@prisma/client'; // Assuming Job and User types are available
// import AdminLayout from '../../components/layout/AdminLayout'; // Assuming an AdminLayout exists
import pino from 'pino';

const logger = pino({ name: 'ModerationPage', level: process.env.LOG_LEVEL || 'info' });

// Define the extended Job type expected from the API
type PendingJobWithCompany = Job & {
  company: {
    name: string;
    logo: string | null;
  } | null;
};

// Define the expected API response structure
interface PendingJobsApiResponse {
  jobs?: PendingJobWithCompany[];
  message?: string;
}

// Fetcher function for SWR
const fetcher = async (url: string): Promise<PendingJobsApiResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json();
    logger.error({ status: res.status, errorData }, 'Error fetching pending jobs');
    throw new Error(errorData.message || 'Failed to fetch pending jobs');
  }
  return res.json();
};

const ModerationPage: React.FC = () => {
  const { data, error, isLoading } = useSWR<PendingJobsApiResponse>('/api/admin/jobs/pending', fetcher);

  logger.trace({ isLoading, error, hasData: !!data }, 'Moderation page SWR state');

  // --- Moderation Handler --- 
  const handleModeration = async (jobId: string, action: 'APPROVE' | 'REJECT') => {
    logger.info({ jobId, action }, `Attempting to ${action.toLowerCase()} job`);
    try {
      const response = await fetch('/api/admin/jobs/moderate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId, action }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error({ status: response.status, errorData, jobId, action }, 'Failed to moderate job');
        // TODO: Add user-facing error feedback (e.g., toast notification)
        alert(`Failed to ${action.toLowerCase()} job: ${errorData.message || 'Unknown error'}`);
        return;
      }

      const result = await response.json();
      logger.info({ result }, `Job ${action.toLowerCase()}ed successfully`);
      // Revalidate the SWR cache to remove the job from the list
      mutate('/api/admin/jobs/pending'); 
      // TODO: Add user-facing success feedback
      // alert(`Job ${action.toLowerCase()}ed successfully!`); // Optional: immediate feedback

    } catch (err) {
      logger.error({ error: err, jobId, action }, 'Network or unexpected error during moderation');
      // TODO: Add user-facing error feedback
      alert(`An error occurred while trying to ${action.toLowerCase()} the job.`);
    }
  };

  // --- Render Logic --- 
  const renderContent = () => {
    if (isLoading) {
      return <p>Loading pending jobs...</p>;
    }

    if (error) {
      return <p className="text-red-500">Error loading jobs: {error.message}</p>;
    }

    if (!data || !data.jobs || data.jobs.length === 0) {
      return <p>No jobs currently pending review.</p>;
    }

    // --- Render Table --- 
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Jobs Pending Review ({data.jobs.length})</h2>
        <div className="overflow-x-auto shadow-md rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Job Title
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {job.company?.logo && (
                        <div className="flex-shrink-0 h-10 w-10 mr-3">
                          <img className="h-10 w-10 rounded-full object-contain" src={job.company.logo} alt={`${job.company.name} logo`} />
                        </div>
                      )}
                      <div className="text-sm font-medium text-gray-900">
                        {job.company?.name || 'Unknown Company'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{job.title}</div>
                    <div className="text-xs text-gray-500">ID: {job.sourceId}</div> 
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {job.source}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(job.updatedAt).toLocaleDateString()}
                  </td>
                   <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => handleModeration(job.id, 'APPROVE')}
                      className="text-indigo-600 hover:text-indigo-900 mr-2 disabled:opacity-50"
                      // disabled={isModerating} // Optional: Add loading state
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => handleModeration(job.id, 'REJECT')}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50"
                      // disabled={isModerating} // Optional: Add loading state
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    // <AdminLayout> // Wrap with AdminLayout if available
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Job Moderation Queue</h1>
      {renderContent()}
    </div>
    // </AdminLayout>
  );
};

export default ModerationPage; 