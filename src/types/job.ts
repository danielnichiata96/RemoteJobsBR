export interface Job {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  location: string;
  description: string;
  jobType: string;
  experienceLevel: string;
  tags: string[];
  salary?: string;
  createdAt: Date | string;
  applicationUrl: string;
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