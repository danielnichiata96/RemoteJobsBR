import { JobType, ExperienceLevel } from '@prisma/client';

const COMMON_SKILLS = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'php',
  'react', 'vue', 'angular', 'node.js', 'express', 'django', 'flask',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform',
  'sql', 'mongodb', 'postgresql', 'mysql', 'redis',
  'git', 'ci/cd', 'agile', 'scrum'
];

export function extractSkills(content: string): string[] {
  const contentLower = content.toLowerCase();
  return COMMON_SKILLS.filter(skill => contentLower.includes(skill.toLowerCase()));
}

export function cleanHtml(html: string): string {
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ')
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'");
  
  // Fix multiple spaces and line breaks
  text = text.replace(/\s+/g, ' ')
             .replace(/\n\s*\n/g, '\n\n')
             .trim();
  
  return text;
}

export function detectJobType(content: string): JobType {
  const contentLower = content.toLowerCase();
  
  if (contentLower.includes('part time') || contentLower.includes('part-time')) {
    return 'PART_TIME';
  }
  if (contentLower.includes('contract') || contentLower.includes('contractor')) {
    return 'CONTRACT';
  }
  if (contentLower.includes('internship') || contentLower.includes('intern ')) {
    return 'INTERNSHIP';
  }
  if (contentLower.includes('freelance') || contentLower.includes('freelancer')) {
    return 'FREELANCE';
  }
  
  return 'FULL_TIME';
}

export function detectExperienceLevel(content: string): ExperienceLevel {
  const contentLower = content.toLowerCase();
  
  if (contentLower.includes('senior') || contentLower.includes('sr.') || 
      contentLower.includes('lead') || contentLower.includes('principal')) {
    return 'SENIOR';
  }
  if (contentLower.includes('junior') || contentLower.includes('jr.') || 
      contentLower.includes('entry') || contentLower.includes('graduate')) {
    return 'ENTRY';
  }
  if (contentLower.includes('manager') || contentLower.includes('director') || 
      contentLower.includes('head of')) {
    return 'LEAD';
  }
  
  return 'MID';
}

export function parseSections(content: string): {
  description: string;
  requirements: string;
  responsibilities: string;
  benefits?: string;
} {
  const sections = {
    description: '',
    requirements: '',
    responsibilities: '',
    benefits: ''
  };

  // Split content into sections based on common headers
  const contentBlocks = content.split(/\n(?=[A-Z][a-z]+ *:|\d+\.)/);
  
  for (const block of contentBlocks) {
    const blockLower = block.toLowerCase();
    
    if (blockLower.includes('requirements') || blockLower.includes('qualifications')) {
      sections.requirements += block;
    }
    else if (blockLower.includes('responsibilities') || blockLower.includes('what you\'ll do')) {
      sections.responsibilities += block;
    }
    else if (blockLower.includes('benefits') || blockLower.includes('what we offer')) {
      sections.benefits += block;
    }
    else {
      sections.description += block;
    }
  }

  // If any section is empty, use the full content
  if (!sections.requirements) sections.requirements = 'See job description';
  if (!sections.responsibilities) sections.responsibilities = 'See job description';
  if (!sections.description) sections.description = content;

  return sections;
}

export function isRemoteJob(location: string, description: string): boolean {
  const textToCheck = `${location} ${description}`.toLowerCase();
  
  // Negative patterns (restrictions)
  const restrictions = [
    'us only', 'usa only', 'united states only',
    'must be located in', 'must reside in',
    'timezone requirement', 'time zone requirement'
  ];
  
  // Positive patterns (global/remote indicators)
  const remoteIndicators = [
    'fully remote', 'remote work', 'work from anywhere',
    'remote position', 'remote opportunity', 'remote job',
    'work from home', 'trabalho remoto', 'remoto'
  ];
  
  // Check for restrictions first
  if (restrictions.some(pattern => textToCheck.includes(pattern))) {
    return false;
  }
  
  // Then check for remote indicators
  return remoteIndicators.some(pattern => textToCheck.includes(pattern));
}
