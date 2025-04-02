import { Prisma } from '@prisma/client';

// Define the structure for filter configuration
export interface FilterConfig {
  REMOTE_METADATA_FIELDS: {
    [key: string]: FilterMetadataConfig;
  };
  LOCATION_KEYWORDS: {
    STRONG_POSITIVE_GLOBAL: string[];
    STRONG_POSITIVE_LATAM: string[];
    STRONG_NEGATIVE_RESTRICTION: string[];
    AMBIGUOUS: string[];
  };
  CONTENT_KEYWORDS: {
    STRONG_POSITIVE_GLOBAL: string[];
    STRONG_POSITIVE_LATAM: string[];
    STRONG_NEGATIVE_REGION: string[];
    STRONG_NEGATIVE_TIMEZONE: string[];
  };
}

export type FilterMetadataConfig = 
  | { type: 'boolean'; positiveValue: string }
  | { type: 'string'; positiveValues?: string[]; allowedValues?: string[]; disallowedValues?: string[] };

export interface GreenhouseConfig {
  boardToken: string;
  filterConfig?: FilterConfig;
}

// Helper functions to work with JobSource config
export function getGreenhouseConfig(config: Prisma.JsonValue | null): GreenhouseConfig | null {
  if (!config) return null;
  
  try {
    // Check if config is an object with a boardToken property
    if (typeof config === 'object' && config !== null && !Array.isArray(config) && 'boardToken' in config) {
      return config as unknown as GreenhouseConfig;
    }
  } catch (error) {
    console.error('Failed to parse config:', error);
  }
  
  return null;
} 