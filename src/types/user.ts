import { Job, SavedJob } from './models';

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

/**
 * Represents a user profile, which can be either a Candidate or a Company.
 */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: 'CANDIDATE' | 'COMPANY' | 'ADMIN';
  // Candidate specific fields
  title?: string | null;
  bio?: string | null;
  location?: string | null;
  resumeUrl?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  skills?: string[];
  // Company specific fields
  description?: string | null;
  website?: string | null;
  // Relations (optional based on context)
  savedJobs?: SavedJob[];
  jobsPosted?: Job[]; // For COMPANY role
}

// This interface seems redundant now that Application is removed.
// Keeping it commented out for now in case it was used elsewhere for a different purpose.
// export interface JobApplication { // REMOVED
//   id: string;
//   job: Job;
//   status: string; // Simplified status for display?
//   appliedAt: Date;
// }

/**
 * Structure for user settings.
 */
export interface UserSettings {
  newsletterEnabled: boolean;
  emailNotifications: {
    newApplications: boolean; // REMOVE?
    jobMatches: boolean;
    applicationStatusChanges: boolean; // REMOVE?
  };
  // Add other settings as needed
}

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
} 