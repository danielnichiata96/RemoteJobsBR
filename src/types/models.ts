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
export interface User extends Omit<PrismaUser, 'createdAt' | 'updatedAt'> {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  avatarUrl: string | null;
  title: string | null;
  location: string | null;
  bio: string | null;
  phone: string | null;

  // Candidate Specific (potentially moved to CandidateProfile)
  resumeUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  desiredSalary: number | null;
  availableForWork: boolean;
  preferredWorkTypes: string[];
  preferredLocations: string[];
  yearsOfExperience: number | null;
  experienceLevel: ExperienceLevel | null;
  skills: string[];
  languages: any[];

  // Company Specific (potentially moved to EmployerProfile/Company)
  description: string | null;
  industry: string | null;
  website: string | null;
  logo: string | null;
  size: string | null;
  foundedYear: number | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  twitterUrl: string | null;
  facebookUrl: string | null;

  // Common / System Fields
  isVerified: boolean;
  subscriptionTier: string | null;
  subscriptionEndsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  // Relationships
  jobs?: Job[];
  savedJobs?: SavedJob[];
  settings?: UserSettings | null;
  socials?: UserSocials | null;
  candidateProfile?: Candidate | null;
  employerProfile?: Employer | null;
  applications?: Application[];
  notifications?: Notification[];
  newsletters?: Newsletter[];
}

/** Candidato: Usuário com papel CANDIDATE */
export interface Candidate extends User {
  role: UserRole.CANDIDATE;
}

/** Empresa: Usuário com papel COMPANY */
export interface Company extends User {
  role: UserRole.COMPANY;
}

/** Modelo de vaga */
export interface Job extends Omit<PrismaJob, 'createdAt' | 'updatedAt' | 'companyId' | 'salaryMin' | 'salaryMax' | 'salaryCurrency' | 'employmentType' | 'experienceLevel'> {
  id: string;
  source: string;
  sourceId: string;
  title: string;
  description: string;
  location: string | null;
  url: string;
  employmentType?: JobType | null;
  experienceLevel?: ExperienceLevel | null;
  department?: string | null;
  skillsRequired?: string[];
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: Currency | null;
  salaryInterval?: SalaryInterval | null;
  companyId: string;
  status: JobStatus;
  postedAt?: Date | null;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;

  logoUrl?: string | null;
  reliabilityScore?: number | null;
  lastScrapedAt?: Date | null;

  company?: Company | null;
  applications?: Application[];
  savedByUsers?: SavedJob[];
  standardizedJob?: StandardizedJob | null;
}

/** Candidatura a uma vaga */
export interface Application {
  id: string;
  jobId: string;
  candidateId: string;
  coverLetter?: string;
  resumeUrl?: string;
  additionalInfo?: string;
  status: ApplicationStatus;
  feedback?: string;
  createdAt: Date;
  updatedAt: Date;
  readByCompany: boolean;
  interviewDate?: Date;

  job?: Job;
  candidate?: Candidate;
}

/** Vagas salvas pelo candidato */
export interface SavedJob extends Omit<PrismaSavedJob, 'candidateId' | 'jobId'> {
  id: string;
  createdAt: Date;

  candidate?: User;
  job?: Job;
}

/** Inscrição em newsletter */
export interface Newsletter {
  id: string;
  email: string;
  name?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  user?: User;
  userId?: string | null;
}

/** Fonte de onde as vagas são originadas (e.g., Greenhouse board) */
export interface JobSource extends Omit<PrismaJobSource, 'createdAt' | 'updatedAt'> {
  id: string;
  name: string;
  baseUrl: string;
  description?: string | null;
  logoUrl: string | null;
  reliabilityScore?: number | null;
  lastScrapedAt?: Date | null;
  scrapeFrequency?: string | null;
  isActive: boolean;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;

  jobs?: Job[];
  scrapePatterns?: ScrapePattern[];
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
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: Record<string, any>;
}

/** Configurações do usuário */
export interface UserSettings {
  prefersDarkMode?: boolean;
  emailNotifications?: boolean;
}

/** Links de redes sociais do usuário */
export interface UserSocials {
  linkedin?: string | null;
  github?: string | null;
  twitter?: string | null;
  portfolio?: string | null;
}

/** Perfil específico do candidato (se não estender User) */
export interface CandidateProfile {
}

/** Perfil específico da empresa (se não estender User) */
export interface Employer {
  verificationStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';
}

/** Formato padronizado de vaga após processamento */
export interface StandardizedJob {
  id?: string;
  title: string;
  description: string;
  location?: string | null;
  url: string;
  employmentType?: JobType | null;
  experienceLevel?: ExperienceLevel | null;
  skillsRequired?: string[];
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: Currency | null;
  salaryInterval?: SalaryInterval | null;
  companyName: string;
  companyLogo?: string | null;
  companyWebsite?: string | null;
  postedAt?: Date | null;
  isRemote?: boolean;
  hiringRegion?: string | null;
  source: string;
  sourceId: string;
  rawJobData?: any;
}

/** Padrão de scraping para fontes não-API */
export interface ScrapePattern {
  id?: string;
  targetField: keyof StandardizedJob | string;
  selector: string;
  attribute?: string;
} 