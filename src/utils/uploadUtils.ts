import { useState } from 'react';

// Função para converter o arquivo em uma string base64
export const toBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

// Hook personalizado para gerenciar o upload de arquivos
export function useFileUpload(initialUrl?: string, accept = '.pdf,.doc,.docx') {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | undefined>(initialUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError(null);
    setFile(selectedFile);

    // Verificar o tipo de arquivo
    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
    const validExtensions = accept.split(',').map(ext => ext.trim().replace('.', ''));
    
    if (!validExtensions.includes(fileExtension || '')) {
      setError(`Tipo de arquivo inválido. Por favor, envie um arquivo ${accept}`);
      return;
    }

    // Verificar o tamanho do arquivo (limite de 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('O arquivo é muito grande. O tamanho máximo permitido é 5MB.');
      return;
    }

    try {
      // Para preview
      const url = URL.createObjectURL(selectedFile);
      setFileUrl(url);
    } catch (err) {
      console.error('Erro ao processar o arquivo:', err);
      setError('Ocorreu um erro ao processar o arquivo. Tente novamente.');
    }
  };

  // Função para fazer upload do arquivo para o servidor
  const uploadFile = async (): Promise<string | null> => {
    if (!file) return null;
    
    setIsUploading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao fazer upload do arquivo');
      }
      
      const data = await response.json();
      setFileUrl(data.url);
      return data.url;
    } catch (err) {
      console.error('Erro ao fazer upload:', err);
      setError(err instanceof Error ? err.message : 'Erro ao fazer upload do arquivo');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setFileUrl(undefined);
    setError(null);
  };

  return {
    file,
    fileUrl,
    isUploading,
    error,
    handleFileChange,
    uploadFile,
    clearFile,
  };
} 