import { JobType, ExperienceLevel, Currency, JobSource, HiringRegion, JobStatus, SalaryPeriod } from '@prisma/client';
import { StandardizedJob, JobAssessmentStatus } from '../../types/StandardizedJob'; // Import JobAssessmentStatus

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
  published_at?: string;
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
  publishedAt?: string;
  _assessmentStatus?: JobAssessmentStatus;
}

// Union type for raw job data from different sources
// Allows the adapter to pass source-specific data to the correct processor
export type RawJobData = GreenhouseJob | EnhancedGreenhouseJob | AshbyApiJob | LeverApiPosting;

// Interface for Ashby API Job Postings (Example structure)
export interface AshbyApiJob {
  id: string;
  title: string;
  team?: string;
  location?: string; // Can be an address or "Remote"
  address?: { country: string; city: string; state: string; postalCode: string; street1: string; };
  compensationTier?: string;
  publishedAt: string;
  updatedAt: string;
  department?: string;
  descriptionHtml: string;
  isRemote: boolean;
  isListed: boolean;
  employmentType?: string; // Full-time, Part-time, Contract, etc.
  compensationRange?: { min: number, max: number, currency: string };
  secondaryLocations?: string[]; // Additional locations
  // Ashby-specific fields potentially used for assessment
  _assessmentStatus?: JobAssessmentStatus;
}

// Interface for Lever API Postings (Example structure)
export interface LeverApiPosting {
  id: string;
  text: string; // Job title
  createdAt: number; // Timestamp
  updatedAt?: number; // Optional timestamp
  hostedUrl: string;
  applyUrl: string;
  categories: {
    location?: string;
    team?: string;
    commitment?: string; // e.g., Full-time
    level?: string; // e.g., Senior
    department?: string;
  };
  description: string; // Plain text description
  descriptionHtml: string; // HTML description
  lists: Array<{ text: string; content: string }>; // Sections like Requirements, Responsibilities
  additional: string; // Plain text additional info
  additionalHtml: string; // HTML additional info
  salaryRange?: {
    min: number;
    max: number;
    currency: string;
    interval: string; // e.g., "year", "month"
  }
  workplaceType?: 'on-site' | 'remote' | 'hybrid';
}

// Enhanced Lever posting data
export interface LeverApiPostingWithAssessment extends LeverApiPosting {
  _assessmentStatus?: JobAssessmentStatus;
  tags?: string[]; // ADDED MISSING TAGS PROPERTY
} 