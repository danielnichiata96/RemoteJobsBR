import { StandardizedJob } from '../types/StandardizedJob';
import { FilterConfig } from '../types/FilterConfig'; // Assuming FilterConfig type exists
import { normalizeText } from './textUtils'; // Assuming textUtils exists for normalization

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
  config: FilterConfig
): number {
  let score = 0;
  const signals = config.SCORING_SIGNALS;

  if (!signals) {
    // Optional: Log a warning if signals are missing?
    return 0; // Or throw an error?
  }

  // Combine text fields for easier searching. Normalize them.
  const combinedText = normalizeText(
    `${jobData.title || ''} ${jobData.description || ''} ${jobData.location || ''}`
  );
  const locationText = normalizeText(jobData.location || '');
  const descriptionText = normalizeText(jobData.description || '');
  const titleText = normalizeText(jobData.title || '');

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
    if (category.keywords) {
      for (const keyword of category.keywords) {
        // Decide which text field(s) to check based on category
        // For location signals, prioritize location field?
        // For content signals, prioritize description/title?
        // Simple approach: check combined text for now.
        // TODO: Refine which text fields are checked per category/keyword type?
        const normalizedTerm = normalizeText(keyword.term);
        if (combinedText.includes(normalizedTerm)) {
          score += keyword.weight;
        }
      }
    }

    // Process patterns (Regex)
    if (category.patterns) {
      for (const pattern of category.patterns) {
        try {
          // Case-insensitive regex
          const regex = new RegExp(pattern.pattern, 'i'); 
          // TODO: Refine which text fields are checked per category/pattern type?
          if (regex.test(combinedText)) {
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