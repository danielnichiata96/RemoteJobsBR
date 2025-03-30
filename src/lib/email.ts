import sgMail from '@sendgrid/mail';

// Configurar a chave da API SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html: string;
}

/**
 * Função para enviar emails usando a API do SendGrid
 */
export async function sendEmail({ to, subject, text, html }: EmailOptions) {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('SENDGRID_API_KEY não configurada. O email não será enviado.');
      return;
    }

    const msg = {
      to,
      from: process.env.EMAIL_FROM || 'noreply@remotejobsbr.com',
      subject,
      text: text || '',
      html,
    };

    const response = await sgMail.send(msg);
    console.log('Email enviado com sucesso:', response);
    return response;
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    throw error;
  }
} 