import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { authService } from '../services/api';

const HeaderContainer = styled.header`
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 1rem 0;
`;

const HeaderContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Logo = styled(Link)`
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--primary-color);
  text-decoration: none;
  
  &:hover {
    color: #357ABD;
  }
`;

const Nav = styled.nav`
  display: flex;
  gap: 2rem;
  align-items: center;
`;

const NavLink = styled(Link)`
  color: var(--text-color);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
  
  &:hover {
    color: var(--primary-color);
  }
`;

const AuthButtons = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  ${({ variant }) => variant === 'primary' ? `
    background-color: var(--primary-color);
    color: white;
    border: none;
    
    &:hover {
      background-color: #357ABD;
    }
  ` : `
    background-color: transparent;
    color: var(--primary-color);
    border: 1px solid var(--primary-color);
    
    &:hover {
      background-color: var(--primary-color);
      color: white;
    }
  `}
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const UserName = styled.span`
  color: var(--text-color);
  font-weight: 500;
`;

const Header: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = React.useState(authService.getCurrentUser());

  const handleLogout = async () => {
    try {
      await authService.logout();
      setUser(null);
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return (
    <HeaderContainer>
      <HeaderContent>
        <Logo to="/">RemoteJobsBR</Logo>
        
        <Nav>
          <NavLink to="/vagas">Vagas</NavLink>
          <NavLink to="/empresas">Empresas</NavLink>
          <NavLink to="/sobre">Sobre</NavLink>
        </Nav>

        <AuthButtons>
          {user ? (
            <UserInfo>
              <UserName>Olá, {user.fullName}</UserName>
              <Button variant="secondary" onClick={handleLogout}>
                Sair
              </Button>
            </UserInfo>
          ) : (
            <>
              <Button variant="secondary" as={Link} to="/login">
                Entrar
              </Button>
              <Button variant="primary" as={Link} to="/register">
                Criar Conta
              </Button>
            </>
          )}
        </AuthButtons>
      </HeaderContent>
    </HeaderContainer>
  );
};

export default Header; 