import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Configuração para permitir upload de arquivos
export const config = {
  api: {
    bodyParser: false,
  },
};

// Diretório de upload (em produção seria um serviço de armazenamento como S3)
const uploadDir = path.join(process.cwd(), 'public', 'uploads');

// Garantir que o diretório de uploads exista
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificar se o usuário está autenticado
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Não autorizado' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const form = formidable({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      filter: (part) => {
        // Filtrar apenas arquivos permitidos
        const type = part.mimetype || '';
        return (
          type.includes('pdf') ||
          type.includes('msword') ||
          type.includes('wordprocessingml') ||
          type.includes('openxmlformats-officedocument')
        );
      },
    });

    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    const file = files.file?.[0];
    if (!file) {
      return res.status(400).json({ message: 'Nenhum arquivo enviado' });
    }

    // Gerar um nome único para o arquivo
    const fileExtension = path.extname(file.originalFilename || '');
    const uniqueFilename = `${uuidv4()}${fileExtension}`;
    const newPath = path.join(uploadDir, uniqueFilename);

    // Renomear o arquivo para o nome único
    fs.renameSync(file.filepath, newPath);

    // URL para o arquivo
    const fileUrl = `/uploads/${uniqueFilename}`;

    return res.status(200).json({
      message: 'Arquivo enviado com sucesso',
      url: fileUrl,
      name: file.originalFilename,
      size: file.size,
    });
  } catch (error) {
    console.error('Erro no upload do arquivo:', error);
    return res.status(500).json({ message: 'Erro ao processar o upload do arquivo' });
  }
} 