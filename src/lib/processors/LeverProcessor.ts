import { LeverJob, LeverApiResponse } from '../types/LeverTypes'; // Use specific Lever types
import { StandardizedJob } from '../../types/StandardizedJob';
import { BaseJobProcessor } from './BaseJobProcessor';
// import { Currency } from '@prisma/client'; // REMOVE this import

// ... existing code ...

      const { salaryMin, salaryMax, salaryCycle, currency } = this._extractSalaryInfo(
        job.categories.compensation || '',
      );

      return {
        id: `lever-${job.id}`, // Use a unique identifier for the source
        source: 'lever',
        sourceId: job.id,
        sourceUrl: job.hostedUrl,
        title: job.text,
        companyName: companyIdentifier, // Assuming jobSource.name holds the company identifier for Lever
        companyLogoUrl: '', // Lever API doesn't provide company logo per job
        description: job.description,
        requirements: job.lists
          .find((list) => list.text.toLowerCase().includes('requirements'))
          ?.content.replace(/<[^>]*>/g, ''), // Basic HTML stripping
        responsibilities: job.lists
          .find((list) => list.text.toLowerCase().includes('responsibilities'))
          ?.content.replace(/<[^>]*>/g, ''), // Basic HTML stripping
        jobType: this._mapJobType(job.categories.commitment),
        experienceLevel: this._mapExperienceLevel(job.text), // Placeholder - Lever doesn't standardize this well
        location: job.categories.location || 'Remote', // Default to Remote if not specified
        country: this._extractCountry(job.categories.location),
        workplaceType: this._mapWorkplaceType(job.categories.location),
        skills: job.categories.skill ? [job.categories.skill] : [], // Lever skill tag is often singular
        tags: [job.categories.team, job.categories.department].filter(Boolean) as string[], // Use team/department as tags
        minSalary: salaryMin,
        maxSalary: salaryMax,
        currency: currency,
        salaryCycle: salaryCycle || undefined, // Map null to undefined
        showSalary: !!salaryMin || !!salaryMax,
        publishedAt: new Date(job.createdAt),
        updatedAt: new Date(job.updatedAt || job.createdAt),
        expiresAt: job.archivedAt ? new Date(job.archivedAt) : undefined,
        applicationUrl: job.applyUrl || job.hostedUrl, // Fallback to hosted URL if apply URL isn't present
        // ... other fields as needed, set defaults or map from Lever data
      };
    } catch (error) {
      // ... existing code ...
    }
  }

  // ... existing code ...

  // --- Helper Methods ---

  private _extractSalaryInfo(compensationText: string): {
    salaryMin: number | null;
    salaryMax: number | null;
    salaryCycle: string | null;
    currency: string | null; // Change Currency enum to string
  } {
    // ... existing code ...
    const currencyMatch = compensationText.match(/[A-Z]{3}/i); // Simple 3-letter code match
    currency = currencyMatch ? currencyMatch[0].toUpperCase() : null;

    return { salaryMin, salaryMax, salaryCycle, currency };
  }

  // ... existing code ...

} 