const authMiddleware = (req, res, next) => {
  if (req.method === 'POST' && req.path === '/auth/login') {
    return next();
  }
  
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  
  const db = req.app.locals.db;
  const authToken = db.get('auth.tokens').find({ token }).value();
  
  if (!authToken) {
    return res.status(401).json({ error: 'Token inválido' });
  }
  
  next();
};

module.exports = authMiddleware; 