/**
 * Modelos de dados para o RemoteJobsBR
 * Define as estruturas de dados utilizadas no sistema
 */

import { User as PrismaUser, Job as PrismaJob, Company as PrismaCompany, JobSource as PrismaJobSource, SavedJob as PrismaSavedJob } from '@prisma/client';

// USUÁRIOS

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

/** Interface básica de usuário */
export interface User extends Omit<PrismaUser, 'password' | 'emailVerified' | 'createdAt' | 'updatedAt' | 'accounts' | 'sessions' | 'newsletter' | 'resetTokens' | 'jobs' | 'savedJobs' | 'applications'> {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  role: UserRole;
  isActive: boolean;
  title?: string | null;
  bio?: string | null;
  location?: string | null;
  phone?: string | null;
  resumeUrl?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  desiredSalary?: number | null;
  availableForWork: boolean;
  preferredWorkTypes: string[];
  preferredLocations: string[];
  yearsOfExperience?: number | null;
  experienceLevel?: ExperienceLevel | null;
  skills: string[];
  languages: any[]; // Assuming JSON is parsed to any[]
  description?: string | null;
  industry?: string | null;
  website?: string | null;
  logo?: string | null;
  size?: string | null;
  foundedYear?: number | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  twitterUrl?: string | null;
  isVerified: boolean;
  subscriptionTier?: string | null;
  subscriptionEndsAt?: Date | string | null; // Allow string for form input
  jobs?: Job[];
  savedJobs?: SavedJob[];
}

/** Candidato: extensão do usuário */
export interface Candidate extends User {
  role: UserRole.CANDIDATE;
  
  // Perfil profissional
  title?: string; // Ex: "Desenvolvedor Full-Stack"
  bio?: string;
  location?: string;
  phone?: string;
  
  // Informações profissionais
  resumeUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  
  // Preferências
  desiredSalary?: number;
  availableForWork: boolean;
  preferredWorkTypes: string[]; // ['full-time', 'part-time', 'contract']
  preferredLocations: string[]; // ['remote', 'hybrid', 'on-site']
  
  // Experiência
  yearsOfExperience?: number;
  experienceLevel?: ExperienceLevel;
  skills: string[];
  languages: {
    language: string;
    proficiency: string; // 'basic', 'intermediate', 'advanced', 'native'
  }[];
  
  // Relacionamentos
  applications?: Application[];
  savedJobs?: SavedJob[];
  newsletters?: Newsletter[];
}

/** Empresa: extensão do usuário */
export interface Company extends User {
  role: UserRole.COMPANY;
  
  // Perfil da empresa
  logo?: string;
  website?: string;
  description?: string;
  industry?: string;
  location?: string;
  foundedYear?: number;
  size?: string; // '1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'
  
  // Contato
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  
  // Redes sociais
  linkedinUrl?: string;
  twitterUrl?: string;
  facebookUrl?: string;
  
  // Verificação
  isVerified: boolean;
  
  // Relacionamentos
  jobs?: Job[];
  applications?: Application[];
}

// VAGAS

/** Modelo de vaga */
export interface Job extends Omit<PrismaJob, 'companyId' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'expiresAt' | 'company' | 'savedBy' | 'applications'> {
  id: string;
  source: string;
  sourceId?: string | null;
  sourceLogo?: string | null;
  sourceUrl?: string | null;
  title: string;
  description: string;
  requirements?: string | null;
  responsibilities?: string | null;
  benefits?: string | null;
  jobType?: JobType | null;
  experienceLevel?: ExperienceLevel | null;
  skills: string[];
  tags: string[];
  location: string;
  country?: string | null;
  workplaceType: string;
  minSalary?: number | null;
  maxSalary?: number | null;
  currency?: Currency | null;
  salaryCycle?: string | null;
  showSalary: boolean;
  status: JobStatus;
  viewCount: number;
  clickCount: number;
  company?: User;
  savedBy?: SavedJob[];
  publishedAt?: string | Date | null;
  updatedAt?: string | Date | null;
  expiresAt?: string | Date | null;
  createdAt?: string | Date | null;
}

// CANDIDATURAS

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
  
  // Relacionamentos
  job?: Job;
  candidate?: Candidate;
}

/** Vagas salvas pelo candidato */
export interface SavedJob extends Omit<PrismaSavedJob, 'candidateId' | 'jobId' | 'createdAt'> {
  id: string;
  candidate?: User;
  job?: Job;
  createdAt?: Date | string;
}

// NEWSLETTER

/** Inscrição em newsletter */
export interface Newsletter {
  id: string;
  email: string;
  name?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Relacionamentos
  user?: User;
}

/**
 * Validações necessárias para cada modelo:
 * 
 * User:
 * - Email: formato válido, único no sistema
 * - Senha: mínimo 8 caracteres, incluir números e caracteres especiais
 * 
 * Candidate:
 * - Skills: ao menos 1 habilidade
 * - URL's: formato válido
 * 
 * Company:
 * - WebSite: formato URL válido
 * - Contato: ao menos email ou telefone preenchido
 * 
 * Job:
 * - Título: entre 5 e 100 caracteres
 * - Descrição: mínimo 100 caracteres
 * - Salário: maxSalary deve ser maior que minSalary
 * - Data expiração: deve ser futura
 * 
 * Application:
 * - Carta de apresentação: máximo 5000 caracteres
 * 
 * Newsletter:
 * - Email: formato válido, único no sistema
 * - Frequência: valor deve estar entre as opções permitidas
 */

// Assuming Company information is stored within the User model with role 'COMPANY'
export interface CompanyProfile extends User {
  role: UserRole.COMPANY;
}

export interface JobSource extends PrismaJobSource {
  id: string;
  name: string;
  type: string;
  isEnabled: boolean;
  url?: string | null;
  logoUrl?: string | null;
  config: any; // Prisma JSON maps to 'any'
  createdAt: Date | string;
  updatedAt: Date | string;
  lastFetched?: Date | string | null;
}

/**
 * Represents the structure for API responses containing lists of items
 * with pagination information.
 */
export interface PaginatedResponse<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
}

/**
 * Represents common query parameters for fetching lists.
 */
export interface ListQueryOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: Record<string, any>; // Generic filter object
}

/**
 * Represents the structure for API responses containing lists of items
 * with pagination information.
 */
export interface PaginatedResponse<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
}

/**
 * Represents common query parameters for fetching lists.
 */
export interface ListQueryOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: Record<string, any>; // Generic filter object
}

// --- Model Specific Notes ---
/*
 * User:
 * - Represents both Candidates and Companies (Recruiters) distinguished by 'role'.
 * - Company-specific fields are included but could be normalized further.
 * - Sensitive fields like 'password' are omitted.
 *
 * Job:
 * - Aligned with aggregator model: `sourceUrl` is key for external applications.
 * - `applicationUrl` and `applicationEmail` are removed.
 * - `clickCount` added for tracking.
 * - `applicantCount` and `applications` relation removed.
 *
 * Application: (REMOVED)
 * - No longer needed as applications happen externally.
 *
 * CompanyProfile:
 * - Type alias for User with role 'COMPANY'.
 *
 * SavedJob:
 * - Links User (Candidate) and Job.
 *
 * JobSource:
 * - Stores information about external job sources like Greenhouse boards.
*/ 