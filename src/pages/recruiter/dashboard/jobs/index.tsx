import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';

// Interface for job type
interface Job {
  id: string;
  title: string;
  status: 'ACTIVE' | 'DRAFT' | 'PAUSED' | 'CLOSED';
  jobType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'FREELANCE';
  location: string;
  createdAt: string;
  applicantCount?: number;
  viewCount?: number;
  description?: string;
}

interface Props {
  // Define props if needed
}

export default function RecruiterJobs(props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Check if user is authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/recruiter');
    }

    if (status === 'authenticated') {
      fetchJobs();
    }
  }, [status, router]);

  // Handle toast messages
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast({ ...toast, show: false });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/recruiter/jobs');
      
      if (!response.ok) {
        throw new Error('Failed to load jobs');
      }
      
      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setError('Unable to load your jobs. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateJobStatus = async (jobId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'DRAFT' : 'ACTIVE';
    try {
      // Show loading state
      setIsLoading(true);
      
      // Prepare update data with proper typing
      const updateData: { 
        status: string; 
        publishedAt?: string;
      } = {
        status: newStatus
      };
      
      // Only set publishedAt when activating a job
      if (newStatus === 'ACTIVE') {
        // Use UTC format to ensure consistency across different regions
        const now = new Date();
        updateData.publishedAt = now.toISOString();
        console.log('Ativando vaga com data:', updateData.publishedAt);
      }
      
      console.log(`Updating job ${jobId} from ${currentStatus} to ${newStatus}`);
      
      const response = await fetch(`/api/recruiter/jobs/${jobId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) throw new Error('Failed to update status');
      
      // Show success message
      setToast({
        show: true,
        message: `Job ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`,
        type: 'success'
      });
      
      // Refresh jobs list
      fetchJobs();
    } catch (error) {
      console.error('Error updating job status:', error);
      setToast({
        show: true,
        message: 'Failed to update job status',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/recruiter/jobs/${jobId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to delete job');
      
      // Show success message
      setToast({
        show: true,
        message: 'Job deleted successfully',
        type: 'success'
      });
      
      // Refresh jobs list
      fetchJobs();
    } catch (error) {
      console.error('Error deleting job:', error);
      setToast({
        show: true,
        message: 'Failed to delete job',
        type: 'error'
      });
    }
  };

  const filteredJobs = activeFilter 
    ? jobs.filter(job => job.status === activeFilter)
    : jobs;

  // Show loading screen while checking session
  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>My Jobs | RemoteJobsBR</title>
      </Head>
      
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <Link href="/" className="text-blue-600 text-xl font-bold hover:text-blue-700">
                    RemoteJobsBR
                  </Link>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <Link href="/recruiter/dashboard" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                    Dashboard
                  </Link>
                  <Link href="/recruiter/dashboard/jobs" className="border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                    My Jobs
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>
        
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {/* Toast notification */}
          {toast.show && (
            <div className={`mb-4 p-4 rounded-md ${toast.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'} fixed top-4 right-4 z-50 shadow-md flex items-center`}>
              <div className="flex-shrink-0">
                {toast.type === 'success' ? (
                  <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm">{toast.message}</p>
              </div>
            </div>
          )}

          <div className="md:flex md:items-center md:justify-between mb-6">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">My Jobs</h2>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4">
              <Link 
                href="/recruiter/dashboard/jobs/new" 
                className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Post New Job
              </Link>
            </div>
          </div>
          
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Status filter tabs */}
          <div className="mb-6">
            <div className="sm:hidden">
              <label htmlFor="status-filter" className="sr-only">Select a status</label>
              <select
                id="status-filter"
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                value={activeFilter || ''}
                onChange={(e) => setActiveFilter(e.target.value || null)}
              >
                <option value="">All Jobs</option>
                <option value="ACTIVE">Active</option>
                <option value="DRAFT">Draft</option>
                <option value="PAUSED">Paused</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            <div className="hidden sm:block">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveFilter(null)}
                    className={`${
                      activeFilter === null
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    All Jobs
                  </button>
                  <button
                    onClick={() => setActiveFilter('ACTIVE')}
                    className={`${
                      activeFilter === 'ACTIVE'
                        ? 'border-green-500 text-green-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => setActiveFilter('DRAFT')}
                    className={`${
                      activeFilter === 'DRAFT'
                        ? 'border-yellow-500 text-yellow-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    Draft
                  </button>
                  <button
                    onClick={() => setActiveFilter('PAUSED')}
                    className={`${
                      activeFilter === 'PAUSED'
                        ? 'border-gray-500 text-gray-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    Paused
                  </button>
                  <button
                    onClick={() => setActiveFilter('CLOSED')}
                    className={`${
                      activeFilter === 'CLOSED'
                        ? 'border-red-500 text-red-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    Closed
                  </button>
                </nav>
              </div>
            </div>
          </div>
          
          {filteredJobs.length === 0 && !isLoading && !error ? (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  {activeFilter ? `No ${activeFilter.toLowerCase()} jobs found` : 'No jobs posted'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {activeFilter 
                    ? 'Try selecting a different filter or create a new job posting.'
                    : 'Start by posting your first job to find Brazilian talent.'}
                </p>
                <div className="mt-6">
                  <Link
                    href="/recruiter/dashboard/jobs/new"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    New Job
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <ul className="divide-y divide-gray-200">
                {filteredJobs.map((job) => (
                  <li key={job.id} className="bg-white hover:bg-gray-50 transition-colors">
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-medium text-blue-600 truncate mb-1">{job.title}</h3>
                          {job.description && (
                            <p className="text-sm text-gray-500 line-clamp-2 mb-2">{job.description}</p>
                          )}
                          
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              job.jobType === 'FULL_TIME' ? 'bg-blue-100 text-blue-800' :
                              job.jobType === 'PART_TIME' ? 'bg-purple-100 text-purple-800' :
                              job.jobType === 'CONTRACT' ? 'bg-indigo-100 text-indigo-800' :
                              job.jobType === 'INTERNSHIP' ? 'bg-teal-100 text-teal-800' :
                              'bg-pink-100 text-pink-800'
                            }`}>
                              {job.jobType === 'FULL_TIME' ? 'Full Time' : 
                              job.jobType === 'PART_TIME' ? 'Part Time' : 
                              job.jobType === 'CONTRACT' ? 'Contract' : 
                              job.jobType === 'INTERNSHIP' ? 'Internship' : 'Freelance'}
                            </span>
                            
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              <svg className="mr-1 h-3 w-3 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                              </svg>
                              {job.location}
                            </span>
                            
                            {job.viewCount !== undefined && (
                              <span className="inline-flex items-center text-xs text-gray-500">
                                <svg className="mr-1 h-3 w-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                </svg>
                                {job.viewCount} views
                              </span>
                            )}
                            
                            {job.applicantCount !== undefined && (
                              <span className="inline-flex items-center text-xs text-gray-500">
                                <svg className="mr-1 h-3 w-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                                </svg>
                                {job.applicantCount} applicants
                              </span>
                            )}
                            
                            <span className="inline-flex items-center text-xs text-gray-500">
                              <svg className="mr-1 h-3 w-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                              </svg>
                              {new Date(job.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 ml-4">
                          <div className="flex items-center">
                            <label className="sr-only">Job status</label>
                            <select
                              value={job.status}
                              onChange={(e) => {
                                if (e.target.value !== job.status) {
                                  if (confirm(`Are you sure you want to change this job status to ${e.target.value.toLowerCase()}?`)) {
                                    updateJobStatus(job.id, job.status);
                                  }
                                }
                              }}
                              className={`block py-1 pl-3 pr-10 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                                job.status === 'ACTIVE' ? 'bg-green-100 text-green-800 border-green-200' : 
                                job.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 
                                job.status === 'PAUSED' ? 'bg-gray-100 text-gray-800 border-gray-200' : 
                                'bg-red-100 text-red-800 border-red-200'
                              }`}
                            >
                              <option value="ACTIVE">Active</option>
                              <option value="DRAFT">Draft</option>
                              <option value="PAUSED">Paused</option>
                              <option value="CLOSED">Closed</option>
                            </select>
                          </div>
                          
                          <div className="flex items-center space-x-2 ml-2">
                            <Link
                              href={`/recruiter/dashboard/jobs/${job.id}`}
                              className="inline-flex items-center p-1.5 border border-transparent rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              title="View Details"
                            >
                              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                              </svg>
                            </Link>
                            <Link
                              href={`/recruiter/dashboard/jobs/${job.id}/edit`}
                              className="inline-flex items-center p-1.5 border border-transparent rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              title="Edit Job"
                            >
                              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                              </svg>
                            </Link>
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
                                  deleteJob(job.id);
                                }
                              }}
                              className="inline-flex items-center p-1.5 border border-transparent rounded-full shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                              title="Delete Job"
                            >
                              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
} 