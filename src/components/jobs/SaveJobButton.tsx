import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

type SaveJobButtonProps = {
  jobId: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  showText?: boolean;
  onSaveToggle?: (isSaved: boolean) => void;
};

export default function SaveJobButton({
  jobId,
  className = '',
  variant = 'primary',
  showText = true,
  onSaveToggle
}: SaveJobButtonProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (session?.user) {
      checkIfJobIsSaved();
    } else {
      setIsLoading(false);
    }
  }, [session, jobId]);

  const checkIfJobIsSaved = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/jobs/saved/${jobId}`);
      
      if (response.ok) {
        const data = await response.json();
        setIsSaved(data.isSaved);
      }
    } catch (error) {
      console.error('Error checking saved status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSaveJob = async () => {
    if (status !== 'authenticated') {
      router.push(`/login?returnTo=${router.asPath}`);
      return;
    }

    setIsLoading(true);
    try {
      const method = isSaved ? 'DELETE' : 'POST';
      const response = await fetch(`/api/jobs/saved/${jobId}`, {
        method,
      });
      
      if (response.ok) {
        const newIsSaved = !isSaved;
        setIsSaved(newIsSaved);
        if (onSaveToggle) {
          onSaveToggle(newIsSaved);
        }
      } else {
        console.error('Failed to toggle saved status:', response.statusText);
      }
    } catch (error) {
      console.error('Error toggling saved status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Define button styles based on variant
  let buttonStyles = '';
  
  if (variant === 'primary') {
    buttonStyles = isSaved
      ? 'bg-primary-600 hover:bg-primary-700 text-white'
      : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300';
  } else if (variant === 'secondary') {
    buttonStyles = isSaved
      ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
  } else if (variant === 'outline') {
    buttonStyles = isSaved
      ? 'bg-white text-primary-600 border border-primary-600 hover:bg-primary-50'
      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50';
  }

  return (
    <button
      type="button"
      onClick={toggleSaveJob}
      disabled={isLoading}
      className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${buttonStyles} ${className}`}
      aria-label={isSaved ? 'Remover vaga dos salvos' : 'Salvar vaga'}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={`h-5 w-5 ${showText ? 'mr-2' : ''}`}
        fill={isSaved ? 'currentColor' : 'none'}
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
        />
      </svg>
      {showText && (
        <span>{isSaved ? 'Vaga Salva' : 'Salvar Vaga'}</span>
      )}
    </button>
  );
} 