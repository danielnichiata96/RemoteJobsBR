const authController = {
  register: async (req, res) => {
    const { fullName, email, password } = req.body;
    const db = req.app.locals.db;
    
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
  },

  login: async (req, res) => {
    const { email, password } = req.body;
    const db = req.app.locals.db;
    
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
  },

  logout: async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const db = req.app.locals.db;
      db.get('auth.tokens').remove({ token }).write();
    }
    res.json({ message: 'Logout realizado com sucesso' });
  }
};

module.exports = authController; 