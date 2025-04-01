export interface Job {
  id: string;
  title: string;
  company: string | {
    name: string;
    logo?: string;
  };
  companyLogo?: string | null;
  companyVerified?: boolean;
  location: string;
  description: string;
  jobType: string;
  experienceLevel: string;
  tags?: string[];
  salary?: string | null;
  createdAt: Date | string;
  publishedAt?: Date | string;
  applicationUrl?: string;
  industry?: string;
  regionType?: string;
  source?: string;
  sourceUrl?: string;
  sourceLogo?: string;
}
