import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { JobStatus } from '@prisma/client';

// Limit the number of suggestions returned
const MAX_SUGGESTIONS = 10;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { query } = req.query;

  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    // Require a minimum query length to avoid overly broad searches
    return res.status(200).json({ suggestions: [] });
  }

  const searchTerm = query.trim();

  try {
    // --- Fetch Job Title Suggestions --- 
    const jobTitleSuggestions = await prisma.job.findMany({
      where: {
        status: JobStatus.ACTIVE,
        title: {
          contains: searchTerm, 
          mode: 'insensitive',
        },
      },
      select: {
        title: true,
      },
      distinct: ['title'], // Get unique titles
      take: MAX_SUGGESTIONS, // Limit results
    });

    // --- Fetch Company Name Suggestions --- 
    const companySuggestions = await prisma.job.findMany({
        where: {
            status: JobStatus.ACTIVE,
            company: {
                name: {
                    contains: searchTerm,
                    mode: 'insensitive',
                }
            }
        },
        select: {
            company: {
                select: { name: true }
            }
        },
        distinct: ['companyId'], // Find distinct companies matching the name pattern
        take: MAX_SUGGESTIONS, 
    });

    // --- Combine and Format Suggestions --- 
    let combinedSuggestions: { value: string; type: 'title' | 'company' }[] = [];

    jobTitleSuggestions.forEach(job => {
      combinedSuggestions.push({ value: job.title, type: 'title' });
    });

    // Extract unique company names from the second query results
    const uniqueCompanyNames = new Set<string>();
    companySuggestions.forEach(job => {
        if (job.company?.name) { // Check if company and name exist
            uniqueCompanyNames.add(job.company.name);
        }
    });
    
    uniqueCompanyNames.forEach(name => {
        // Avoid adding if already present as a title suggestion (less likely but possible)
        if (!combinedSuggestions.some(s => s.value === name)) {
             combinedSuggestions.push({ value: name, type: 'company' });
        }
    });

    // Prioritize titles, then add companies, up to the limit
    // Simple deduplication based on value
    const finalSuggestions = Array.from(new Map(combinedSuggestions.map(s => [s.value.toLowerCase(), s])).values())
                                .slice(0, MAX_SUGGESTIONS);

    return res.status(200).json({ suggestions: finalSuggestions });

  } catch (error) {
    console.error('Error fetching suggestions:', error);
    // Avoid sending detailed error messages to the client
    return res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
} 