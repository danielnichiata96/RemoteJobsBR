import React from 'react';
import { UserRole, ExperienceLevel } from '@prisma/client';

// Re-use options from ProfileForm or define locally if needed
const workTypeOptions = [
  { value: 'full-time', label: 'Tempo Integral' },
  { value: 'part-time', label: 'Meio Período' },
  { value: 'contract', label: 'Contrato' },
  { value: 'freelance', label: 'Freelancer' },
  { value: 'internship', label: 'Estágio' },
];

const locationOptions = [
  { value: 'remote', label: 'Remoto' },
  { value: 'hybrid', label: 'Híbrido' },
  { value: 'on-site', label: 'Presencial' },
];

const experienceLevelOptions = [
  { value: 'ENTRY', label: 'Júnior (1-2 anos)' },
  { value: 'MID', label: 'Pleno (3-5 anos)' },
  { value: 'SENIOR', label: 'Sênior (5+ anos)' },
  { value: 'LEAD', label: 'Líder/Gerente' },
];

// Define a more specific type for user data if possible, or use any
interface ProfileViewProps {
  userData: any; // Replace 'any' with a proper UserProfile type if available
}

// Helper component for displaying profile sections
const ProfileSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h2 className="text-lg font-medium text-gray-900 mb-4">{title}</h2>
    <div className="bg-gray-50 p-4 rounded-md space-y-4">
      {children}
    </div>
  </div>
);

// Helper component for displaying individual fields
const ProfileField: React.FC<{ label: string; value: React.ReactNode | string | null | undefined }> = ({ label, value }) => (
  <div>
    <p className="text-sm text-gray-500">{label}</p>
    <p className="font-medium">{value || '-'}</p>
  </div>
);

const ProfileLinkField: React.FC<{ label: string; href: string | null | undefined; linkText?: string }> = ({ label, href, linkText }) => (
  <div>
    <p className="text-sm text-gray-500">{label}</p>
    {href ? (
      <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="text-blue-600 hover:underline break-all"
      >
        {linkText || href}
      </a>
    ) : (
      <p className="font-medium">-</p>
    )}
  </div>
);

export default function ProfileView({ userData }: ProfileViewProps) {
  if (!userData) {
    return <p>Não foi possível carregar os dados do perfil.</p>; // Or a loading indicator
  }

  const getLabel = (options: { value: string; label: string }[], value: string) => {
    return options.find(opt => opt.value === value)?.label || value;
  };

  return (
    <div className="space-y-8">
      {/* Informações Básicas */}
      <ProfileSection title="Informações Básicas">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ProfileField label="Nome" value={userData.name} />
          <ProfileField label="Email" value={userData.email} />
          <ProfileField label="Título Profissional" value={userData.title} />
          <ProfileField label="Telefone" value={userData.phone} />
          <ProfileField label="Localização" value={userData.location} />
        </div>
        {userData.bio && (
          <div className="mt-4">
            <p className="text-sm text-gray-500">Biografia</p>
            <p className="whitespace-pre-line font-medium">{userData.bio}</p>
          </div>
        )}
      </ProfileSection>

      {/* Experiência Profissional */}
      <ProfileSection title="Experiência Profissional">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ProfileField 
            label="Nível de Experiência" 
            value={getLabel(experienceLevelOptions, userData.experienceLevel)}
          />
          <ProfileField label="Anos de Experiência" value={userData.yearsOfExperience} />
        </div>
        {userData.skills && userData.skills.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-500 mb-2">Habilidades</p>
            <div className="flex flex-wrap gap-2">
              {userData.skills.map((skill: string) => (
                <span key={skill} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm font-medium">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </ProfileSection>

      {/* Preferências de Trabalho */}
      <ProfileSection title="Preferências de Trabalho">
         <div className="mb-4">
            <p className="text-sm text-gray-500">Disponibilidade</p>
            <p className="font-medium">
              {userData.availableForWork 
                ? '✅ Disponível para novas oportunidades' 
                : '❌ Não disponível para novas oportunidades'}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <ProfileField 
               label="Pretensão Salarial (USD/ano)" 
               value={userData.desiredSalary ? `$${userData.desiredSalary.toLocaleString()}` : '-'} 
             />
          </div>

          {/* Always show the label for Preferred Work Types */}
          <div className="mt-4">
            <p className="text-sm text-gray-500 mb-2">Tipos de Trabalho Preferidos</p>
            {userData.preferredWorkTypes && userData.preferredWorkTypes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {userData.preferredWorkTypes.map((type: string) => (
                  <span key={type} className="bg-green-100 text-green-800 px-2 py-1 rounded-md text-sm font-medium">
                    {getLabel(workTypeOptions, type)}
                  </span>
                ))}
              </div>
            ) : (
                <p className="font-medium">-</p> // Show placeholder if empty
            )}
          </div>

          {/* Always show the label for Preferred Locations */}
          <div className="mt-4">
            <p className="text-sm text-gray-500 mb-2">Locais de Trabalho Preferidos</p>
            {userData.preferredLocations && userData.preferredLocations.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {userData.preferredLocations.map((location: string) => (
                  <span key={location} className="bg-purple-100 text-purple-800 px-2 py-1 rounded-md text-sm font-medium">
                    {getLabel(locationOptions, location)}
                  </span>
                ))}
              </div>
            ) : (
                <p className="font-medium">-</p> // Show placeholder if empty
            )}
          </div>
      </ProfileSection>

      {/* Links */}
      <ProfileSection title="Links">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProfileLinkField label="LinkedIn" href={userData.linkedinUrl} />
            <ProfileLinkField label="GitHub" href={userData.githubUrl} />
            <ProfileLinkField label="Website/Portfólio" href={userData.portfolioUrl} />
            <ProfileLinkField label="Currículo" href={userData.resumeUrl} linkText="Ver Currículo" />
         </div>
      </ProfileSection>
    </div>
  );
} 