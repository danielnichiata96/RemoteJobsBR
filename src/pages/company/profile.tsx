import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Layout from '@/components/common/Layout';
import { UserRole } from '@prisma/client';

type CompanyFormData = {
  name: string;
  description: string;
  industry: string;
  companySize: string;
  location: string;
  website: string;
  logoUrl: string;
  linkedinUrl: string;
  twitterUrl: string;
  email: string;
  phone: string;
};

const companySizeOptions = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '501-1000', label: '501-1000 employees' },
  { value: '1001+', label: '1001+ employees' },
];

const industryOptions = [
  { value: 'technology', label: 'Technology & Software' },
  { value: 'finance', label: 'Finance & Banking' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education', label: 'Education' },
  { value: 'ecommerce', label: 'E-commerce & Retail' },
  { value: 'marketing', label: 'Marketing & Advertising' },
  { value: 'media', label: 'Media & Entertainment' },
  { value: 'nonprofit', label: 'Nonprofit & NGO' },
  { value: 'other', label: 'Other' },
];

export default function CompanyProfile(props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', content: '' });
  const [userData, setUserData] = useState<any>(null);
  const [formData, setFormData] = useState<CompanyFormData>({
    name: '',
    description: '',
    industry: '',
    companySize: '',
    location: '',
    website: '',
    logoUrl: '',
    linkedinUrl: '',
    twitterUrl: '',
    email: '',
    phone: '',
  });

  // Redirect if not authenticated or not a company
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?returnTo=/company/profile');
    } else if (status === 'authenticated' && 
      session?.user?.role !== 'COMPANY' && 
      session?.user?.role !== 'company') {
      router.replace('/dashboard');
    }
  }, [status, router, session]);

  // Fetch user data
  useEffect(() => {
    if (session?.user?.email) {
      fetchUserData();
    }
  }, [session]);

  const fetchUserData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/user/profile');
      if (!response.ok) throw new Error('Failed to load profile');
      
      const data = await response.json();
      setUserData(data);
      
      // Fill form with user data
      setFormData({
        name: data.name || '',
        description: data.bio || '',
        industry: data.industry || '',
        companySize: data.companySize || '',
        location: data.location || '',
        website: data.website || '',
        logoUrl: data.logoUrl || '',
        linkedinUrl: data.linkedinUrl || '',
        twitterUrl: data.twitterUrl || '',
        email: data.email || '',
        phone: data.phone || '',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        content: 'Error loading profile. Please try again.'
      });
      console.error('Error fetching profile data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: '', content: '' });

    try {
      // Update the profile data on the server
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          bio: formData.description,
          industry: formData.industry,
          companySize: formData.companySize, 
          location: formData.location,
          website: formData.website,
          logoUrl: formData.logoUrl,
          linkedinUrl: formData.linkedinUrl,
          twitterUrl: formData.twitterUrl,
          email: formData.email,
          phone: formData.phone,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update profile');
      }

      const result = await response.json();
      setUserData(result);
      setMessage({
        type: 'success',
        content: 'Profile updated successfully!'
      });
      setIsEditing(false);
    } catch (error: any) {
      setMessage({
        type: 'error',
        content: error.message || 'Error updating profile. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <Layout title="Company Profile | RemoteJobsBR">
        <div className="min-h-screen bg-gray-50 py-10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Company Profile | RemoteJobsBR">
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold text-gray-900">Company Profile</h1>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {isEditing ? 'Cancel' : 'Edit Profile'}
                </button>
              </div>
            </div>

            {message.content && (
              <div className={`p-4 mb-6 rounded-md ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {message.content}
              </div>
            )}

            {isEditing ? (
              <form onSubmit={handleSubmit} className="px-4 py-5 sm:p-6 space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Company Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Company Description
                  </label>
                  <textarea
                    name="description"
                    id="description"
                    rows={4}
                    value={formData.description}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="industry" className="block text-sm font-medium text-gray-700">
                      Industry
                    </label>
                    <select
                      id="industry"
                      name="industry"
                      value={formData.industry}
                      onChange={handleInputChange}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="">Select an industry</option>
                      {industryOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="companySize" className="block text-sm font-medium text-gray-700">
                      Company Size
                    </label>
                    <select
                      id="companySize"
                      name="companySize"
                      value={formData.companySize}
                      onChange={handleInputChange}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="">Select company size</option>
                      {companySizeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                      Location
                    </label>
                    <input
                      type="text"
                      name="location"
                      id="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="e.g. San Francisco, CA, USA"
                    />
                  </div>

                  <div>
                    <label htmlFor="website" className="block text-sm font-medium text-gray-700">
                      Website
                    </label>
                    <input
                      type="url"
                      name="website"
                      id="website"
                      value={formData.website}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="https://example.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-700">
                      Logo URL
                    </label>
                    <input
                      type="url"
                      name="logoUrl"
                      id="logoUrl"
                      value={formData.logoUrl}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="https://example.com/logo.png"
                    />
                  </div>

                  <div>
                    <label htmlFor="linkedinUrl" className="block text-sm font-medium text-gray-700">
                      LinkedIn URL
                    </label>
                    <input
                      type="url"
                      name="linkedinUrl"
                      id="linkedinUrl"
                      value={formData.linkedinUrl}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="https://linkedin.com/company/example"
                    />
                  </div>

                  <div>
                    <label htmlFor="twitterUrl" className="block text-sm font-medium text-gray-700">
                      Twitter URL
                    </label>
                    <input
                      type="url"
                      name="twitterUrl"
                      id="twitterUrl"
                      value={formData.twitterUrl}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="https://twitter.com/example"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      id="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="contact@example.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      id="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>

                <div className="pt-5">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="mr-3 bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {isLoading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="px-4 py-5 sm:p-6">
                <dl className="grid grid-cols-1 gap-y-8 gap-x-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Company Name</dt>
                    <dd className="mt-1 text-sm text-gray-900">{userData?.name || 'Not specified'}</dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Industry</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {userData?.industry ? 
                        industryOptions.find(option => option.value === userData.industry)?.label || userData.industry 
                        : 'Not specified'}
                    </dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Company Size</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {userData?.companySize ? 
                        companySizeOptions.find(option => option.value === userData.companySize)?.label || userData.companySize 
                        : 'Not specified'}
                    </dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Location</dt>
                    <dd className="mt-1 text-sm text-gray-900">{userData?.location || 'Not specified'}</dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Website</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {userData?.website ? (
                        <a href={userData.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500">
                          {userData.website}
                        </a>
                      ) : 'Not specified'}
                    </dd>
                  </div>
                  
                  {userData?.linkedinUrl && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">LinkedIn</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        <a href={userData.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500">
                          {userData.linkedinUrl}
                        </a>
                      </dd>
                    </div>
                  )}
                  
                  {userData?.twitterUrl && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Twitter</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        <a href={userData.twitterUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500">
                          {userData.twitterUrl}
                        </a>
                      </dd>
                    </div>
                  )}
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Contact Email</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {userData?.email ? (
                        <a href={`mailto:${userData.email}`} className="text-blue-600 hover:text-blue-500">
                          {userData.email}
                        </a>
                      ) : 'Not specified'}
                    </dd>
                  </div>
                  
                  {userData?.phone && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Contact Phone</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        <a href={`tel:${userData.phone}`} className="text-blue-600 hover:text-blue-500">
                          {userData.phone}
                        </a>
                      </dd>
                    </div>
                  )}
                  
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Company Description</dt>
                    <dd className="mt-1 text-sm text-gray-900 whitespace-pre-line">
                      {userData?.bio || 'No description provided.'}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
} 