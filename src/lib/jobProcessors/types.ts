import { JobType, ExperienceLevel, Currency, JobSource, HiringRegion, JobStatus, SalaryPeriod } from '@prisma/client';
import { StandardizedJob } from '../../types/StandardizedJob'; // Import the correct type

// Interface for the result of processing a job by a specific processor
export interface ProcessedJobResult {
  success: boolean;
  job?: StandardizedJob; // Use the imported StandardizedJob type
  error?: string;
}

// Interface for any job processor
export interface JobProcessor {
  source: string; // e.g., 'greenhouse', 'linkedin'
  processJob(rawJob: any, sourceData?: JobSource): Promise<ProcessedJobResult>;
}

// Interface specifically for raw Greenhouse job data
export interface GreenhouseJob {
  id: number;
  title: string;
  updated_at: string;
  location: { name: string };
  content: string;
  absolute_url: string;
  metadata: Array<{
    id: number;
    name: string;
    value: string | string[] | null;
  }>;
  departments: Array<{ name: string }>;
  company: {
    name: string;
    boardToken: string;
    logo?: string;
    website?: string;
  };
}

// Enhanced Greenhouse job data passed from Adapter to Processor
export interface EnhancedGreenhouseJob extends GreenhouseJob {
  requirements?: string;
  responsibilities?: string;
  benefits?: string;
  jobType?: JobType;
  experienceLevel?: ExperienceLevel;
  skills?: string[];
  tags?: string[];
  country?: string;
  workplaceType?: string;
}

// Union type for raw job data from different sources
// Allows the adapter to pass source-specific data to the correct processor
export type RawJobData = GreenhouseJob | EnhancedGreenhouseJob | AshbyApiJob; 