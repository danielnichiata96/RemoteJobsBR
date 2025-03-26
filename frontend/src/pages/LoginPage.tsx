import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import styled from 'styled-components';
import Layout from '../components/Layout';
import { authService, LoginData } from '../services/api';

const LoginContainer = styled.div`
  max-width: 450px;
  margin: 2rem auto;
  padding: 2rem;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
`;

const Title = styled.h1`
  font-size: 1.8rem;
  color: var(--text-color);
  margin-bottom: 1.5rem;
  text-align: center;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
`;

const FormGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-color);
`;

const Input = styled.input<{ hasError?: boolean }>`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid ${({ hasError }) => (hasError ? 'var(--danger-color)' : 'var(--gray)')};
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.2s;
  
  &:focus {
    outline: none;
    border-color: ${({ hasError }) => (hasError ? 'var(--danger-color)' : 'var(--primary-color)')};
  }
`;

const ErrorMessage = styled.span`
  color: var(--danger-color);
  font-size: 0.875rem;
  margin-top: 0.25rem;
  display: block;
`;

const Button = styled.button`
  padding: 0.75rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-top: 1rem;
  
  &:hover {
    background-color: #357ABD;
  }
  
  &:disabled {
    background-color: var(--gray);
    cursor: not-allowed;
  }
`;

const RegisterLink = styled.div`
  margin-top: 2rem;
  text-align: center;
  color: var(--dark-gray);
  font-size: 0.9rem;
  
  a {
    color: var(--primary-color);
    text-decoration: none;
    font-weight: 500;
    
    &:hover {
      text-decoration: underline;
    }
  }
`;

// Schema de validação com Yup
const schema = yup.object().shape({
  email: yup
    .string()
    .required('Email é obrigatório')
    .email('Email inválido'),
  password: yup
    .string()
    .required('Senha é obrigatória'),
});

type FormData = yup.InferType<typeof schema>;

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
      await authService.login(data);
      
      // Redireciona para a página pretendida ou para a página inicial
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao fazer login. Por favor, tente novamente.');
    }
  };

  return (
    <Layout>
      <LoginContainer>
        <Title>Login</Title>
        
        {error && <ErrorMessage>{error}</ErrorMessage>}
        
        <Form onSubmit={handleSubmit(onSubmit)}>
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

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </Form>

        <RegisterLink>
          Não tem uma conta? <Link to="/register">Registre-se</Link>
        </RegisterLink>
      </LoginContainer>
    </Layout>
  );
};

export default LoginPage; 