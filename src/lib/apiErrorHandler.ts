import { NextApiRequest, NextApiResponse } from 'next';
import { captureException } from '@/lib/sentry';

interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

/**
 * Wrap API handlers with this function to automatically catch and report errors to Sentry
 * 
 * @example
 * export default withErrorHandler(async (req, res) => {
 *   // Your API logic here
 * });
 */
export function withErrorHandler(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      await handler(req, res);
    } catch (error) {
      // Report the error to Sentry
      const eventId = captureException(error, {
        request: {
          url: req.url,
          method: req.method,
          headers: req.headers,
          query: req.query,
        },
        user: req.body?.user || null,
      });

      console.error('API Error:', error);
      
      // Determine appropriate status code and message
      const statusCode = error instanceof ApiError 
        ? error.statusCode 
        : 500;
        
      const message = error instanceof ApiError
        ? error.message
        : 'Uma falha inesperada ocorreu. Nossa equipe foi notificada.';
      
      // Format consistent error response
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.name : 'Unknown Error',
        message,
        statusCode,
      };
      
      // Send error response
      res.status(statusCode).json({
        ...errorResponse,
        // Include Sentry event ID for reference
        sentryEventId: eventId,
      });
    }
  };
}

/**
 * Custom API error class with status code support
 * 
 * @example
 * throw new ApiError('Resource not found', 404);
 */
export class ApiError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

/**
 * Common error helper functions
 */
export const apiErrors = {
  notFound: (message = 'Recurso não encontrado') => new ApiError(message, 404),
  unauthorized: (message = 'Não autorizado') => new ApiError(message, 401),
  forbidden: (message = 'Acesso negado') => new ApiError(message, 403),
  badRequest: (message = 'Solicitação inválida') => new ApiError(message, 400),
  conflict: (message = 'Conflito com o estado atual') => new ApiError(message, 409),
  validation: (message = 'Erro de validação') => new ApiError(message, 422),
  internal: (message = 'Erro interno do servidor') => new ApiError(message, 500),
}; 