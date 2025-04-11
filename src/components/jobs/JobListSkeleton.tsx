import React from 'react';

const SkeletonCard = () => (
  <div 
    className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden p-6 animate-pulse"
    data-testid="skeleton-card"
  >
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
      <div className="w-3/4 sm:w-1/2">
        <div className="h-6 bg-gray-300 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-300 rounded w-1/2"></div>
      </div>
      <div className="h-10 w-10 bg-gray-300 rounded-full mt-3 sm:mt-0"></div>
    </div>
    <div className="h-4 bg-gray-300 rounded w-full mb-2"></div>
    <div className="h-4 bg-gray-300 rounded w-5/6 mb-4"></div>
    <div className="flex flex-wrap gap-2">
      <div className="h-5 bg-gray-300 rounded w-16"></div>
      <div className="h-5 bg-gray-300 rounded w-20"></div>
      <div className="h-5 bg-gray-300 rounded w-12"></div>
    </div>
  </div>
);

interface JobListSkeletonProps {
  count?: number;
}

const JobListSkeleton: React.FC<JobListSkeletonProps> = ({ count = 6 }) => {
  return (
    <div className="space-y-6" data-testid="job-list-skeleton">
      {[...Array(count)].map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
};

export default JobListSkeleton; 