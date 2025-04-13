import { Prisma } from '@prisma/client';
import { z } from 'zod';

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
    ACCEPT_EXACT_LATAM_COUNTRIES?: string[];
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

// Define the shape of the config JSON for Greenhouse
export const FilterConfigSchema = z.object({
  REMOTE_METADATA_FIELDS: z.record(z.union([
    z.object({ type: z.literal('boolean'), positiveValue: z.string() }),
    z.object({
      type: z.literal('string'),
      positiveValues: z.array(z.string()).optional(),
      allowedValues: z.array(z.string()).optional(),
      disallowedValues: z.array(z.string()).optional()
    })
  ])),
  LOCATION_KEYWORDS: z.object({
    STRONG_POSITIVE_GLOBAL: z.array(z.string()),
    STRONG_POSITIVE_LATAM: z.array(z.string()),
    STRONG_NEGATIVE_RESTRICTION: z.array(z.string()),
    AMBIGUOUS: z.array(z.string()),
    ACCEPT_EXACT_LATAM_COUNTRIES: z.array(z.string()).optional()
  }),
  CONTENT_KEYWORDS: z.object({
    STRONG_POSITIVE_GLOBAL: z.array(z.string()),
    STRONG_POSITIVE_LATAM: z.array(z.string()),
    STRONG_NEGATIVE_REGION: z.array(z.string()),
    STRONG_NEGATIVE_TIMEZONE: z.array(z.string())
  })
});

export const GreenhouseConfigSchema = z.object({
  boardToken: z.string().min(1, "Board token is required"),
  filterConfig: z.optional(z.lazy(() => FilterConfigSchema)),
});
export type GreenhouseConfig = z.infer<typeof GreenhouseConfigSchema>;

// Define the shape of the config JSON for Ashby
export const AshbyConfigSchema = z.object({
    jobBoardName: z.string().min(1, "Job board name (slug) is required"),
    // Add other Ashby-specific config fields if needed
});
export type AshbyConfig = z.infer<typeof AshbyConfigSchema>;

// Lever Configuration
export interface LeverConfig {
  companyIdentifier: string;
  // Add any Lever-specific filter overrides here if needed in the future
}

// Helper function to safely parse and validate Greenhouse config
export function getGreenhouseConfig(config: any): GreenhouseConfig | null {
  const result = GreenhouseConfigSchema.safeParse(config);
  if (result.success) {
    return result.data;
  } else {
    console.error("Invalid Greenhouse config:", result.error.format());
    return null;
  }
}

// Helper function to safely parse and validate Ashby config
export function getAshbyConfig(config: any): AshbyConfig | null {
    const result = AshbyConfigSchema.safeParse(config);
    if (result.success) {
      return result.data;
    } else {
      console.error("Invalid Ashby config:", result.error.format());
      return null;
    }
  }

// Helper function for Lever config
export function getLeverConfig(config: Prisma.JsonValue | null): LeverConfig | null {
  if (!config) return null;

  try {
    // Check if config is an object with a companyIdentifier property
    if (typeof config === 'object' && config !== null && !Array.isArray(config) && 'companyIdentifier' in config) {
      // Basic validation: ensure companyIdentifier is a non-empty string
      if (typeof (config as any).companyIdentifier === 'string' && (config as any).companyIdentifier.trim() !== '') {
         return config as unknown as LeverConfig;
      }
    }
  } catch (error) {
    // Use a more robust logging mechanism if available, e.g., pino
    console.error('[getLeverConfig] Failed to parse config:', error);
  }

  return null;
} 