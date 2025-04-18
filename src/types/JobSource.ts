import { Prisma } from '@prisma/client';
import { z } from 'zod';

// Define the available job source types
export type JobSourceType = 'greenhouse' | 'lever' | 'ashby' | 'direct';

// Define the structure for filter configuration
export interface FilterConfig {
  REMOTE_METADATA_FIELDS?: {
    REMOTE_FIELD_PATH: string; // e.g., 'location.name', 'remote', 'custom_fields.office.name'
    REMOTE_FIELD_VALUES: string[]; // e.g., ['Remote', 'true', 'Home Office']
  };
  LOCATION_KEYWORDS?: {
    STRONG_POSITIVE_GLOBAL?: string[];
    STRONG_POSITIVE_LATAM?: string[];
    STRONG_NEGATIVE_RESTRICTION?: string[];
    AMBIGUOUS?: string[];
    ACCEPT_EXACT_LATAM_COUNTRIES?: string[];
    ACCEPT_EXACT_BRAZIL_TERMS?: string[];
  };
  CONTENT_KEYWORDS?: {
    STRONG_POSITIVE_GLOBAL?: string[];
    STRONG_POSITIVE_LATAM?: string[];
    STRONG_NEGATIVE_REGION?: string[];
    STRONG_NEGATIVE_TIMEZONE?: string[];
    ACCEPT_EXACT_BRAZIL_TERMS?: string[];
  };
  PROCESS_JOBS_UPDATED_AFTER_DATE?: string; // Optional ISO date string threshold
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
    ACCEPT_EXACT_LATAM_COUNTRIES: z.array(z.string()).optional(),
    ACCEPT_EXACT_BRAZIL_TERMS: z.array(z.string()).optional()
  }),
  CONTENT_KEYWORDS: z.object({
    STRONG_POSITIVE_GLOBAL: z.array(z.string()),
    STRONG_POSITIVE_LATAM: z.array(z.string()),
    STRONG_NEGATIVE_REGION: z.array(z.string()),
    STRONG_NEGATIVE_TIMEZONE: z.array(z.string()),
    ACCEPT_EXACT_BRAZIL_TERMS: z.array(z.string()).optional()
  })
});

export const GreenhouseConfigSchema = z.object({
  boardToken: z.string().min(1, "Board token is required"),
  filterConfig: z.optional(z.lazy(() => FilterConfigSchema)),
});
export type GreenhouseConfig = z.infer<typeof GreenhouseConfigSchema>;

// Lever Configuration
export const LeverConfigSchema = z.object({
    companyIdentifier: z.string().min(1, "Lever company identifier is required"),
    // Add any Lever-specific filter overrides here if needed in the future
});
export type LeverConfig = z.infer<typeof LeverConfigSchema>;

// Ashby Configuration
export const AshbyConfigSchema = z.object({
  jobBoardName: z.string().min(1, "Ashby job board name is required"),
  // Add any Ashby-specific filter overrides here if needed in the future
});
export type AshbyConfig = z.infer<typeof AshbyConfigSchema>;

// Union type for all possible JobSource configs
export type JobSourceConfig = GreenhouseConfig | LeverConfig | AshbyConfig | Prisma.JsonObject | null;

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

// Helper function for Lever config
export function getLeverConfig(config: Prisma.JsonValue | null): LeverConfig | null {
  const result = LeverConfigSchema.safeParse(config);
  if (result.success) {
      return result.data;
  } else {
      // Use a more robust logging mechanism if available, e.g., pino
      console.error('[getLeverConfig] Invalid Lever config:', result.error.format());
      return null;
  }
}

// Helper function for Ashby config
export function getAshbyConfig(config: Prisma.JsonValue | null): AshbyConfig | null {
  const result = AshbyConfigSchema.safeParse(config);
  if (result.success) {
    return result.data;
  } else {
    console.error('[getAshbyConfig] Invalid Ashby config:', result.error.format());
    return null;
  }
} 