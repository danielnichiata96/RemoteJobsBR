import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import { JobType, ExperienceLevel, Currency, JobStatus } from '@prisma/client'; // Import enums

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { 
        page = '1', 
        limit = '20',
        search = '',
        jobTypes = [],
        experienceLevels = [],
        industries = [],
        locations = []
      } = req.query;
      
      // Convert params
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;
      
      // --- Helper Functions for Filter Building --- 
      const parseStringArray = (param: string | string[] | undefined): string[] => {
        if (!param) return [];
        if (Array.isArray(param)) return param;
        return [param];
      };

      const currentJobTypes = parseStringArray(jobTypes);
      const currentExperienceLevels = parseStringArray(experienceLevels);
      const currentIndustries = parseStringArray(industries);
      const currentLocations = parseStringArray(locations);
      
      const mapToJobTypeEnum = (type: string): JobType | undefined => {
        const mapping: Record<string, JobType> = {
          'full-time': JobType.FULL_TIME,
          'part-time': JobType.PART_TIME,
          'contract': JobType.CONTRACT,
          'internship': JobType.INTERNSHIP,
          'freelance': JobType.FREELANCE,
          // Allow passing enum values directly
          'FULL_TIME': JobType.FULL_TIME,
          'PART_TIME': JobType.PART_TIME,
          'CONTRACT': JobType.CONTRACT,
          'INTERNSHIP': JobType.INTERNSHIP,
          'FREELANCE': JobType.FREELANCE,
        };
        return mapping[type];
      };
      
      const mapToExperienceLevelEnum = (level: string): ExperienceLevel | undefined => {
        const mapping: Record<string, ExperienceLevel> = {
          'entry': ExperienceLevel.ENTRY,
          'mid': ExperienceLevel.MID,
          'senior': ExperienceLevel.SENIOR,
          'lead': ExperienceLevel.LEAD,
           // Allow passing enum values directly
          'ENTRY': ExperienceLevel.ENTRY,
          'MID': ExperienceLevel.MID,
          'SENIOR': ExperienceLevel.SENIOR,
          'LEAD': ExperienceLevel.LEAD,
        };
        return mapping[level];
      };

      // --- Build Base Filter (Search) --- 
      const searchFilter = search 
        ? {
            OR: [
              { title: { contains: search as string, mode: 'insensitive' } },
              { description: { contains: search as string, mode: 'insensitive' } },
              { skills: { has: search as string } },
              { company: { name: { contains: search as string, mode: 'insensitive' } } }
            ]
          }
        : {};
        
      const baseWhere = {
        status: JobStatus.ACTIVE,
        ...searchFilter,
      };

      // --- Build Individual Filter Clauses --- 
      const jobTypeFilter = currentJobTypes.length > 0
        ? { jobType: { in: currentJobTypes.map(mapToJobTypeEnum).filter(Boolean) as JobType[] } }
        : {};

      const experienceLevelFilter = currentExperienceLevels.length > 0
        ? { experienceLevel: { in: currentExperienceLevels.map(mapToExperienceLevelEnum).filter(Boolean) as ExperienceLevel[] } }
        : {};

      const industryFilter = currentIndustries.length > 0
        ? { company: { industry: { in: currentIndustries } } }
        : {};

      const locationFilter = currentLocations.length > 0
        ? buildLocationFilter(currentLocations)
        : {};
      
      // --- Combine Filters for Job Fetching --- 
      const whereForJobs = {
        ...baseWhere,
        ...jobTypeFilter,
        ...experienceLevelFilter,
        ...industryFilter,
        ...locationFilter,
      };
      
      // --- Fetch Jobs and Total Count for Pagination --- 
      const totalJobs = await prisma.job.count({ where: whereForJobs });
      const jobs = await prisma.job.findMany({
        where: whereForJobs,
        orderBy: [
          { publishedAt: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: skip,
        take: limitNum,
        select: {
          id: true,
          source: true,
          sourceId: true,
          companyId: true,
          title: true,
          description: true,
          requirements: true,
          responsibilities: true,
          benefits: true,
          jobType: true,
          experienceLevel: true,
          skills: true,
          location: true,
          country: true,
          workplaceType: true,
          minSalary: true,
          maxSalary: true,
          currency: true,
          salaryCycle: true,
          showSalary: true,
          status: true,
          visas: true,
          languages: true,
          applicationUrl: true,
          applicationEmail: true,
          createdAt: true,
          updatedAt: true,
          publishedAt: true,
          expiresAt: true,
          viewCount: true,
          applicantCount: true,
          company: {
            select: {
              id: true,
              name: true,
              logo: true,
              industry: true,
              isVerified: true
            }
          },
        }
      });

      // --- Calculate Filter Counts (Aggregations) --- 
      const calculateCounts = async (groupByField: any, filterToExclude: any) => {
        const whereForCounts = {
            ...baseWhere, // Start with search
             // Include other active filters, but exclude the one we're grouping by
            ...(filterToExclude !== jobTypeFilter && jobTypeFilter),
            ...(filterToExclude !== experienceLevelFilter && experienceLevelFilter),
            ...(filterToExclude !== industryFilter && industryFilter),
            ...(filterToExclude !== locationFilter && locationFilter),
        };
        const results = await prisma.job.groupBy({
          by: [groupByField],
          where: whereForCounts,
          _count: { _all: true },
        });
        // Convert results array to a Record<string, number>
        return results.reduce((acc, item) => {
          const key = item[groupByField];
          if (key !== null && key !== undefined) { // Handle potential nulls from groupBy
            acc[String(key)] = item._count._all;
          }
          return acc;
        }, {} as Record<string, number>);
      };
      
      // Calculate counts for each filter type
      const jobTypeCounts = await calculateCounts('jobType', jobTypeFilter);
      const experienceLevelCounts = await calculateCounts('experienceLevel', experienceLevelFilter);

      // Industry counts require grouping by related field
      const industryCountsResult = await prisma.job.groupBy({
        by: ['companyId'], // Need companyId first
        where: {
          ...baseWhere,
          ...(jobTypeFilter),
          ...(experienceLevelFilter),
          // ...(industryFilter), // Exclude industry filter itself for counting
          ...(locationFilter),
          company: { industry: { not: null } } // Ensure industry exists
        },
        _count: { _all: true },
      });
      // Fetch company industries for the grouped IDs
      const companyIdsForIndustry = industryCountsResult.map(item => item.companyId);
      const companiesWithIndustry = await prisma.user.findMany({
        where: { id: { in: companyIdsForIndustry }, industry: { not: null } },
        select: { id: true, industry: true }
      });
      const companyIndustryMap = new Map(companiesWithIndustry.map(c => [c.id, c.industry!]));
      // Aggregate counts by industry name
      const industryCounts = industryCountsResult.reduce((acc, item) => {
        const industry = companyIndustryMap.get(item.companyId);
        if (industry) {
          acc[industry] = (acc[industry] || 0) + item._count._all;
        }
        return acc;
      }, {} as Record<string, number>);
      
       // Location Counts (Simplified: Count jobs matching each region type given other filters)
      const locationCounts = { worldwide: 0, latam: 0, brazil: 0 };
      const locationWhereBase = {
          ...baseWhere,
          ...jobTypeFilter,
          ...experienceLevelFilter,
          ...industryFilter,
          // No locationFilter here, we apply specific ones
      };
      locationCounts.worldwide = await prisma.job.count({ where: { ...locationWhereBase, ...buildLocationFilter(['worldwide']) } });
      locationCounts.latam = await prisma.job.count({ where: { ...locationWhereBase, ...buildLocationFilter(['latam']) } });
      locationCounts.brazil = await prisma.job.count({ where: { ...locationWhereBase, ...buildLocationFilter(['brazil']) } });

      const filterCounts = {
        jobTypes: jobTypeCounts,
        experienceLevels: experienceLevelCounts,
        industries: industryCounts,
        locations: locationCounts,
      };

      // --- Format Jobs for Frontend --- 
      const formattedJobs = jobs.map(job => {
        // Clean up the location data - override US-specific locations with general "Remote" indication
        let cleanedLocation = job.location;
        if (cleanedLocation && (
            cleanedLocation.includes("US-") || 
            cleanedLocation.includes("United States") ||
            cleanedLocation.includes("Seattle") ||
            cleanedLocation.includes("San Francisco") ||
            cleanedLocation.includes("New York") ||
            cleanedLocation.includes("Chicago")
        )) {
          cleanedLocation = job.country === 'LATAM' ? 'Remote - Latin America' : 'Remote - Worldwide';
        }
        
        return {
          id: job.id,
          title: job.title,
          company: job.company.name || 'Empresa',
          companyLogo: job.company.logo || null,
          companyVerified: job.company.isVerified,
          location: cleanedLocation,
          description: truncateDescription(job.description),
          jobType: formatJobType(job.jobType),
          experienceLevel: formatExperienceLevel(job.experienceLevel),
          tags: job.skills,
          salary: job.showSalary && job.minSalary && job.maxSalary 
            ? formatSalary(job.minSalary, job.maxSalary, job.currency, job.salaryCycle) 
            : null,
          createdAt: job.createdAt,
          publishedAt: job.publishedAt,
          applicationUrl: job.applicationUrl,
          industry: job.company.industry || 'tech',
          regionType: determineRegionType(cleanedLocation, job.country),
          source: job.source,
          workplaceType: job.workplaceType
        };
      });
      
      // --- Return Response --- 
      return res.status(200).json({
        jobs: formattedJobs,
        pagination: {
          total: totalJobs,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(totalJobs / limitNum)
        },
        filterCounts
      });

    } catch (error) {
      console.error('Error fetching jobs:', error);
      if (error instanceof Error) {
           console.error(error.message);
           // Basic check for Prisma-related errors (adjust codes as needed)
           if ('code' in error && typeof error.code === 'string' && error.code.startsWith('P')) { 
               console.error(`Prisma Error Code: ${error.code}`);
               // Potentially return a more specific error message based on the code
               return res.status(500).json({ error: 'Database error occurred while fetching jobs.' });
           }
       }
      // Generic error for other cases
      return res.status(500).json({ error: 'Failed to fetch jobs' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// --- Helper Functions (Keep existing ones) --- 

function truncateDescription(description: string, maxLength: number = 200): string {
    if (!description) return '';
    if (description.length <= maxLength) return description;
    return description.substring(0, maxLength) + '...';
}

function formatJobType(jobType: JobType | null): string {
    if (!jobType) return '-'; // Return '-' or some default if null
    // Return the enum key itself, frontend will map labels if needed
    return jobType; 
}

function formatExperienceLevel(level: ExperienceLevel | null): string {
    if (!level) return '-';
    // Return the enum key itself, frontend will map labels if needed
    return level;
}

function formatSalary(min: number, max: number, currency: Currency | null, cycle: string | null): string {
    const currencySymbol = getCurrencySymbol(currency || Currency.BRL); // Default to BRL
    const formattedMin = Math.round(min).toLocaleString('pt-BR'); 
    const formattedMax = Math.round(max).toLocaleString('pt-BR');
    const period = cycle ? `/${cycle.toLowerCase()}` : '';
    return `${currencySymbol} ${formattedMin} - ${formattedMax}${period}`;
}

function getCurrencySymbol(currency: Currency): string {
    const symbols: Record<Currency, string> = {
        [Currency.USD]: '$',
        [Currency.EUR]: '€',
        [Currency.BRL]: 'R$'
    };
    return symbols[currency] || currency;
}

// Keep determineRegionType and buildLocationFilter as they are used for counts and formatting
function determineRegionType(location: string, country: string): string {
  const locationLower = location?.toLowerCase() || '';
  const countryLower = country?.toLowerCase() || '';
  
  if (locationLower.includes('brazil') || countryLower.includes('brazil') || 
      locationLower.includes('brasil') || countryLower.includes('brasil')) {
    return 'brazil';
  }
  
  if (locationLower.includes('latin america') || locationLower.includes('latam') ||
      countryLower.includes('latin america') || countryLower.includes('latam') ||
      ['argentina', 'mexico', 'colombia', 'chile', 'peru'].some(
        c => locationLower.includes(c) || countryLower.includes(c)
      )) {
    return 'latam';
  }
  
  return 'worldwide';
}

function buildLocationFilter(locations: string[]): Record<string, any> {
  if (!locations || locations.length === 0) return {};
  
  const conditions: any[] = []; 
  
  if (locations.includes('brazil')) {
    conditions.push(
      { location: { contains: 'Brazil', mode: 'insensitive' } },
      { location: { contains: 'Brasil', mode: 'insensitive' } },
      { country: { contains: 'Brazil', mode: 'insensitive' } },
      { country: { contains: 'Brasil', mode: 'insensitive' } }
    );
  }
  
  if (locations.includes('latam')) {
    conditions.push(
      { location: { contains: 'Latin America', mode: 'insensitive' } },
      { location: { contains: 'LATAM', mode: 'insensitive' } },
      { country: { contains: 'Latin America', mode: 'insensitive' } },
      { country: { contains: 'LATAM', mode: 'insensitive' } },
      // Add specific LATAM countries if needed for broader match
      { country: { in: ['AR', 'MX', 'CO', 'CL', 'PE'], mode: 'insensitive' } }, // Example using country codes
    );
  }
  
  if (locations.includes('worldwide')) {
    conditions.push(
      // Consider jobs explicitly marked worldwide or remote without specific region
      { country: { in: ['Worldwide', 'Global'], mode: 'insensitive' } }, 
      { location: { contains: 'Remote', mode: 'insensitive' } },
      // Add a condition to potentially exclude jobs already matched by Brazil/LATAM if only worldwide is selected?
      // This logic can be complex. Simplest is OR.
    );
  }
  
  return conditions.length > 0 ? { OR: conditions } : {};
} 