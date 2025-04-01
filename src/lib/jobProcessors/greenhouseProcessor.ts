import { JobProcessor, StandardizedJob, ProcessedJobResult } from './types';
import { 
  extractSkills, 
  cleanHtml, 
  detectJobType, 
  detectExperienceLevel,
  parseSections,
  isRemoteJob 
} from '../utils/jobUtils';

interface GreenhouseJob {
  id: number;
  title: string;
  updated_at: string;
  location: {
    name: string;
  };
  content: string;
  absolute_url: string;
  metadata: Array<{
    id: number;
    name: string;
    value: string | string[];
  }>;
  departments: Array<{
    name: string;
  }>;
  company: {
    name: string;
    boardToken: string;
    logo?: string;
    website?: string;
  };
}

export class GreenhouseProcessor implements JobProcessor {
  source = 'greenhouse';

  async processJob(rawJob: GreenhouseJob): Promise<ProcessedJobResult> {
    try {
      // Check if job is remote
      if (!isRemoteJob(rawJob.location.name, rawJob.content)) {
        return {
          success: false,
          error: 'Job is not remote or has location restrictions'
        };
      }

      // Clean and process the content
      const cleanContent = cleanHtml(rawJob.content);
      const sections = parseSections(cleanContent);
      const skills = extractSkills(cleanContent);

      const standardizedJob: StandardizedJob = {
        sourceId: `${rawJob.id}`,
        title: rawJob.title,
        description: sections.description,
        requirements: sections.requirements,
        responsibilities: sections.responsibilities,
        benefits: sections.benefits,
        jobType: detectJobType(cleanContent),
        experienceLevel: detectExperienceLevel(cleanContent),
        skills,
        tags: [...skills], // Use skills as tags
        location: rawJob.location.name,
        country: 'Worldwide', // Default for remote jobs
        workplaceType: 'REMOTE',
        applicationUrl: rawJob.absolute_url,
        sourceUrl: rawJob.absolute_url,
        sourceLogo: rawJob.company.logo,
        company: {
          name: rawJob.company.name,
          email: `${rawJob.company.boardToken}@greenhouse.example.com`,
          logo: rawJob.company.logo,
          website: rawJob.company.website,
          industry: 'Technology'
        }
      };

      return {
        success: true,
        job: standardizedJob
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error processing job'
      };
    }
  }
} 