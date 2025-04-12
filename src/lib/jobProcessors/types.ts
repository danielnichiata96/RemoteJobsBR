import { JobType, ExperienceLevel, Currency, JobSource, HiringRegion } from '@prisma/client';

// Core interface for standardized job data BEFORE final database mapping
export interface StandardizedJob {
  sourceId: string; // ID from the original source (e.g., Greenhouse job ID)
  source: string; // Name of the source (e.g., 'greenhouse', 'direct')
  title: string;
  description: string;
  requirements?: string;
  responsibilities?: string;
  benefits?: string;
  jobType?: JobType;
  experienceLevel?: ExperienceLevel;
  skills?: string[];
  tags?: string[];
  location: string; // Raw location string from the source
  country?: string; // Determined country (e.g., 'Worldwide', 'LATAM')
  hiringRegion?: HiringRegion;
  workplaceType?: string; // e.g., 'REMOTE'
  minSalary?: number;
  maxSalary?: number;
  currency?: Currency;
  salaryCycle?: string;
  applicationUrl?: string;
  // Removed sourceUrl and sourceLogo as they don't map directly to DB
  companyName: string;
  companyLogo?: string;
  companyWebsite?: string;
  companyEmail?: string;
  publishedAt?: Date;
  expiresAt?: Date;
  updatedAt?: Date;
}

// Interface for the result of processing a job by a specific processor
export interface ProcessedJobResult {
  success: boolean;
  job?: StandardizedJob;
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