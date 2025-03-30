import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './[...nextauth]';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Apenas aceita método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const session = await getServerSession(req, res, authOptions);
  
  // Se já estiver autenticado, não permite definir intenção
  if (session) {
    return res.status(400).json({ error: 'Usuário já está autenticado' });
  }

  try {
    const { intent } = req.body;

    // Validar o tipo de intenção
    if (!intent || !['USER', 'COMPANY'].includes(intent)) {
      return res.status(400).json({ error: 'Tipo de intenção inválido' });
    }

    // Armazenar a intenção em um cookie para ser usado após o login social
    res.setHeader('Set-Cookie', `register_intent=${intent}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`);

    return res.status(200).json({ success: true, message: 'Intenção de registro armazenada' });
  } catch (error) {
    console.error('Erro ao definir intenção de registro:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
} 