import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Return 410 Gone status code
  return res.status(410).json({ 
    message: 'This endpoint has been deprecated. Job applications are now handled externally through the application URL or email provided by the employer.',
    redirectTo: '/jobs'
  });
} 