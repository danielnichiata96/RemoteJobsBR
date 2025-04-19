import { StandardizedJob } from '../../types/StandardizedJob';
import { normalizeForDeduplication } from './textUtils'; // Import the existing normalization function
// import { FilterConfig } from '../types/FilterConfig'; // Removed - Config passed as object
// import { normalizeText } from './textUtils'; // Removed - Function doesn't exist

interface JobDataForScoring {
  title: string;
  description?: string | null;
  location?: string | null;
  // Add other fields if needed for scoring, e.g., requirements, specific metadata
}

/**
 * Calculates a relevance score for a job based on configured signals.
 * 
 * @param jobData - The relevant text fields from the job.
 * @param config - The loaded filter configuration containing SCORING_SIGNALS.
 * @returns The calculated relevance score.
 */
export function calculateRelevanceScore(
  jobData: JobDataForScoring,
  config: any // Changed FilterConfig type to any
): number | null {
  if (!config?.SCORING_SIGNALS) {
    // Optional: Log a warning if signals are missing?
    return null; // Or throw an error?
  }

  let score = 0;
  const signals = config.SCORING_SIGNALS;

  // Combine relevant text fields for broader matching
  const combinedText = normalizeForDeduplication(
    `${jobData.title || ''} ${jobData.description || ''} ${jobData.location || ''}`
  );
  const locationText = normalizeForDeduplication(jobData.location || '');
  const descriptionText = normalizeForDeduplication(jobData.description || '');
  const titleText = normalizeForDeduplication(jobData.title || '');

  let textToSearch = combinedText; // Declare outside the loop

  // --- Process Scoring Signals --- 

  const signalCategories = [
    signals.positive_location,
    signals.negative_location,
    signals.positive_content,
    signals.negative_content,
  ];

  for (const category of signalCategories) {
    if (!category) continue;

    // Process keywords
    if (category.keywords && category.keywords.length > 0) {
      for (const keyword of category.keywords) {
        const normalizedTerm = normalizeForDeduplication(keyword.term);
        textToSearch = combinedText; // Default to combined text (reuse outer variable)

        // For location signals, prioritize location field
        if (category.locationPriority) {
          textToSearch = locationText;
        }

        if (textToSearch.includes(normalizedTerm)) {
          score += keyword.weight;
        }
      }
    }

    // Process patterns (Regex)
    if (category.patterns && category.patterns.length > 0) {
      for (const pattern of category.patterns) {
        try {
          // Case-insensitive regex
          const regex = new RegExp(pattern.pattern, 'i'); 
          // TODO: Refine which text fields are checked per category/pattern type?
          if (regex.test(textToSearch)) {
            score += pattern.weight;
          }
        } catch (error) {
          // Optional: Log regex parsing errors
          console.error(`Invalid regex pattern in config: ${pattern.pattern}`, error);
        }
      }
    }
  }

  // TODO: Add potential score clamping (min/max)?
  // TODO: Add base score logic if needed?

  return score;
}

// Potential future enhancements:
// - More granular text field checking (e.g., location patterns only check location field)
// - Handling overlapping signals (e.g., both "latam" and "us only" present)
// - Caching normalized text or regex objects if performance becomes an issue. 