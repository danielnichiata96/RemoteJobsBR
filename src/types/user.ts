export interface User {
  id: string;
  name?: string;
  email: string;
  emailVerified?: Date;
  password?: string;
  image?: string;
  role: UserRole;
  location?: string;
  bio?: string;
  resumeUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'user' | 'admin';

export interface UserProfile extends Omit<User, 'password'> {
  applications?: JobApplication[];
  savedJobs?: SavedJob[];
}

export interface JobApplication {
  id: string;
  jobId: string;
  coverLetter?: string;
  resumeUrl?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  job?: Job;
}

export interface SavedJob {
  id: string;
  jobId: string;
  createdAt: Date;
  job?: Job;
}

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
} 