import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfileForm from '@/components/profile/ProfileForm';
import { ExperienceLevel } from '@prisma/client';

// Mock initial data for the form
const mockInitialData = {
  name: 'Test User',
  title: 'Test Developer',
  bio: 'Test bio content.',
  location: 'Test City, Test State',
  phone: '1234567890',
  email: 'test@example.com',
  linkedinUrl: 'https://linkedin.com/in/testuser',
  githubUrl: 'https://github.com/testuser',
  portfolioUrl: 'https://testuser.com',
  resumeUrl: 'https://testuser.com/resume.pdf',
  desiredSalary: '50000',
  availableForWork: true,
  yearsOfExperience: '3',
  experienceLevel: ExperienceLevel.MID,
  skills: 'React, Node.js',
  preferredWorkTypes: ['full-time', 'remote'],
  preferredLocations: ['remote'],
};

describe('ProfileForm Component', () => {
  let mockOnSubmit: jest.Mock;
  let mockOnCancel: jest.Mock;

  beforeEach(() => {
    mockOnSubmit = jest.fn().mockResolvedValue(undefined); // Mock onSubmit as an async function
    mockOnCancel = jest.fn();
  });

  test('renders correctly with initial data', () => {
    render(
      <ProfileForm
        initialData={mockInitialData}
        isLoading={false}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Check a few key fields to ensure initial data is loaded
    expect(screen.getByLabelText(/Nome Completo/i)).toHaveValue(mockInitialData.name);
    expect(screen.getByLabelText(/Título Profissional/i)).toHaveValue(mockInitialData.title);
    expect(screen.getByLabelText(/Email/i)).toHaveValue(mockInitialData.email);
    expect(screen.getByLabelText(/Email/i)).toBeDisabled(); // Email should be disabled
    expect(screen.getByLabelText(/Biografia/i)).toHaveValue(mockInitialData.bio);
    expect(screen.getByLabelText(/Habilidades/i)).toHaveValue(mockInitialData.skills);
    expect(screen.getByLabelText(/Disponível para novas oportunidades/i)).toBeChecked();
    expect(screen.getByLabelText(/^Tempo Integral$/i)).toBeChecked();
  });

  test('handles input changes and submits updated data', async () => {
    render(
      <ProfileForm
        initialData={mockInitialData}
        isLoading={false}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const nameInput = screen.getByLabelText(/Nome Completo/i);
    const titleInput = screen.getByLabelText(/Título Profissional/i);
    const skillsInput = screen.getByLabelText(/Habilidades/i);
    const submitButton = screen.getByRole('button', { name: /Salvar Perfil/i });

    // Simulate user typing
    fireEvent.change(nameInput, { target: { value: 'Updated Test User' } });
    fireEvent.change(titleInput, { target: { value: 'Senior Test Developer' } });
    fireEvent.change(skillsInput, { target: { value: 'React, Node.js, TypeScript' } });

    // Simulate form submission
    fireEvent.click(submitButton);

    // Wait for submit handler to be called
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    // Check if onSubmit was called with the updated data
    expect(mockOnSubmit).toHaveBeenCalledWith({
      ...mockInitialData,
      name: 'Updated Test User', // Updated value
      title: 'Senior Test Developer', // Updated value
      skills: 'React, Node.js, TypeScript', // Updated value
    });
  });

  test('handles checkbox changes', async () => {
     render(
       <ProfileForm
         initialData={mockInitialData} // Starts as true
         isLoading={false}
         onSubmit={mockOnSubmit}
         onCancel={mockOnCancel}
       />
     );
 
     const availabilityCheckbox = screen.getByLabelText(/Disponível para novas oportunidades/i);
     const submitButton = screen.getByRole('button', { name: /Salvar Perfil/i });
 
     // Uncheck the box
     fireEvent.click(availabilityCheckbox);
     expect(availabilityCheckbox).not.toBeChecked();
 
     fireEvent.click(submitButton);
 
     await waitFor(() => {
       expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
         availableForWork: false, // Should be updated to false
       }));
     });
   });

   test('handles multi-select changes', async () => {
     render(
       <ProfileForm
         initialData={mockInitialData} // Includes 'full-time'
         isLoading={false}
         onSubmit={mockOnSubmit}
         onCancel={mockOnCancel}
       />
     );
 
     // Use getByLabelText to find checkboxes
     const partTimeCheckbox = screen.getByLabelText(/^Meio Período$/i);
     const fullTimeCheckbox = screen.getByLabelText(/^Tempo Integral$/i);

     const submitButton = screen.getByRole('button', { name: /Salvar Perfil/i });
 
     // Check 'Part-time' and uncheck 'Full-time'
     fireEvent.click(partTimeCheckbox);
     fireEvent.click(fullTimeCheckbox);
 
     fireEvent.click(submitButton);
 
     await waitFor(() => {
       expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
         preferredWorkTypes: expect.arrayContaining(['remote', 'part-time']), // Added 'part-time'
         preferredWorkTypes: expect.not.arrayContaining(['full-time']), // Removed 'full-time'
       }));
       // Ensure the final array has the correct length
       expect(mockOnSubmit.mock.calls[0][0].preferredWorkTypes).toHaveLength(2); 
     });
   });

  test('calls onCancel when Cancel button is clicked', () => {
    render(
      <ProfileForm
        initialData={mockInitialData}
        isLoading={false}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /Cancelar/i });
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  test('disables buttons when isLoading is true', () => {
    render(
      <ProfileForm
        initialData={mockInitialData}
        isLoading={true} // Set loading to true
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const submitButton = screen.getByRole('button', { name: /Salvando.../i }); // Text changes when loading
    const cancelButton = screen.getByRole('button', { name: /Cancelar/i });

    expect(submitButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });
}); 