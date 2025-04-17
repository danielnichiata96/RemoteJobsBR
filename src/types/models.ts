/**
 * Modelos de dados para o RemoteJobsBR
 * Define as estruturas de dados utilizadas no sistema
 */

import { User as PrismaUser, Job as PrismaJob, JobSource as PrismaJobSource, SavedJob as PrismaSavedJob } from '@prisma/client';

// --- ENUMS ---

/** Papéis de usuário no sistema */
export enum UserRole {
  CANDIDATE = 'CANDIDATE',
  COMPANY = 'COMPANY',
  ADMIN = 'ADMIN',
}

/** Tipos de vaga */
export enum JobType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERNSHIP = 'INTERNSHIP',
  FREELANCE = 'FREELANCE',
  UNKNOWN = 'UNKNOWN',
}

/** Nível de experiência */
export enum ExperienceLevel {
  ENTRY = 'ENTRY',
  MID = 'MID',
  SENIOR = 'SENIOR',
  LEAD = 'LEAD',
  UNKNOWN = 'UNKNOWN',
}

/** Status da vaga */
export enum JobStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CLOSED = 'CLOSED',
}

/** Moedas disponíveis */
export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  BRL = 'BRL',
  CAD = 'CAD',
  AUD = 'AUD',
}

/** Status da candidatura */
export enum ApplicationStatus {
  PENDING = 'PENDING',
  VIEWED = 'VIEWED',
  INTERVIEWING = 'INTERVIEWING',
  OFFERED = 'OFFERED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

/** Intervalo de salário */
export enum SalaryInterval {
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  PROJECT = 'PROJECT', // For contract/freelance
  UNKNOWN = 'UNKNOWN',
}

// --- CORE INTERFACES ---

// Placeholder for Notification type - Define structure based on actual usage
export interface Notification {
  id: string;
  message: string;
  read: boolean;
  createdAt: Date;
  userId: string; // Link back to User
  // user?: User; // Avoid circular dependency, use userId
}

/** Interface básica de usuário (Base para Candidate e Company) */
// Omit createdAt/updatedAt as they are managed by Prisma directly.
// Align local fields (like name) with Prisma schema requirements.
export interface User extends Omit<PrismaUser, 'createdAt' | 'updatedAt'> {
  id: string;
  email: string;
  name: string; // Prisma requires name, so it's not optional here
  firstName?: string | null; // Often derived from name
  lastName?: string | null; // Often derived from name
  role: UserRole;
  avatarUrl?: string | null;
  title?: string | null; // Candidate Title / Company Tagline?
  location?: string | null;
  bio?: string | null; // Candidate Bio / Company Description
  phone?: string | null;

  // Candidate Specific (potentially moved to CandidateProfile)
  resumeUrl?: string | null;
  linkedinUrl?: string | null; // Can be for both Candidate and Company
  githubUrl?: string | null; // Candidate
  portfolioUrl?: string | null; // Candidate
  desiredSalary?: number | null; // Candidate
  availableForWork: boolean; // Candidate
  preferredWorkTypes: string[]; // Candidate
  preferredLocations: string[]; // Candidate
  yearsOfExperience?: number | null; // Candidate
  experienceLevel?: ExperienceLevel | null; // Candidate
  skills: string[]; // Candidate
  languages: any[]; // Candidate - Consider defining { language: string, proficiency: string }[]

  // Company Specific (potentially moved to EmployerProfile/Company)
  description?: string | null; // Company Description (Redundant with bio? Clarify)
  industry?: string | null; // Company
  website?: string | null; // Company
  logo?: string | null; // Company (Redundant with avatarUrl? Clarify)
  size?: string | null; // Company
  foundedYear?: number | null; // Company
  contactName?: string | null; // Company
  contactEmail?: string | null; // Company
  contactPhone?: string | null; // Company (Redundant with phone? Clarify)
  twitterUrl?: string | null; // Company
  facebookUrl?: string | null; // Company Specific?

  // Common / System Fields
  isVerified: boolean;
  subscriptionTier?: string | null;
  subscriptionEndsAt?: Date | string | null; // Allow string for form input flexibility
  createdAt: Date; // Re-include from PrismaUser
  updatedAt: Date; // Re-include from PrismaUser

