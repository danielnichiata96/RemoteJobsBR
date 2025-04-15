import { normalizeForDeduplication, stripHtml, parseDate } from '../../../src/lib/utils/textUtils';

describe('textUtils', () => {
  describe('normalizeForDeduplication', () => {
    it('should convert text to lowercase', () => {
      expect(normalizeForDeduplication('Software Engineer')).toBe('software engineer');
    });

    it('should remove basic punctuation', () => {
      expect(normalizeForDeduplication('Senior Software Engineer (Backend)!')).toBe('senior software engineer backend');
      expect(normalizeForDeduplication('Lead/Staff Engineer - $100k+')).toBe('lead staff engineer 100k');
      expect(normalizeForDeduplication('Job Title [Remote]')).toBe('job title remote');
    });

    it('should collapse multiple whitespace characters to single spaces', () => {
      expect(normalizeForDeduplication('  Extra   Spaces  \nNew Line\tTab ')).toBe('extra spaces new line tab');
    });

    it('should trim leading/trailing whitespace', () => {
      expect(normalizeForDeduplication('  Trimmed String  ')).toBe('trimmed string');
    });

    it('should handle combined normalization steps', () => {
      expect(normalizeForDeduplication('  SENIOR Full-Stack Engineer, (React/Node.js) - Brazil?  ')).toBe('senior full stack engineer react node js brazil');
    });

    it('should return empty string for null or undefined input', () => {
      expect(normalizeForDeduplication(null)).toBe('');
      expect(normalizeForDeduplication(undefined)).toBe('');
    });

    it('should return empty string for empty input string', () => {
      expect(normalizeForDeduplication('')).toBe('');
    });
  });

  // TODO: Add tests for stripHtml and parseDate if they don't exist elsewhere or need more coverage
  // describe('stripHtml', () => { ... });
  // describe('parseDate', () => { ... });
}); 