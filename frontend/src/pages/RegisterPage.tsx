import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import styled from 'styled-components';
import Layout from '../components/Layout';
import { authService, RegisterData } from '../services/api';

// ... (manter os styled components existentes)

// Schema de validação com Yup
const schema = yup.object().shape({
  fullName: yup
    .string()
    .required('Nome completo é obrigatório')
    .min(3, 'Nome deve ter pelo menos 3 caracteres'),
  email: yup
    .string()
    .required('Email é obrigatório')
    .email('Email inválido'),
  password: yup
    .string()
    .required('Senha é obrigatória')
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
      'Senha deve conter pelo menos uma letra maiúscula, uma minúscula, um número e um caractere especial'
    ),
  confirmPassword: yup
    .string()
    .required('Confirmação de senha é obrigatória')
    .oneOf([yup.ref('password')], 'As senhas não coincidem'),
});

type FormData = yup.InferType<typeof schema>;

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = React.useState<string | null>(null);
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      setError(null);
      await authService.register({
        fullName: data.fullName,
        email: data.email,
        password: data.password,
      });
      
      // Redireciona para a página de login após o registro bem-sucedido
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao realizar o cadastro. Por favor, tente novamente.');
    }
  };

  return (
    <Layout>
      <RegisterContainer>
        <Title>Criar Conta</Title>
        
        {error && <ErrorMessage>{error}</ErrorMessage>}
        
        <Form onSubmit={handleSubmit(onSubmit)}>
          <FormGroup>
            <Label htmlFor="fullName">Nome Completo</Label>
            <Input
              id="fullName"
              type="text"
              {...register('fullName')}
              hasError={!!errors.fullName}
            />
            {errors.fullName && (
              <ErrorMessage>{errors.fullName.message}</ErrorMessage>
            )}
          </FormGroup>

          <FormGroup>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              hasError={!!errors.email}
            />
            {errors.email && (
              <ErrorMessage>{errors.email.message}</ErrorMessage>
            )}
          </FormGroup>

          <FormGroup>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              {...register('password')}
              hasError={!!errors.password}
            />
            {errors.password && (
              <ErrorMessage>{errors.password.message}</ErrorMessage>
            )}
          </FormGroup>

          <FormGroup>
            <Label htmlFor="confirmPassword">Confirmar Senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              {...register('confirmPassword')}
              hasError={!!errors.confirmPassword}
            />
            {errors.confirmPassword && (
              <ErrorMessage>{errors.confirmPassword.message}</ErrorMessage>
            )}
          </FormGroup>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Registrando...' : 'Criar Conta'}
          </Button>
        </Form>

        <LoginLink>
          Já tem uma conta? <Link to="/login">Faça login</Link>
        </LoginLink>
      </RegisterContainer>
    </Layout>
  );
};

export default RegisterPage; 