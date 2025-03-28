import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { error = 'unknown' } = req.query;
  
  console.error('Auth error:', error);
  console.error('Auth error details:', req.query);
  
  // Responder com um JSON ao invés de HTML para facilitar debugging
  res.status(200).json({ 
    error, 
    message: 'Erro de autenticação', 
    details: req.query 
  });
} 