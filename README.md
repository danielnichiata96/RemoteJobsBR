# RemoteJobsBR

Uma plataforma para conectar profissionais brasileiros a oportunidades de trabalho remoto.

## Estrutura do Projeto

O projeto está dividido em duas partes principais:

### Frontend (./frontend)

- React 18 com TypeScript
- Styled Components para estilização
- React Router para navegação
- React Hook Form para formulários
- Yup para validações
- Axios para requisições HTTP

### Backend (./backend)

- Node.js com Express
- JSON Server para mock de API
- Sistema de autenticação simulado
- Middleware de proteção de rotas

## Instalação

1. Clone o repositório
2. Instale as dependências do backend:
   ```bash
   cd backend
   npm install
   ```
3. Instale as dependências do frontend:
   ```bash
   cd frontend
   npm install
   ```

## Executando o Projeto

1. Inicie o backend:
   ```bash
   cd backend
   npm run dev
   ```
   O servidor estará disponível em `http://localhost:3001`

2. Em outro terminal, inicie o frontend:
   ```bash
   cd frontend
   npm start
   ```
   A aplicação estará disponível em `http://localhost:3000`

## Funcionalidades

- Registro e autenticação de usuários
- Listagem de vagas de trabalho remoto
- Filtros por categoria e tecnologia
- Perfil de usuário
- Candidatura a vagas
- Sistema de busca

## Desenvolvimento

O projeto usa:
- TypeScript para tipagem estática
- ESLint para linting
- Prettier para formatação
- Git para controle de versão

## Contribuição

1. Faça o fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## Licença

Este projeto está sob a licença MIT. 