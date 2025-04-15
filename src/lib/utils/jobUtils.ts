import { JobType, ExperienceLevel } from '@prisma/client';

const COMMON_SKILLS = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'php',
  'react', 'vue', 'angular', 'node.js', 'express', 'django', 'flask',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform',
  'sql', 'mongodb', 'postgresql', 'mysql', 'redis',
  'git', 'ci/cd', 'agile', 'scrum'
];

// Helper function to escape regex special characters
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export function extractSkills(content: string): string[] {
  const contentLower = content.toLowerCase();
  // Escape regex characters in skills and use word boundaries
  return COMMON_SKILLS.filter(skill => 
    new RegExp(`\\b${escapeRegex(skill.toLowerCase())}\\b`).test(contentLower)
  );
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

  // Helper to test keywords with word boundaries (adjusted for sr./jr.)
  const testKeyword = (keyword: string): boolean => {
      const escapedKeyword = escapeRegex(keyword);
      // For sr. and jr., don't require word boundary *after* the dot
      const pattern = (keyword === 'sr.' || keyword === 'jr.')
          ? `\\b${escapedKeyword}` 
          : `\\b${escapedKeyword}\\b`;
      return new RegExp(pattern).test(contentLower);
  };

  // --- Prioritize LEAD level --- 
  const leadKeywords = ['vp', 'director', 'manager', 'lead', 'head of'];
  if (leadKeywords.some(testKeyword)) {
    return ExperienceLevel.LEAD;
  }

  // --- Check for SENIOR level ---
  const seniorKeywords = ['senior', 'sr.', 'principal', 'specialist'];
  if (seniorKeywords.some(testKeyword)) {
    return ExperienceLevel.SENIOR;
  }

  // --- Check for ENTRY level --- 
  const entryKeywords = ['junior', 'jr.', 'entry', 'associate', 'graduate', 'intern', 'internship'];
  if (entryKeywords.some(testKeyword)) {
    // Special case: Avoid classifying "Senior Associate" or "Principal Associate" as ENTRY
    if (contentLower.includes('associate') && 
        (seniorKeywords.some(sk => contentLower.includes(sk)))) { // Use includes for simpler check here
       return ExperienceLevel.SENIOR; 
    }
    return ExperienceLevel.ENTRY;
  }
  
  // --- Default to MID level --- 
  return ExperienceLevel.MID;
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
    // Add more specific non-remote patterns if found
  ];
  
  // Positive patterns (global/remote indicators)
  const remoteIndicators = [
    'fully remote', 'remote work', 'work from anywhere',
    'remote position', 'remote opportunity', 'remote job',
    'work from home', 'trabalho remoto', 'remoto',
    'worldwide', 'global', 'latam', 'latin america' // Include regions often used for remote
  ];
  
  // Check for restrictions first
  if (restrictions.some(pattern => textToCheck.includes(pattern))) {
    return false;
  }
  
  // Then check for remote indicators or common remote locations
  if (remoteIndicators.some(pattern => textToCheck.includes(pattern))) {
      return true;
  }

  // If location explicitly states a remote-friendly region/term
  const locationLower = location.toLowerCase();
  if (['remote', 'worldwide', 'global', 'latam', 'latin america', 'brasil', 'brazil'].some(term => locationLower.includes(term))) {
      return true;
  }
  
  // Default to false if no strong indicators
  return false;
}
