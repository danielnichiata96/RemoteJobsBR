export interface Job {
  id: string;
  title: string;
  company: string | CompanyInfo;
  companyLogo?: string;
  location: string;
  description: string;
  jobType: string;
  experienceLevel: string;
  tags?: string[];
  skills?: string[];
  salary?: string;
  minSalary?: number;
  maxSalary?: number;
  currency?: string;
  salaryCycle?: string;
  showSalary?: boolean;
  createdAt: Date | string;
  publishedAt?: Date | string;
  applicationUrl: string;
  industry?: string;
  regionType?: string;
  responsibilities?: string;
  requirements?: string;
  benefits?: string;
  workplaceType?: string;
  viewCount?: number;
}

export interface CompanyInfo {
  name: string;
  logo?: string;
  image?: string;
  website?: string;
  linkedinUrl?: string;
}

// Tipos de trabalho
export enum JobType {
  FULL_TIME = 'full-time',
  PART_TIME = 'part-time',
  CONTRACT = 'contract',
  FREELANCE = 'freelance',
  INTERNSHIP = 'internship',
}

// Níveis de experiência
export enum ExperienceLevel {
  ENTRY = 'entry-level',
  MID = 'mid-level',
  SENIOR = 'senior-level',
  LEAD = 'lead-level',
}

export type JobStatus = 'active' | 'filled' | 'closed';

export interface JobApplication {
  id: string;
  userId: string;
  jobId: string;
  coverLetter?: string;
  resumeUrl?: string;
  status: ApplicationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ApplicationStatus = 'pending' | 'reviewing' | 'interview' | 'rejected' | 'accepted'; 