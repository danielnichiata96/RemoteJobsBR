import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';

export default function EditJob(props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;
  const [job, setJob] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Fetch job data when component mounts
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/recruiter');
      return;
    }

    if (id && status === 'authenticated') {
      fetchJobData();
    }
  }, [id, status]);

  const fetchJobData = async () => {
    try {
      const response = await fetch(`/api/recruiter/jobs/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch job data');
      }
      const data = await response.json();
      setJob(data);
    } catch (error) {
      console.error('Error fetching job:', error);
      setFormError('Failed to load job data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError('');

    const formData = new FormData(e.currentTarget);
    
    const jobData = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      requirements: formData.get('requirements') as string,
      responsibilities: formData.get('responsibilities') as string,
      benefits: formData.get('benefits') as string || undefined,
      jobType: formData.get('jobType') as string,
      experienceLevel: formData.get('experienceLevel') as string,
      location: formData.get('location') as string,
      country: formData.get('country') as string,
      workplaceType: formData.get('workplaceType') as string,
      skills: (formData.get('skills') as string)?.split(',').map(s => s.trim()).filter(Boolean) || [],
      tags: (formData.get('skills') as string)?.split(',').map(s => s.trim()).filter(Boolean) || [],
      languages: job?.languages || [],
      status: formData.get('status') as string || job?.status,
      source: 'direct',
      applicationUrl: formData.get('applicationUrl') as string || null,
      applicationEmail: formData.get('applicationEmail') as string || null,
      showSalary: formData.get('showSalary') === 'on',
      minSalary: formData.get('minSalary') ? parseInt(formData.get('minSalary') as string) : null,
      maxSalary: formData.get('maxSalary') ? parseInt(formData.get('maxSalary') as string) : null,
      currency: formData.get('currency') as string || 'BRL',
      salaryCycle: formData.get('salaryCycle') as string || 'month',
    };

    try {
      const response = await fetch(`/api/recruiter/jobs/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jobData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Error updating job');
      }

      router.push('/recruiter/dashboard/jobs');
    } catch (error: any) {
      console.error('Error caught:', error);
      setFormError(error.message || 'An error occurred while updating the job');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Edit Job | RemoteJobsBR</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <Link href="/" className="text-blue-600 text-xl font-bold hover:text-blue-700">
                    RemoteJobsBR
                  </Link>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <Link href="/recruiter/dashboard" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                    Dashboard
                  </Link>
                  <Link href="/recruiter/dashboard/jobs" className="border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                    My Jobs
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="md:flex md:items-center md:justify-between mb-6">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">Edit Job</h2>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4">
              <Link 
                href="/recruiter/dashboard/jobs" 
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </Link>
            </div>
          </div>

          {formError && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{formError}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <form onSubmit={handleSubmit}>
              <div className="px-4 py-5 bg-white sm:p-6">
                <div className="grid grid-cols-6 gap-6">
                  <div className="col-span-6">
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">Job Title *</label>
                    <input
                      type="text"
                      name="title"
                      id="title"
                      required
                      defaultValue={job?.title}
                      className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      placeholder="Ex: Senior React Developer"
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor="jobType" className="block text-sm font-medium text-gray-700">Contract Type *</label>
                    <select
                      id="jobType"
                      name="jobType"
                      required
                      defaultValue={job?.jobType}
                      className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="FULL_TIME">Full Time</option>
                      <option value="PART_TIME">Part Time</option>
                      <option value="CONTRACT">Contract</option>
                      <option value="INTERNSHIP">Internship</option>
                      <option value="FREELANCE">Freelance</option>
                    </select>
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor="experienceLevel" className="block text-sm font-medium text-gray-700">Experience Level *</label>
                    <select
                      id="experienceLevel"
                      name="experienceLevel"
                      required
                      defaultValue={job?.experienceLevel}
                      className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="ENTRY">Entry Level</option>
                      <option value="MID">Mid Level</option>
                      <option value="SENIOR">Senior Level</option>
                      <option value="LEAD">Lead/Manager</option>
                    </select>
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor="location" className="block text-sm font-medium text-gray-700">Location *</label>
                    <input
                      type="text"
                      name="location"
                      id="location"
                      required
                      defaultValue={job?.location}
                      className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      placeholder="Ex: Remote, São Paulo"
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor="country" className="block text-sm font-medium text-gray-700">Company Country *</label>
                    <input
                      type="text"
                      name="country"
                      id="country"
                      required
                      defaultValue={job?.country || "Brazil"}
                      className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>

                  <div className="col-span-6">
                    <label htmlFor="workplaceType" className="block text-sm font-medium text-gray-700">Work Model *</label>
                    <select
                      id="workplaceType"
                      name="workplaceType"
                      required
                      defaultValue={job?.workplaceType}
                      className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="remote">Remote</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="office">On-site</option>
                    </select>
                  </div>

                  <div className="col-span-6">
                    <label htmlFor="skills" className="block text-sm font-medium text-gray-700">Technical Skills (comma separated) *</label>
                    <input
                      type="text"
                      name="skills"
                      id="skills"
                      required
                      defaultValue={job?.skills?.join(', ')}
                      className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      placeholder="Ex: React, Node.js, TypeScript"
                    />
                  </div>

                  <div className="col-span-6">
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">Job Description *</label>
                    <textarea
                      id="description"
                      name="description"
                      rows={4}
                      required
                      defaultValue={job?.description}
                      className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      placeholder="Describe the job in detail..."
                    ></textarea>
                  </div>

                  <div className="col-span-6">
                    <label htmlFor="requirements" className="block text-sm font-medium text-gray-700">Requirements *</label>
                    <textarea
                      id="requirements"
                      name="requirements"
                      rows={4}
                      required
                      defaultValue={job?.requirements}
                      className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      placeholder="List the job requirements..."
                    ></textarea>
                  </div>

                  <div className="col-span-6">
                    <label htmlFor="responsibilities" className="block text-sm font-medium text-gray-700">Responsibilities</label>
                    <textarea
                      id="responsibilities"
                      name="responsibilities"
                      rows={4}
                      defaultValue={job?.responsibilities}
                      className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      placeholder="Describe the job responsibilities..."
                    ></textarea>
                  </div>

                  <div className="col-span-6">
                    <label htmlFor="benefits" className="block text-sm font-medium text-gray-700">Benefits</label>
                    <textarea
                      id="benefits"
                      name="benefits"
                      rows={4}
                      defaultValue={job?.benefits}
                      className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      placeholder="List the benefits offered..."
                    ></textarea>
                  </div>

                  <div className="col-span-6">
                    <label htmlFor="applicationUrl" className="block text-sm font-medium text-gray-700">Application URL</label>
                    <input
                      type="url"
                      name="applicationUrl"
                      id="applicationUrl"
                      defaultValue={job?.applicationUrl}
                      className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      placeholder="Ex: https://yourcompany.com/careers/apply"
                    />
                  </div>

                  <div className="col-span-6">
                    <label htmlFor="applicationEmail" className="block text-sm font-medium text-gray-700">Application Email</label>
                    <input
                      type="email"
                      name="applicationEmail"
                      id="applicationEmail"
                      defaultValue={job?.applicationEmail}
                      className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      placeholder="Ex: jobs@yourcompany.com"
                    />
                  </div>

                  <div className="col-span-6">
                    <div className="flex items-center">
                      <input
                        id="showSalary"
                        name="showSalary"
                        type="checkbox"
                        defaultChecked={job?.showSalary}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="showSalary" className="ml-2 block text-sm text-gray-700">
                        Show Salary Range
                      </label>
                    </div>
                  </div>

                  <div className="col-span-6 sm:col-span-2">
                    <label htmlFor="minSalary" className="block text-sm font-medium text-gray-700">Minimum Salary</label>
                    <input
                      type="number"
                      name="minSalary"
                      id="minSalary"
                      defaultValue={job?.minSalary}
                      className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      placeholder="Ex: 5000"
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-2">
                    <label htmlFor="maxSalary" className="block text-sm font-medium text-gray-700">Maximum Salary</label>
                    <input
                      type="number"
                      name="maxSalary"
                      id="maxSalary"
                      defaultValue={job?.maxSalary}
                      className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      placeholder="Ex: 8000"
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-2">
                    <label htmlFor="currency" className="block text-sm font-medium text-gray-700">Currency</label>
                    <select
                      id="currency"
                      name="currency"
                      defaultValue={job?.currency || "BRL"}
                      className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="BRL">BRL (R$)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>

                  <div className="col-span-6">
                    <label htmlFor="salaryCycle" className="block text-sm font-medium text-gray-700">Salary Period</label>
                    <select
                      id="salaryCycle"
                      name="salaryCycle"
                      defaultValue={job?.salaryCycle || "month"}
                      className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="month">Per Month</option>
                      <option value="year">Per Year</option>
                      <option value="hour">Per Hour</option>
                    </select>
                  </div>

                  <div className="col-span-6">
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
                    <select
                      id="status"
                      name="status"
                      defaultValue={job?.status}
                      className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="ACTIVE">Active</option>
                      <option value="PAUSED">Paused</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
} 