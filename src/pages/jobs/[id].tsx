// src/pages/jobs/[id].tsx
import { useState, useEffect } from 'react';
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Layout from '@/components/common/Layout';
import { useTrackJobClick } from '@/hooks/useTrackJobClick';
import { PrismaClient } from '@prisma/client';

// --- Job Interface ---
interface Job {
    id: string;
    title: string;
    description: string;
    location: string;
    country?: string;
    createdAt: string;
    publishedAt?: string;
    jobType: string;
    experienceLevel: string;
    workplaceType?: string;
    requirements?: string;
    responsibilities?: string;
    benefits?: string;
    skills?: string[];
    company?: {
        id: string;
        name: string;
        logo: string | null;
        websiteUrl: string | null;
    };
    applicationUrl?: string;
    applicationEmail?: string;
}

// --- Component ---
export default function JobDetailPage({ job, error }: InferGetServerSidePropsType<typeof getServerSideProps>) {
    const router = useRouter();
    const { trackClick } = useTrackJobClick();
    const [isLoading, setIsLoading] = useState(false);
    const [imgError, setImgError] = useState(false);
    
    if (router.isFallback) {
        return (
            <Layout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            </Layout>
        );
    }

    if (error) {
    return (
            <Layout>
                <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                    <div className="px-4 py-5 sm:px-6">
                        <h1 className="text-2xl font-bold text-gray-900">Erro</h1>
                        <p className="mt-2 text-red-600">{error}</p>
                        <button 
                            onClick={() => router.push('/jobs')}
                            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Voltar para vagas
                        </button>
          </div>
        </div>
      </Layout>
    );
  }

    if (!job) {
    return (
            <Layout>
                <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                    <div className="px-4 py-5 sm:px-6">
                        <h1 className="text-2xl font-bold text-gray-900">Vaga não encontrada</h1>
                        <p className="mt-2 text-gray-600">A vaga solicitada não foi encontrada ou está indisponível.</p>
                        <button 
                            onClick={() => router.push('/jobs')}
                            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Voltar para vagas
                        </button>
                    </div>
        </div>
      </Layout>
    );
  }

    // Format date helper
    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleDateString('pt-BR');
        } catch (e) {
            return 'Data indisponível';
        }
    };

    // Format job type
  const formatJobType = (type: string) => {
        const types: Record<string, string> = {
      'FULL_TIME': 'Tempo Integral',
      'PART_TIME': 'Meio Período',
      'CONTRACT': 'Contrato',
      'INTERNSHIP': 'Estágio',
            'FREELANCE': 'Freelance',
        };
        return types[type] || type;
    };

    // Format experience level
    const formatExperienceLevel = (level: string) => {
        const levels: Record<string, string> = {
            'ENTRY': 'Júnior/Trainee',
      'MID': 'Pleno',
      'SENIOR': 'Sênior',
            'DIRECTOR': 'Diretor/Executivo',
        };
        return levels[level] || level;
    };

    // Handle apply click with tracking
    const handleApplyClick = async () => {
        setIsLoading(true);
        
        try {
            // Use applicationUrl as primary, email link as fallback
            const targetUrl = job.applicationUrl || (job.applicationEmail ? `mailto:${job.applicationEmail}` : null);
            
            if (!targetUrl) {
                alert('Esta vaga não possui um link de candidatura disponível.');
                setIsLoading(false);
                return;
            }
            
            const isEmailLink = targetUrl.startsWith('mailto:');
            
            // Track the click and redirect
            await trackClick(job.id, targetUrl, isEmailLink);
            
        } catch (error) {
            console.error('Error when applying:', error);
            alert('Ocorreu um erro ao tentar acessar o link de candidatura. Tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

  return (
    <Layout>
      <Head>
        <title>{job.title} | RemoteJobsBR</title>
        <meta name="description" content={`${job.title} - ${job.company?.name || 'Vaga disponível'} - ${job.location}`} />
      </Head>

      {/* Main container with two columns on larger screens */}
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (Main Job Details) */}
        <div className="lg:col-span-2 bg-white shadow overflow-hidden sm:rounded-lg p-6">
          {/* Job Header - Now includes logo */}
          <div className="flex items-start gap-4 mb-6 border-b pb-6">
            {/* Logo moved here */}
            {job.company && (
                <div className="flex-shrink-0">
                    {job.company.logo && !imgError ? (
                        <Image 
                            src={job.company.logo} 
                            alt={`${job.company.name} logo`} 
                            width={64} // Slightly larger logo in header
                            height={64}
                            className="h-16 w-16 object-contain rounded-md border border-gray-200" 
                            onError={() => setImgError(true)} 
                        />
                    ) : (
                        <div className="h-16 w-16 bg-gray-200 rounded-md flex items-center justify-center text-gray-500 text-xl font-medium">
                            {job.company.name?.substring(0, 2).toUpperCase()}
                        </div>
                    )}
                </div>
            )}
            {/* Title and Metadata */}
            <div className="flex-1">
                <h1 className="text-2xl font-bold leading-tight text-gray-900 sm:text-3xl mb-2">
                {job.title}
                </h1>
                {/* Metadata row */}
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-500">
                {/* Company name is implicitly shown via logo/context, but can be added back if needed */} 
                {/* <span className="inline-flex items-center">...{job.company.name}...</span> */}
                <span className="inline-flex items-center">
                    <svg className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" /><path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" /></svg>
                    {formatJobType(job.jobType)}
                </span>
                <span className="inline-flex items-center">
                    <svg className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                    {job.location}
                </span>
                <span className="inline-flex items-center">
                    <svg className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
                    {formatExperienceLevel(job.experienceLevel)}
                </span>
                <span className="inline-flex items-center">
                    <svg className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
                    Publicada {formatDistanceToNow(new Date(job.publishedAt || job.createdAt), { locale: ptBR, addSuffix: true })}
                </span>
                </div>
            </div>
          </div>
          
          {/* Main Content Sections - Increased spacing */}
          <div className="space-y-8"> {/* Increased from space-y-6 */}
            {job.description && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-3">Descrição da Vaga</h2>
                <div 
                  className="text-gray-700 prose max-w-none prose-headings:font-semibold prose-headings:text-lg prose-p:my-2 prose-ul:my-2 prose-li:marker:text-gray-500"
                  dangerouslySetInnerHTML={{ __html: job.description }}
                />
              </div>
            )}
            {job.requirements && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-3">Requisitos</h2>
                <div 
                  className="text-gray-700 prose max-w-none prose-headings:font-semibold prose-headings:text-lg prose-p:my-2 prose-ul:my-2 prose-li:marker:text-gray-500"
                  dangerouslySetInnerHTML={{ __html: job.requirements }}
                />
              </div>
            )}
            {job.responsibilities && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-3">Responsabilidades</h2>
                <div 
                  className="text-gray-700 prose max-w-none prose-headings:font-semibold prose-headings:text-lg prose-p:my-2 prose-ul:my-2 prose-li:marker:text-gray-500"
                  dangerouslySetInnerHTML={{ __html: job.responsibilities }}
                />
              </div>
            )}
            {job.benefits && (
               <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-3">Benefícios</h2>
                <div 
                  className="text-gray-700 prose max-w-none prose-headings:font-semibold prose-headings:text-lg prose-p:my-2 prose-ul:my-2 prose-li:marker:text-gray-500"
                  dangerouslySetInnerHTML={{ __html: job.benefits }}
                />
              </div>
            )}
             {job.skills && job.skills.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-3">Habilidades</h2>
                 <div className="flex flex-wrap gap-2">
                    {job.skills.map((skill: string, index: number) => (
                      <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                        {skill}
                      </span>
                    ))}
                  </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Sidebar) */}
        <div className="lg:col-span-1 space-y-6">
           {/* Apply Button Card (Sticky) */}
           <div className="bg-white shadow sm:rounded-lg p-6 sticky top-24">
             <button
               type="button"
               onClick={handleApplyClick}
               disabled={isLoading}
               className="w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {isLoading ? (
                 <>
                   <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                   Candidatando...
                 </>
               ) : (
                 <>
                   <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                     <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                     <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                   </svg>
                   Candidatar-se agora
                 </>
               )}
             </button>
           </div>

           {/* Placeholder for similar jobs/other sidebar content */}
           {/* <div className="bg-white shadow sm:rounded-lg p-6"> */}
           {/*   <h3 className="text-lg font-medium text-gray-900 mb-4">Vagas Similares</h3> */}
           {/*   </div> */}

        </div>
        
      </div>
    </Layout>
  );
} 

