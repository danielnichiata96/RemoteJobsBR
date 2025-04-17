import { JobType, ExperienceLevel, Currency } from '@prisma/client';
import { HiringRegion } from '@prisma/client';

/**
 * StandardizedJob represents the normalized job data structure
 * suitable for processing by JobProcessingService
 */
export interface StandardizedJob {
  // Core identifiers
  sourceId: string;
  source: string;
  
  // Basic job details
  title: string;
  description: string;
  requirements?: string;
  responsibilities?: string;
  benefits?: string;
  
  // Classification
  jobType?: JobType;
  experienceLevel?: ExperienceLevel;
  skills?: string[];
  tags?: string[];
  
  // Location information
  location: string;
  country?: string;
  workplaceType?: string;
  isRemote: boolean;
  hiringRegion?: HiringRegion;
  visas?: string[];
  languages?: string[];
  
  // Salary details
  minSalary?: number;
  maxSalary?: number;
  currency?: Currency;
  salaryCycle?: string;
  
  // URLs and application info
  applicationUrl?: string;
  
  // Company information
  companyName: string;
  companyLogo?: string;
  companyWebsite?: string;
  companyEmail?: string;
  
  // Raw data for potential further processing
  locationRaw?: string;
  metadataRaw?: any;
  jobType2?: 'global' | 'latam'; // Additional classification from source
  
  // Tracking dates
  publishedAt?: Date;
  expiresAt?: Date;
  updatedAt?: Date;
  status?: string;
} 