import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { z } from "zod";
import { UserRole } from "@prisma/client";

// Esquema de validação para registro
const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  role: z.nativeEnum(UserRole, {
    errorMap: () => ({ message: 'Tipo de usuário inválido' }),
  }),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Método não permitido" });
  }

  try {
    console.log('Dados de registro recebidos:', {
      ...req.body,
      password: req.body.password ? '[REDACTED]' : undefined,
    });

    // Validar entrada
    const validationResult = registerSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      console.error('Erro de validação:', validationResult.error.errors);
      return res.status(400).json({ 
        message: 'Dados inválidos', 
        errors: validationResult.error.format() 
      });
    }

    const { name, email, password, role } = validationResult.data;

    // Verificar se o email já está em uso
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Este email já está em uso' });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar o usuário
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
      },
    });

    // Remover senha do resultado
    const { password: _, ...userWithoutPassword } = user;

    console.log('Usuário criado com sucesso:', {
      id: userWithoutPassword.id,
      email: userWithoutPassword.email,
      role: userWithoutPassword.role,
    });

    // Responder com sucesso
    return res.status(201).json({
      message: 'Usuário criado com sucesso',
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    return res.status(500).json({ 
      message: 'Erro ao registrar usuário',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
} 