export const getServerSideProps: GetServerSideProps = async (context) => {
    const { id } = context.params || {};
    
    if (!id || typeof id !== 'string') {
        return {
            props: {
                error: 'ID de vaga inválido.',
            },
        };
    }
    
    try {
        // Fix: Use absolute URL or direct API access for server-side fetching
        // Option 1: For server-side rendering, we can use the internal API directly
        // Import the API handler and call it directly
        const prisma = new PrismaClient();
        
        try {
            const job = await prisma.job.findUnique({
                where: { id },
                include: {
                    company: { // Ensure company website is selected
                        select: {
                            id: true,
                            name: true,
                            logo: true,
                            website: true // Make sure 'website' field is selected
                        }
                    }
                },
            });
    
            if (!job || !job.company) { 
                return {
                    props: {
                        error: 'Vaga ou empresa não encontrada.',
                    },
                };
            }
    
            // Replicate JobCard logo logic
            let finalLogoUrl = job.company.logo || null;
            if (!finalLogoUrl) {
                const companyName = job.company.name;
                const apiToken = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN || ''; // Use correct env var name
                const tokenParam = apiToken ? `?token=${apiToken}` : '';
                
                // Check if the name looks like a domain
                const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/; // More robust domain check
                let domainOrFormattedName = companyName.trim().toLowerCase();

                if (!domainPattern.test(domainOrFormattedName)) {
                    // If not a domain, try to format (add .com if no TLD)
                    if (!domainOrFormattedName.includes('.')) {
                       domainOrFormattedName = domainOrFormattedName.replace(/\s+/g, '') + '.com';
                    } else {
                       // If it has a TLD but isn't a valid domain pattern, maybe just use the name as is?
                       // Or try extracting from website if available?
                       // For now, let's stick to the simple .com addition if no TLD found.
                       console.warn(`Company name "${companyName}" doesn't look like a domain and already contains '.'. Logo might not work.`);
                       domainOrFormattedName = domainOrFormattedName.replace(/\s+/g, ''); // Clean spaces
                    }
                }
                
                finalLogoUrl = `https://img.logo.dev/${domainOrFormattedName}${tokenParam}`;
            }

            // Format job data for client-side consumption
            const jobData = {
                id: job.id,
                title: job.title,
                description: job.description || '',
                createdAt: job.createdAt?.toISOString() || new Date().toISOString(),
                updatedAt: job.updatedAt?.toISOString() || new Date().toISOString(),
                publishedAt: job.publishedAt?.toISOString() || job.createdAt?.toISOString() || new Date().toISOString(),
                jobType: job.jobType || 'FULL_TIME',
                experienceLevel: job.experienceLevel || 'MID',
                skills: job.skills || [],
                location: job.location || 'Remote',
                workplaceType: job.workplaceType || 'REMOTE',
                applicationUrl: job.applicationUrl,
                applicationEmail: job.applicationEmail,
                requirements: job.requirements || '',
                responsibilities: job.responsibilities || '',
                benefits: job.benefits || '',
                country: job.country || undefined,
                company: {
                    id: job.company.id,
                    name: job.company.name,
                    logo: finalLogoUrl, // Use the final URL from JobCard-like logic
                    websiteUrl: job.company.website || null,
                }
            };
    
            return {
                props: {
                    job: jobData,
                },
            };
        } finally {
            await prisma.$disconnect();
        }
        
    } catch (error) {
        console.error('Erro ao buscar detalhes da vaga:', error);
        
        return {
            props: {
                error: 'Ocorreu um erro ao buscar os detalhes desta vaga. Por favor, tente novamente mais tarde.',
            },
        };
    }
};