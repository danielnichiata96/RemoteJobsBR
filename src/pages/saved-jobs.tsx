import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Layout from '@/components/common/Layout';
import WideJobCard from '@/components/jobs/WideJobCard';
import JobListSkeleton from '@/components/jobs/JobListSkeleton';
import ErrorMessage from '@/components/common/ErrorMessage';
import { Job } from '@/types/models'; // Assuming Job type is defined here

// Define the expected type for saved jobs (might include savedAt)
type SavedJobDetail = Job & {
  savedAt?: string; 
  isSaved?: boolean; // Should always be true here
};

export default function SavedJobsPage(props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [savedJobs, setSavedJobs] = useState<SavedJobDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Redirect if not authenticated
    if (status === 'unauthenticated') {
      router.replace('/login?returnTo=/saved-jobs');
    } else if (status === 'authenticated') {
      fetchSavedJobs();
    }
  }, [status, router]);

  const fetchSavedJobs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/users/me/saved-jobs');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch saved jobs: ${response.statusText}`);
      }
      const data: SavedJobDetail[] = await response.json();
      setSavedJobs(data);
    } catch (err: any) {
      console.error("Error fetching saved jobs:", err);
      setError(err.message || 'An error occurred while fetching saved jobs.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsave = (jobId: string) => {
    // Optimistically remove the job from the list
    setSavedJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
    // Note: The SaveJobButton inside WideJobCard handles the API call to unsave
  };

  return (
    <Layout>
      <Head>
        <title>Vagas Salvas | RemoteJobsBR</title>
        <meta name="description" content="Gerencie suas vagas remotas salvas." />
      </Head>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">
          Minhas Vagas Salvas
        </h1>

        {status === 'loading' || isLoading ? (
          <JobListSkeleton count={5} />
        ) : error ? (
          <ErrorMessage message={error} />
        ) : savedJobs.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-lg">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            <h2 className="text-xl font-bold text-gray-700 mb-2">Nenhuma vaga salva ainda</h2>
            <p className="text-gray-600">Explore as vagas e clique no ícone de coração para salvar as que te interessam!</p>
            <button 
              onClick={() => router.push('/')} 
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Explorar Vagas
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {savedJobs.map((job) => (
              <WideJobCard key={job.id} job={job} /> 
              // TODO: Consider passing an onUnsave callback if needed, 
              // though SaveJobButton should handle its own state/API calls
            ))}
          </div>
        )}
      </main>
    </Layout>
  );
} 