  // Relationships
  jobs?: Job[]; // If role=COMPANY
  savedJobs?: SavedJob[]; // If role=CANDIDATE
  settings?: UserSettings | null;
  socials?: UserSocials | null; // Could consolidate social URLs here
  candidateProfile?: Candidate | null; // Link to more specific candidate data (if Candidate doesn't extend User)
  employerProfile?: Employer | null; // Link to more specific employer data (if Company doesn't extend User)
  applications?: Application[]; // If role=CANDIDATE or COMPANY
  notifications?: Notification[];
  newsletters?: Newsletter[]; // User's newsletter subscriptions
}

/** Candidato: Usuário com papel CANDIDATE */
// Consider if extending User is best or having a separate CandidateProfile linked by userId
export interface Candidate extends User {
  role: UserRole.CANDIDATE;
  // Add fields ONLY specific to Candidates not covered in the base User interface
  // Example: assessmentResults?: any[];
}

/** Empresa: Usuário com papel COMPANY */
// Consider if extending User is best or having a separate Employer/CompanyProfile linked by userId
export interface Company extends User {
  role: UserRole.COMPANY;
  // Add fields ONLY specific to Companies not covered in the base User interface
  // Example: taxId?: string;
}

/** Modelo de vaga */
// Omit fields managed by Prisma or relations, redefine if needed for clarity/override
// Ensure local optionality matches Prisma schema (e.g., location)
export interface Job extends Omit<PrismaJob, 'createdAt' | 'updatedAt' | 'companyId' | 'sourceId' | 'salaryMin' | 'salaryMax' | 'salaryCurrency' | 'employmentType' | 'experienceLevel'> {
  id: string;
  title: string;
  description: string;
  location: string | null; // Assuming Prisma allows null
  url: string; // URL to the original job posting
  employmentType?: JobType | null; // Align with PrismaJob.employmentType
  experienceLevel?: ExperienceLevel | null; // Align with PrismaJob.experienceLevel
  department?: string | null;
  skillsRequired?: string[];
  salaryMin?: number | null; // Align with PrismaJob.salaryMin
  salaryMax?: number | null; // Align with PrismaJob.salaryMax
  salaryCurrency?: Currency | null; // Align with PrismaJob.salaryCurrency
  salaryInterval?: SalaryInterval | null;
  companyId?: string | null; // Foreign key to User (Company)
  sourceId?: string | null; // Foreign key to JobSource
  status: JobStatus;
  postedAt?: Date | null;
  expiresAt?: Date | null;
  createdAt: Date; // Re-include from PrismaJob
  updatedAt: Date; // Re-include from PrismaJob

  // Added/Derived fields (Not directly in PrismaJob?)
  logoUrl?: string | null; // Likely derived from Company relation
  reliabilityScore?: number | null; // Calculated or from JobSource?
  lastScrapedAt?: Date | null; // From scraping process

  // Relationships
  company?: Company | null; // Based on companyId
  source?: JobSource | null; // Based on sourceId
  applications?: Application[];
  savedByUsers?: SavedJob[]; // Users who saved this job
  standardizedJob?: StandardizedJob | null; // Link to processed/standardized version
}

/** Candidatura a uma vaga */
export interface Application {
  id: string;
  jobId: string;
  candidateId: string;
  coverLetter?: string;
  resumeUrl?: string; // URL submitted with application
  additionalInfo?: string;
  status: ApplicationStatus;
  feedback?: string; // Feedback from company
  createdAt: Date;
  updatedAt: Date;
  readByCompany: boolean; // Has the company viewed the application?
  interviewDate?: Date;

  // Relationships
  job?: Job; // Based on jobId
  candidate?: Candidate; // Based on candidateId (or User)
}

/** Vagas salvas pelo candidato */
// Omit keys managed by Prisma relations
export interface SavedJob extends Omit<PrismaSavedJob, 'candidateId' | 'jobId'> {
  id: string;
  // candidateId: string; // Implied by relation
  // jobId: string; // Implied by relation
  createdAt: Date; // Re-include from PrismaSavedJob

