import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string().min(6, 'A nova senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string().min(1, 'Confirmação de senha é obrigatória'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

interface SecuritySettingsProps {
  onChangePassword: (data: { currentPassword: string; newPassword: string }) => Promise<void>;
  onDeleteAccount: () => Promise<void>;
}

export default function SecuritySettings({ onChangePassword, onDeleteAccount }: SecuritySettingsProps) {
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  });

  const handlePasswordChange = async (data: ChangePasswordFormData) => {
    try {
      setIsChangingPassword(true);
      setError(null);
      setSuccess(null);
      
      await onChangePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      
      setSuccess('Senha alterada com sucesso!');
      reset();
    } catch (err) {
      console.error('Erro ao alterar senha:', err);
      setError(err instanceof Error ? err.message : 'Ocorreu um erro ao alterar a senha');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteRequest = () => {
    setShowDeleteConfirmation(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmText !== 'excluir minha conta') {
      setError('Por favor, digite "excluir minha conta" para confirmar');
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);
      
      await onDeleteAccount();
      
      // A exclusão foi bem-sucedida, o usuário será redirecionado pelo servidor
    } catch (err) {
      console.error('Erro ao excluir conta:', err);
      setError(err instanceof Error ? err.message : 'Ocorreu um erro ao excluir a conta');
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6 space-y-6">
      <h2 className="text-xl font-semibold mb-4">Configurações de Segurança</h2>
      
      {/* Alterar Senha */}
      <div className="border-b pb-6">
        <h3 className="text-lg font-medium mb-4">Alterar Senha</h3>
        
        <form onSubmit={handleSubmit(handlePasswordChange)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Senha Atual</label>
            <input
              type="password"
              {...register('currentPassword')}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              disabled={isChangingPassword}
            />
            {errors.currentPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.currentPassword.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Nova Senha</label>
            <input
              type="password"
              {...register('newPassword')}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              disabled={isChangingPassword}
            />
            {errors.newPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.newPassword.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Confirmar Nova Senha</label>
            <input
              type="password"
              {...register('confirmPassword')}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              disabled={isChangingPassword}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-100 text-green-700 rounded-md">
              {success}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isChangingPassword}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isChangingPassword ? 'Alterando...' : 'Alterar Senha'}
            </button>
          </div>
        </form>
      </div>

      {/* Excluir Conta */}
      <div className="pt-4">
        <h3 className="text-lg font-medium mb-4">Excluir Conta</h3>
        
        <div className="bg-red-50 p-4 rounded-md mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Atenção</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  Esta ação é irreversível. Ao excluir sua conta, todos os seus dados pessoais, 
                  candidaturas e histórico serão permanentemente removidos do sistema.
                </p>
              </div>
            </div>
          </div>
        </div>

        {!showDeleteConfirmation ? (
          <button
            onClick={handleDeleteRequest}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Excluir Minha Conta
          </button>
        ) : (
          <div className="space-y-4 border p-4 rounded-md">
            <p className="text-sm text-gray-700">
              Para confirmar, digite <strong>excluir minha conta</strong> no campo abaixo:
            </p>
            
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="block w-full border border-gray-300 rounded-md shadow-sm p-2"
              placeholder="excluir minha conta"
              disabled={isDeleting}
            />
            
            <div className="flex space-x-3">
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting || deleteConfirmText !== 'excluir minha conta'}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
              
              <button
                onClick={() => {
                  setShowDeleteConfirmation(false);
                  setDeleteConfirmText('');
                  setError(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Cancelar
              </button>
            </div>
            
            {error && (
              <div className="p-3 bg-red-100 text-red-700 rounded-md">
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 