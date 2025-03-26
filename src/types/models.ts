/**
 * Modelos de dados para o RemoteJobsBR
 * Define as estruturas de dados utilizadas no sistema
 */

// USUÁRIOS

/** Papéis de usuário no sistema */
export enum UserRole {
  CANDIDATE = 'candidate',
  COMPANY = 'company',
  ADMIN = 'admin',
}

/** Tipos de vaga */
export enum JobType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERNSHIP = 'INTERNSHIP',
  FREELANCE = 'FREELANCE',
}

/** Nível de experiência */
export enum ExperienceLevel {
  ENTRY = 'ENTRY',
  MID = 'MID',
  SENIOR = 'SENIOR',
  LEAD = 'LEAD',
}

/** Status da vaga */
export enum JobStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  CLOSED = 'closed',
  FILLED = 'filled',
}

/** Moedas disponíveis */
export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  BRL = 'BRL',
}

/** Status de candidatura */
export enum ApplicationStatus {
  SUBMITTED = 'submitted',
  SCREENING = 'screening',
  INTERVIEW = 'interview',
  TECHNICAL_TEST = 'technical_test',
  OFFER = 'offer',
  HIRED = 'hired',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
}

/** Interface básica de usuário */
export interface User {
  id: string;
  email: string;
  name: string;
  password?: string;
  image?: string;
  role: UserRole;
  emailVerified?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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
export interface Job {
  id: string;
  companyId: string;
  
  // Informações básicas
  title: string;
  description: string;
  requirements: string;
  responsibilities: string;
  benefits?: string;
  
  // Classificação
  jobType: JobType;
  experienceLevel: ExperienceLevel;
  skills: string[];
  tags: string[];
  
  // Localização
  location: string;
  country: string;
  workplaceType: string; // 'remote', 'hybrid', 'on-site'
  
  // Remuneração
  minSalary?: number;
  maxSalary?: number;
  currency?: Currency;
  salaryCycle?: string; // 'hourly', 'monthly', 'yearly'
  showSalary: boolean;
  
  // Metadados
  status: JobStatus;
  visas?: string[]; // Tipos de visto aceitos
  languages: string[]; // Idiomas necessários
  applicationUrl?: string; // URL para aplicação externa
  applicationEmail?: string; // Email para receber aplicações
  
  // Datas
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  expiresAt?: Date;
  
  // Métricas
  viewCount: number;
  applicantCount: number;
  
  // Relacionamentos
  company?: Company;
  applications?: Application[];
  savedBy?: SavedJob[];
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
export interface SavedJob {
  id: string;
  jobId: string;
  candidateId: string;
  createdAt: Date;
  
  // Relacionamentos
  job?: Job;
  candidate?: Candidate;
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