import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Apenas aceita método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Extrair a intenção do corpo da requisição
    const { intent } = req.body;

    // Validar a intenção
    if (!intent || !['USER', 'COMPANY'].includes(intent)) {
      return res.status(400).json({
        message: 'Invalid intent provided. Must be USER or COMPANY',
      });
    }

    // Armazenar a intenção em um cookie para ser usado após o login
    // Este cookie precisa estar disponível por pelo menos 5 minutos
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 5);

    res.setHeader(
      'Set-Cookie', 
      `auth_role=${intent}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}`
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro ao registrar intenção:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
} 