const jsonServer = require('json-server');
const cors = require('cors');
const server = jsonServer.create();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();

// Configurações do servidor
server.use(cors());
server.use(middlewares);
server.use(jsonServer.bodyParser);

// Middleware para verificar token
const isAuthenticated = (req, res, next) => {
  if (req.method === 'POST' && req.path === '/auth/login') {
    return next();
  }
  
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  
  const db = router.db;
  const authToken = db.get('auth.tokens').find({ token }).value();
  
  if (!authToken) {
    return res.status(401).json({ error: 'Token inválido' });
  }
  
  next();
};

// Middleware para login
server.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  const db = router.db;
  
  const user = db.get('users').find({ email }).value();
  
  if (!user) {
    return res.status(401).json({ error: 'Usuário não encontrado' });
  }
  
  // Em um ambiente real, você usaria bcrypt.compare aqui
  if (password !== user.password) {
    return res.status(401).json({ error: 'Senha incorreta' });
  }
  
  // Gerar token (em um ambiente real, use JWT)
  const token = Math.random().toString(36).substring(2);
  
  // Salvar token
  db.get('auth.tokens').push({ token, userId: user.id }).write();
  
  res.json({
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email
    }
  });
});

// Middleware para registro
server.post('/auth/register', (req, res) => {
  const { fullName, email, password } = req.body;
  const db = router.db;
  
  // Verificar se usuário já existe
  const existingUser = db.get('users').find({ email }).value();
  if (existingUser) {
    return res.status(400).json({ error: 'Email já cadastrado' });
  }
  
  // Criar novo usuário
  const newUser = {
    id: Date.now(),
    fullName,
    email,
    password, // Em um ambiente real, você usaria bcrypt.hash aqui
    createdAt: new Date().toISOString()
  };
  
  db.get('users').push(newUser).write();
  
  res.status(201).json({
    message: 'Usuário criado com sucesso',
    user: {
      id: newUser.id,
      fullName: newUser.fullName,
      email: newUser.email
    }
  });
});

// Middleware para logout
server.post('/auth/logout', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    const db = router.db;
    db.get('auth.tokens').remove({ token }).write();
  }
  res.json({ message: 'Logout realizado com sucesso' });
});

// Aplicar middleware de autenticação
server.use(isAuthenticated);

// Usar o router do JSON Server
server.use(router);

// Iniciar servidor
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`JSON Server está rodando na porta ${PORT}`);
}); 