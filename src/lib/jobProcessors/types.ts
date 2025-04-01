import { JobType, ExperienceLevel, Currency } from '@prisma/client';

export interface JobProcessor {
  source: string;
  processJob(rawJob: any): Promise<StandardizedJob>;
}

export interface StandardizedJob {
  sourceId: string;
  title: string;
  description: string;
  requirements: string;
  responsibilities: string;
  benefits?: string;
  jobType: JobType;
  experienceLevel: ExperienceLevel;
  skills: string[];
  tags: string[];
  location: string;
  country: string;
  workplaceType: string;
  minSalary?: number;
  maxSalary?: number;
  currency?: Currency;
  salaryCycle?: string;
  applicationUrl?: string;
  sourceUrl?: string;
  sourceLogo?: string;
  company: {
    name: string;
    email: string;
    logo?: string;
    website?: string;
    industry?: string;
  };
}

export interface ProcessedJobResult {
  success: boolean;
  job?: StandardizedJob;
  error?: string;
} 