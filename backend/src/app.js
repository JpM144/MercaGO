import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import categoryRoutes from './routes/category.routes.js';
import planTierRoutes from './routes/planTier.routes.js';
import productRoutes from './routes/product.routes.js';
import storeRoutes from './routes/store.routes.js';
import orderRoutes from './routes/order.routes.js';
import favoriteRoutes from './routes/favorite.routes.js';
import storeAdminRoutes from './routes/storeAdmin.routes.js';
import superAdminRoutes from './routes/superAdmin.routes.js';
import shoppingAssistantRoutes from './routes/shoppingAssistant.routes.js';
import storeApplicationAssistantRoutes from './routes/storeApplicationAssistant.routes.js';
import { notFoundHandler } from './middleware/notFound.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '../uploads');
const reviewPhotosDir = path.join(uploadsDir, 'reviews');
fs.mkdirSync(reviewPhotosDir, { recursive: true });

const app = express();

app.use(cors());
app.use(express.json());

// Solo las fotos de reseñas se sirven estáticamente. Los comprobantes de plan son
// datos sensibles: se entregan por endpoints autenticados (store-admin / super-admin),
// nunca por una URL pública.
app.use('/uploads/reviews', express.static(reviewPhotosDir));

app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/plan-tiers', planTierRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/store-admin', storeAdminRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/shopping-assistant', shoppingAssistantRoutes);
app.use('/api/store-application-assistant', storeApplicationAssistantRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
