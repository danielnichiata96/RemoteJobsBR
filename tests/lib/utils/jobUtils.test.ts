import {
    extractSkills,
    cleanHtml,
    detectJobType,
    detectExperienceLevel,
    parseSections,
    isRemoteJob,
} from '../../../src/lib/utils/jobUtils';
import { JobType, ExperienceLevel } from '@prisma/client';

describe('jobUtils', () => {

    // --- extractSkills Tests ---
    describe('extractSkills', () => {
        it('should extract known skills from content (case-insensitive)', () => {
            const content = 'We need a React developer proficient in JavaScript and Node.js. Experience with AWS is a plus.';
            const expectedSkills = ['javascript', 'react', 'node.js', 'aws'];
            expect(extractSkills(content)).toEqual(expect.arrayContaining(expectedSkills));
            expect(extractSkills(content).length).toBe(expectedSkills.length);
        });

        it('should return an empty array if no known skills are found', () => {
            const content = 'Looking for a project manager.';
            expect(extractSkills(content)).toEqual([]);
        });

        it('should handle empty content', () => {
            expect(extractSkills('')).toEqual([]);
        });
    });

    // --- cleanHtml Tests ---
    describe('cleanHtml', () => {
        it('should remove HTML tags', () => {
            const html = '<p>Hello <b>World</b>!</p>';
            expect(cleanHtml(html)).toBe('Hello World!');
        });

        it('should decode common HTML entities', () => {
            const html = 'Less than &lt; Greater than &gt; Ampersand &amp; Quote &quot; Apostrophe &#39; Space &nbsp; Here';
            expect(cleanHtml(html)).toBe('Less than < Greater than > Ampersand & Quote " Apostrophe \' Space Here');
        });

        it('should normalize whitespace', () => {
            const html = '  Multiple   spaces\n\nand\n  line breaks.  ';
            expect(cleanHtml(html)).toBe('Multiple spaces\n\nand line breaks.');
        });

        it('should handle empty string', () => {
            expect(cleanHtml('')).toBe('');
        });
    });

    // --- detectJobType Tests ---
    describe('detectJobType', () => {
        it('should detect PART_TIME', () => {
            expect(detectJobType('Looking for a part-time assistant')).toBe(JobType.PART_TIME);
            expect(detectJobType('Part time role available')).toBe(JobType.PART_TIME);
        });

        it('should detect CONTRACT', () => {
            expect(detectJobType('6-month contract position')).toBe(JobType.CONTRACT);
            expect(detectJobType('Seeking an independent contractor')).toBe(JobType.CONTRACT);
        });

        it('should detect INTERNSHIP', () => {
            expect(detectJobType('Summer internship opportunity')).toBe(JobType.INTERNSHIP);
            expect(detectJobType('Apply for our software engineer intern role')).toBe(JobType.INTERNSHIP);
        });
        
        it('should detect FREELANCE', () => {
             expect(detectJobType('Freelance writer needed')).toBe(JobType.FREELANCE);
             expect(detectJobType('Seeking a freelancer for project')).toBe(JobType.FREELANCE);
        });

        it('should default to FULL_TIME', () => {
            expect(detectJobType('Standard software engineer role')).toBe(JobType.FULL_TIME);
            expect(detectJobType('')).toBe(JobType.FULL_TIME);
        });
    });

    // --- detectExperienceLevel Tests ---
    describe('detectExperienceLevel', () => {
        it('should detect LEAD level', () => {
            expect(detectExperienceLevel('VP of Engineering')).toBe(ExperienceLevel.LEAD);
            expect(detectExperienceLevel('Director of Marketing')).toBe(ExperienceLevel.LEAD);
            expect(detectExperienceLevel('Engineering Manager')).toBe(ExperienceLevel.LEAD);
            expect(detectExperienceLevel('Team Lead')).toBe(ExperienceLevel.LEAD);
            expect(detectExperienceLevel('Head of Product')).toBe(ExperienceLevel.LEAD);
        });

        it('should detect SENIOR level', () => {
            expect(detectExperienceLevel('Senior Software Engineer')).toBe(ExperienceLevel.SENIOR);
            expect(detectExperienceLevel('Sr. Data Scientist')).toBe(ExperienceLevel.SENIOR);
            expect(detectExperienceLevel('Principal Architect')).toBe(ExperienceLevel.SENIOR);
            expect(detectExperienceLevel('Senior Associate Consultant')).toBe(ExperienceLevel.SENIOR); // Handles exception
            expect(detectExperienceLevel('UX Specialist')).toBe(ExperienceLevel.SENIOR);
        });

        it('should detect ENTRY level', () => {
            expect(detectExperienceLevel('Junior Developer')).toBe(ExperienceLevel.ENTRY);
            expect(detectExperienceLevel('Jr. Analyst')).toBe(ExperienceLevel.ENTRY);
            expect(detectExperienceLevel('Entry Level Position')).toBe(ExperienceLevel.ENTRY);
            expect(detectExperienceLevel('Associate Engineer')).toBe(ExperienceLevel.ENTRY);
            expect(detectExperienceLevel('Graduate Trainee')).toBe(ExperienceLevel.ENTRY);
            expect(detectExperienceLevel('Marketing Intern')).toBe(ExperienceLevel.ENTRY);
            expect(detectExperienceLevel('Summer Internship')).toBe(ExperienceLevel.ENTRY);
        });

        it('should default to MID level', () => {
            expect(detectExperienceLevel('Software Engineer')).toBe(ExperienceLevel.MID);
            expect(detectExperienceLevel('Product Designer')).toBe(ExperienceLevel.MID);
            expect(detectExperienceLevel('')).toBe(ExperienceLevel.MID);
        });
        
        it('should prioritize LEAD over SENIOR or ENTRY', () => {
            expect(detectExperienceLevel('Senior Engineering Manager')).toBe(ExperienceLevel.LEAD);
            expect(detectExperienceLevel('Lead Junior Developer')).toBe(ExperienceLevel.LEAD);
        });

        it('should prioritize SENIOR over ENTRY (except specific cases)', () => {
            expect(detectExperienceLevel('Senior Associate')).toBe(ExperienceLevel.SENIOR);
            expect(detectExperienceLevel('Principal Junior Engineer')).toBe(ExperienceLevel.SENIOR); // Principal takes precedence
        });
    });

    // --- parseSections Tests ---
    describe('parseSections', () => {
        it('should parse content into sections based on headers', () => {
            const content = 
`Job Overview: This is the description.\n\nResponsibilities:\n- Do thing 1\n- Do thing 2\n\nRequirements:\n* Skill A\n* Skill B\n\nBenefits:\n- Health insurance\n- 401k`;
            const sections = parseSections(content);
            expect(sections.description).toContain('Job Overview');
            expect(sections.responsibilities).toContain('Responsibilities:');
            expect(sections.requirements).toContain('Requirements:');
            expect(sections.benefits).toContain('Benefits:');
        });

        it('should handle missing sections', () => {
            const content = 'Just a description here. Responsibilities: Do stuff.';
            const sections = parseSections(content);
            expect(sections.description).toContain('Just a description here');
            expect(sections.responsibilities).toContain('Responsibilities:');
            expect(sections.requirements).toBe('See job description');
            expect(sections.benefits).toBe(''); // Benefits are optional
        });

        it('should use full content for description if no headers match typical sections', () => {
            const content = 'A single block of text describing the role.';
            const sections = parseSections(content);
            expect(sections.description).toBe(content);
            expect(sections.requirements).toBe('See job description');
            expect(sections.responsibilities).toBe('See job description');
        });

        it('should handle empty content', () => {
            const sections = parseSections('');
            expect(sections.description).toBe('');
            expect(sections.requirements).toBe('See job description');
            expect(sections.responsibilities).toBe('See job description');
            expect(sections.benefits).toBe('');
        });
    });

    // --- isRemoteJob Tests ---
    describe('isRemoteJob', () => {
        it('should return true for explicit remote indicators in description', () => {
            expect(isRemoteJob('New York', 'This is a fully remote position.')).toBe(true);
            expect(isRemoteJob('Anywhere', 'We offer remote work opportunities.')).toBe(true);
            expect(isRemoteJob('London', 'Work from anywhere in the world.')).toBe(true);
            expect(isRemoteJob('Sao Paulo', 'Vaga de trabalho remoto.')).toBe(true);
            expect(isRemoteJob('LATAM', 'Global remote job')).toBe(true);
        });

        it('should return true for explicit remote locations', () => {
            expect(isRemoteJob('Remote', 'Standard job description.')).toBe(true);
            expect(isRemoteJob('Worldwide', 'Develop cool stuff.')).toBe(true);
            expect(isRemoteJob('Global', 'Develop cool stuff.')).toBe(true);
            expect(isRemoteJob('LATAM', 'Develop cool stuff.')).toBe(true);
            expect(isRemoteJob('Latin America', 'Develop cool stuff.')).toBe(true);
            expect(isRemoteJob('Brazil', 'Develop cool stuff.')).toBe(true);
             expect(isRemoteJob('Brasil', 'Develop cool stuff.')).toBe(true);
        });

        it('should return false if restrictive patterns are found', () => {
            expect(isRemoteJob('Remote', 'Must be located in the US.')).toBe(false);
            expect(isRemoteJob('Remote', 'USA only.')).toBe(false);
            expect(isRemoteJob('Remote', 'Must reside in California.')).toBe(false);
            expect(isRemoteJob('Remote', 'Time zone requirement: EST.')).toBe(false);
        });

        it('should return false if no remote indicators or restrictions are found', () => {
            expect(isRemoteJob('New York', 'Office-based role.')).toBe(false);
            expect(isRemoteJob('San Francisco', 'Standard job description.')).toBe(false);
            expect(isRemoteJob('', '')).toBe(false);
        });
    });
}); 