  // Relationships
  candidate?: User; // Link to the User who saved the job
  job?: Job; // Link to the Job that was saved
}

/** Inscrição em newsletter */
export interface Newsletter {
  id: string;
  email: string;
  name?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Relationships
  user?: User; // Link to user if they are registered
  userId?: string | null; // Foreign key if user is registered
}

/** Fonte de onde as vagas são originadas (e.g., Greenhouse board) */
// Omit createdAt/updatedAt as they are managed by Prisma
// Check PrismaJobSource schema for nullability (e.g., logoUrl)
export interface JobSource extends Omit<PrismaJobSource, 'createdAt' | 'updatedAt'> {
  id: string;
  name: string; // e.g., 'Gupy'
  baseUrl: string; // Base URL for the source API or website
  description?: string | null;
  logoUrl?: string | null; // URL to the source's logo (assuming Prisma allows null)
  reliabilityScore?: number | null; // Score indicating data quality
  lastScrapedAt?: Date | null; // Timestamp of the last scrape attempt
  scrapeFrequency?: string | null; // How often to scrape? e.g., 'DAILY', 'WEEKLY'
  isActive: boolean; // Whether this source should be scraped
  notes?: string | null; // Internal notes about the source
  createdAt: Date; // Re-include from PrismaJobSource
  updatedAt: Date; // Re-include from PrismaJobSource

  // Relationships
  jobs?: Job[]; // Jobs originating from this source
  scrapePatterns?: ScrapePattern[]; // Patterns used for scraping (if applicable)
}

// --- UTILITY / SUPPORTING INTERFACES ---

/** Estrutura para respostas de API paginadas */
export interface PaginatedResponse<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
}

/** Opções comuns para queries de listagem */
export interface ListQueryOptions {
  page?: number;
  limit?: number;
  sortBy?: string; // Field to sort by (e.g., 'createdAt')
  sortOrder?: 'asc' | 'desc';
  filter?: Record<string, any>; // Generic filter object (consider defining specific filters)
}

/** Configurações do usuário */
export interface UserSettings {
  // id: string; // PK
  // userId: string; // FK to User
  prefersDarkMode?: boolean;
  emailNotifications?: boolean; // General toggle
  // notificationFrequency?: 'INSTANT' | 'DAILY' | 'WEEKLY';
  // Add other settings...
}

/** Links de redes sociais do usuário */
export interface UserSocials {
  // id: string; // PK
  // userId: string; // FK to User
  linkedin?: string | null;
  github?: string | null;
  twitter?: string | null;
  portfolio?: string | null;
  // Add others...
}

/** Perfil específico do candidato (se não estender User) */
export interface CandidateProfile {
  // userId: string; // PK/FK to User
  // Contains fields specific to Candidate not in User base
  // Example: professionalHeadline: string;
}

/** Perfil específico da empresa (se não estender User) */
// Also known as CompanyProfile
export interface Employer {
  // userId: string; // PK/FK to User
  verificationStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';
  // Contains fields specific to Employer not in User base
  // Example: billingAddress: string;
}

/** Formato padronizado de vaga após processamento */
export interface StandardizedJob {
  id?: string; // Optional: ID in our DB if saved
  title: string;
  description: string; // Cleaned, standardized description
  location?: string | null; // Standardized (e.g., 'Remote', 'Remote (LATAM)')
  url: string; // Original posting URL
  employmentType?: JobType | null;
  experienceLevel?: ExperienceLevel | null;
  skillsRequired?: string[]; // Parsed/standardized skills
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: Currency | null;
  salaryInterval?: SalaryInterval | null;
  companyName: string; // Found/standardized company name
  companyLogo?: string | null; // URL
  companyWebsite?: string | null; // URL
  postedAt?: Date | null; // Parsed date
  isRemote?: boolean; // Flag
  hiringRegion?: string | null; // e.g., 'LATAM', 'Global'
  source: string; // Name of the original source (e.g., 'greenhouse')
  sourceId: string; // Job ID from the original source
  rawJobData?: any; // Optional: Original data blob
}

/** Padrão de scraping para fontes não-API */
export interface ScrapePattern {
  id?: string; // PK if stored in DB
  // jobSourceId?: string; // FK to JobSource
  targetField: keyof StandardizedJob | string; // Field in StandardizedJob to populate
  selector: string; // CSS selector
  attribute?: string; // HTML attribute to extract (e.g., 'href'), defaults to textContent
  // Add other details: regex, date formats, cleaning steps...
} 