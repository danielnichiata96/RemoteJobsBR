import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfileView from '@/components/profile/ProfileView';
import { ExperienceLevel } from '@prisma/client';

// Mock complete user data
const mockUserDataComplete = {
  name: 'Complete User',
  title: 'Senior Engineer',
  bio: 'A detailed bio about the complete user.',
  location: 'Complete City, CS',
  phone: '555-1234',
  email: 'complete@example.com',
  linkedinUrl: 'https://linkedin.com/in/complete',
  githubUrl: 'https://github.com/complete',
  portfolioUrl: 'https://complete.dev',
  resumeUrl: 'https://complete.dev/resume.pdf',
  desiredSalary: 120000,
  availableForWork: true,
  yearsOfExperience: 8,
  experienceLevel: ExperienceLevel.SENIOR,
  skills: ['React', 'TypeScript', 'AWS'],
  preferredWorkTypes: ['full-time', 'remote'],
  preferredLocations: ['remote', 'hybrid'],
};

// Mock user data with some missing fields
const mockUserDataPartial = {
  name: 'Partial User',
  email: 'partial@example.com',
  title: null,
  bio: 'Short bio.',
  location: null,
  phone: null,
  linkedinUrl: null,
  githubUrl: 'https://github.com/partial',
  portfolioUrl: null,
  resumeUrl: null,
  desiredSalary: null,
  availableForWork: false,
  yearsOfExperience: 2,
  experienceLevel: ExperienceLevel.ENTRY,
  skills: ['JavaScript'],
  preferredWorkTypes: [], // Empty array
  preferredLocations: ['on-site'],
};

describe('ProfileView Component', () => {
  test('renders correctly with complete user data', () => {
    render(<ProfileView userData={mockUserDataComplete} />);

    // Basic Info
    expect(screen.getByText('Informações Básicas')).toBeInTheDocument();
    expect(screen.getByText(mockUserDataComplete.name)).toBeInTheDocument();
    expect(screen.getByText(mockUserDataComplete.email)).toBeInTheDocument();
    expect(screen.getByText(mockUserDataComplete.title)).toBeInTheDocument();
    expect(screen.getByText(mockUserDataComplete.phone)).toBeInTheDocument();
    expect(screen.getByText(mockUserDataComplete.location)).toBeInTheDocument();
    expect(screen.getByText(mockUserDataComplete.bio)).toBeInTheDocument();

    // Experience
    expect(screen.getByText('Experiência Profissional')).toBeInTheDocument();
    expect(screen.getByText('Sênior (5+ anos)')).toBeInTheDocument(); // Checks label mapping
    expect(screen.getByText(mockUserDataComplete.yearsOfExperience.toString())).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('AWS')).toBeInTheDocument();

    // Preferences
    expect(screen.getByText('Preferências de Trabalho')).toBeInTheDocument();
    expect(screen.getByText('✅ Disponível para novas oportunidades')).toBeInTheDocument();
    expect(screen.getByText(`$${mockUserDataComplete.desiredSalary.toLocaleString()}`)).toBeInTheDocument();
    expect(screen.getByText('Tempo Integral')).toBeInTheDocument(); // Checks label mapping
    expect(screen.getByText('Remoto')).toBeInTheDocument(); // Check duplicate label ok
    expect(screen.getByText('Híbrido')).toBeInTheDocument(); // Checks label mapping

    // Links
    expect(screen.getByText('Links')).toBeInTheDocument();
    const linkedInLink = screen.getByRole('link', { name: mockUserDataComplete.linkedinUrl });
    expect(linkedInLink).toHaveAttribute('href', mockUserDataComplete.linkedinUrl);
    const githubLink = screen.getByRole('link', { name: mockUserDataComplete.githubUrl });
    expect(githubLink).toHaveAttribute('href', mockUserDataComplete.githubUrl);
    const portfolioLink = screen.getByRole('link', { name: mockUserDataComplete.portfolioUrl });
    expect(portfolioLink).toHaveAttribute('href', mockUserDataComplete.portfolioUrl);
    const resumeLink = screen.getByRole('link', { name: /Ver Currículo/i });
    expect(resumeLink).toHaveAttribute('href', mockUserDataComplete.resumeUrl);
  });

  test('renders correctly with partial or missing user data', () => {
    render(<ProfileView userData={mockUserDataPartial} />);

    // Basic Info - Check for placeholders '-'
    expect(screen.getByText(mockUserDataPartial.name)).toBeInTheDocument();
    expect(screen.getByText(mockUserDataPartial.email)).toBeInTheDocument();
    expect(screen.getByText('Título Profissional').nextSibling).toHaveTextContent('-');
    expect(screen.getByText('Telefone').nextSibling).toHaveTextContent('-');
    expect(screen.getByText('Localização').nextSibling).toHaveTextContent('-');
    expect(screen.getByText(mockUserDataPartial.bio)).toBeInTheDocument();

    // Experience
    expect(screen.getByText('Júnior (1-2 anos)')).toBeInTheDocument();
    expect(screen.getByText(mockUserDataPartial.yearsOfExperience.toString())).toBeInTheDocument();
    expect(screen.getByText('JavaScript')).toBeInTheDocument();

    // Preferences
    expect(screen.getByText('❌ Não disponível para novas oportunidades')).toBeInTheDocument();
    expect(screen.getByText('Pretensão Salarial (USD/ano)').nextSibling).toHaveTextContent('-');
    expect(screen.queryByText('Tipos de Trabalho Preferidos')).toBeInTheDocument(); // Section title exists
    // Check that no work types are listed visually (though the section title is there)
    expect(screen.queryByText('Tempo Integral')).not.toBeInTheDocument();
    expect(screen.getByText('Presencial')).toBeInTheDocument(); // Preferred location label

    // Links - Check for placeholders '-' and existing links
    expect(screen.getByText('LinkedIn').nextSibling).toHaveTextContent('-');
    const githubLink = screen.getByRole('link', { name: mockUserDataPartial.githubUrl });
    expect(githubLink).toHaveAttribute('href', mockUserDataPartial.githubUrl);
    expect(screen.getByText('Website/Portfólio').nextSibling).toHaveTextContent('-');
    expect(screen.getByText('Currículo').nextSibling).toHaveTextContent('-');
  });

  test('renders message when userData is null or undefined', () => {
    const { rerender } = render(<ProfileView userData={null} />);
    expect(screen.getByText('Não foi possível carregar os dados do perfil.')).toBeInTheDocument();

    rerender(<ProfileView userData={undefined} />);
    expect(screen.getByText('Não foi possível carregar os dados do perfil.')).toBeInTheDocument();
  });
}); 