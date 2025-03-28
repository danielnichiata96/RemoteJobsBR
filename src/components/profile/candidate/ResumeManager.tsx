import { useState } from 'react';
import { useFileUpload } from '@/utils/uploadUtils';

interface ResumeManagerProps {
  initialResumeUrl?: string;
  onResumeChange: (url: string | null) => Promise<void>;
}

export default function ResumeManager({ initialResumeUrl, onResumeChange }: ResumeManagerProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { 
    file, 
    fileUrl, 
    isUploading, 
    error, 
    handleFileChange, 
    uploadFile, 
    clearFile 
  } = useFileUpload(initialResumeUrl, '.pdf,.doc,.docx');

  const handleUpload = async () => {
    try {
      setIsSaving(true);
      const url = await uploadFile();
      if (url) {
        await onResumeChange(url);
      }
    } catch (error) {
      console.error('Erro ao fazer upload do currículo:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    try {
      setIsSaving(true);
      await onResumeChange(null);
      clearFile();
    } catch (error) {
      console.error('Erro ao remover o currículo:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getFileNameFromUrl = (url?: string) => {
    if (!url) return '';
    return url.split('/').pop() || 'currículo';
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Currículo</h2>
      
      <div className="space-y-4">
        {fileUrl ? (
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm font-medium">{file?.name || getFileNameFromUrl(fileUrl)}</span>
            </div>
            <div className="flex space-x-2">
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Visualizar
              </a>
              <button
                onClick={handleRemove}
                disabled={isSaving}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200"
              >
                Remover
              </button>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-1 text-sm text-gray-600">
              Arraste e solte seu currículo aqui, ou clique para selecionar
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Formatos aceitos: PDF, DOC, DOCX (Max: 5MB)
            </p>
            <input
              type="file"
              id="resume-upload"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => document.getElementById('resume-upload')?.click()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Selecionar arquivo
            </button>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 mt-2">
            {error}
          </div>
        )}

        {file && !initialResumeUrl && (
          <div className="flex justify-end">
            <button
              onClick={handleUpload}
              disabled={isUploading || isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isUploading || isSaving ? 'Salvando...' : 'Salvar Currículo'}
            </button>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-600">
          <p>
            <strong>Dica:</strong> Um bom currículo destaca suas habilidades e experiências mais relevantes. 
            Certifique-se de que ele está atualizado e formate-o de forma clara e profissional.
          </p>
        </div>
      </div>
    </div>
  );
} 