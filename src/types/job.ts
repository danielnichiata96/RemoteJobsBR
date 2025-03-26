export interface Job {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  companyWebsite?: string;
  location: string;
  salary?: string;
  description: string;
  requirements: string;
  tags: string[];
  jobType: JobType;
  experienceLevel: ExperienceLevel;
  contactEmail: string;
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type JobType = 'full-time' | 'part-time' | 'contract' | 'freelance';

export type ExperienceLevel = 'entry-level' | 'mid-level' | 'senior' | 'lead';

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