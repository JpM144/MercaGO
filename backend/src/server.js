import 'dotenv/config';
import app from './app.js';
import db from './models/index.js';

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  try {
    await db.sequelize.authenticate();
    console.log('Conexión a PostgreSQL establecida correctamente.');
  } catch (error) {
    console.warn('No se pudo conectar a PostgreSQL:', error.message);
    console.warn('El servidor arranca igualmente; revisa backend/.env.');
  }

  app.listen(PORT, () => {
    console.log(`TechStore backend escuchando en http://localhost:${PORT}`);
  });
}

start();
