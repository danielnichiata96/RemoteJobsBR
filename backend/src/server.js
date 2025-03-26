const express = require('express');
const cors = require('cors');
const jsonServer = require('json-server');
const path = require('path');
const authRoutes = require('./routes/auth');
const authMiddleware = require('./middlewares/auth');

const app = express();
const router = jsonServer.router(path.join(__dirname, '../data/db.json'));
const middlewares = jsonServer.defaults();

// Configurações do servidor
app.use(cors());
app.use(middlewares);
app.use(express.json());

// Armazenar instância do db para uso nos controllers
app.locals.db = router.db;

// Rotas de autenticação
app.use('/auth', authRoutes);

// Middleware de autenticação
app.use(authMiddleware);

// Rotas do JSON Server
app.use(router);

// Iniciar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
}); 