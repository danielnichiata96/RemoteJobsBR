import { useCallback } from 'react';

export function useTrackJobClick() {
  const trackClick = useCallback(async (jobId: string | undefined | string[], targetUrl: string | null | undefined, isEmailLink: boolean = false) => {
    // Logic from handleApplyClick will go here
    console.log(`Tracking click for job: ${jobId}, URL: ${targetUrl}`);

    if (!jobId || typeof jobId !== 'string' || !targetUrl) {
      console.error("Missing job ID or target URL for click tracking.");
      // Maybe return an error status or throw?
      // For now, just log and return early like the original
      alert("Não foi possível rastrear o clique ou URL de aplicação inválida.");
      return false; // Indicate failure
    }

    // Extract internal ID if prefixed
    let internalId = jobId;
    if (jobId.includes('_')) {
      internalId = jobId.split('_')[1];
      console.log(`Using internal ID for tracking: ${internalId}`);
    } else {
      console.log(`Using standard ID for tracking: ${jobId}`);
    }

    try {
      const response = await fetch(`/api/jobs/${internalId}/track-click`, {
        method: 'POST',
      });

      if (!response.ok) {
        console.error(`Failed to track click for job ${jobId}: ${response.status}`);
        // Optionally parse error message if needed
        // const data = await response.json();
        // console.error('Tracking error:', data.message);
        // Don't alert here, let the caller decide how to handle UI
      } else {
        console.log(`Successfully tracked click for job ${jobId}`);
      }
      // Regardless of tracking success, proceed to open the link
      // Decide if opening the link should be part of the hook or done by the caller
      // Let's make it part of the hook for now, similar to original function
      if (!isEmailLink) {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = targetUrl; // For mailto links
      }
      return true; // Indicate success (at least attempted tracking and opened link)

    } catch (error) {
      console.error('Network or other error tracking click:', error);
      // Open the link even if tracking fails
      if (!isEmailLink) {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = targetUrl; // For mailto links
      }
      return false; // Indicate tracking failure but link was opened
    }
  }, []); // Empty dependency array means the function identity is stable

  return { trackClick };
} 