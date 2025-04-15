import { decode } from 'html-entities';

/**
 * Removes HTML tags and decodes HTML entities from a string.
 * Also normalizes whitespace, collapsing multiple spaces/newlines into single spaces,
 * but preserving double newlines as paragraph breaks.
 * 
 * @param html The HTML string to clean.
 * @returns The cleaned text string.
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';

  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities using 'html-entities' library for better coverage
  text = decode(text);
  
  // Normalize line endings
  text = text.replace(/\r\n|\r/g, '\n');
  
  // Temporarily replace double newlines to preserve them
  const placeholder = '__DOUBLE_NEWLINE_PLACEHOLDER__'; // Make placeholder more unique
  text = text.replace(/\n\s*\n/g, placeholder); // Capture double newlines even with spaces between
  
  // Collapse all other whitespace (including single newlines) to single spaces
  text = text.replace(/\s+/g, ' ');
  
  // Restore double newlines
  text = text.replace(new RegExp(placeholder, 'g'), '\n\n'); // Use the unique placeholder
  
  text = text.trim();
  
  return text;
}

/**
 * Parses a date string into a JavaScript Date object.
 * Returns undefined if the input is null, undefined, or not a valid date.
 * 
 * @param dateString The date string to parse
 * @returns A Date object or undefined if invalid
 */
export function parseDate(dateString: string | undefined | null): Date | undefined {
  if (!dateString) return undefined;
  
  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? undefined : date;
  } catch (err) {
    return undefined;
  }
}

// Placeholder for parseDate if needed later - not found in jobUtils.ts
// export function parseDate(dateString: string | null | undefined): Date | undefined {
//   // Implementation here
// } 