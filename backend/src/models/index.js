import { Sequelize } from 'sequelize';
import sequelize from '../config/database.js';
import User from './user.model.js';
import Category from './category.model.js';
import Store from './store.model.js';
import Product from './product.model.js';
import Order from './order.model.js';
import OrderItem from './orderItem.model.js';
import Review from './review.model.js';
import PriceHistory from './priceHistory.model.js';
import Favorite from './favorite.model.js';
import StoreApplication from './storeApplication.model.js';
import AuditLog from './auditLog.model.js';
import PlanTier from './planTier.model.js';
import PlanChangeRequest from './planChangeRequest.model.js';

// --- Asociaciones ---

Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

Store.hasMany(Category, { foreignKey: 'storeId', as: 'categories' });
Category.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

Store.belongsTo(User, { foreignKey: 'ownerUserId', as: 'owner' });
User.hasOne(Store, { foreignKey: 'ownerUserId', as: 'store' });

Store.hasMany(Product, { foreignKey: 'storeId', as: 'products' });
Product.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

Product.hasMany(OrderItem, { foreignKey: 'productId', as: 'orderItems' });
OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

Product.hasMany(Review, { foreignKey: 'productId', as: 'reviews' });
Review.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

User.hasMany(Review, { foreignKey: 'userId', as: 'reviews' });
Review.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Product.hasMany(PriceHistory, { foreignKey: 'productId', as: 'priceHistory' });
PriceHistory.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

User.hasMany(Favorite, { foreignKey: 'userId', as: 'favorites' });
Favorite.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Product.hasMany(Favorite, { foreignKey: 'productId', as: 'favorites' });
Favorite.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

User.hasMany(StoreApplication, { foreignKey: 'reviewedByUserId', as: 'reviewedApplications' });
StoreApplication.belongsTo(User, { foreignKey: 'reviewedByUserId', as: 'reviewedBy' });

Store.hasMany(StoreApplication, { foreignKey: 'resultingStoreId', as: 'applicationsFrom' });
StoreApplication.belongsTo(Store, { foreignKey: 'resultingStoreId', as: 'resultingStore' });

User.hasMany(AuditLog, { foreignKey: 'actorUserId', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'actorUserId', as: 'actor' });

PlanTier.hasMany(Store, { foreignKey: 'planTierId', as: 'stores' });
Store.belongsTo(PlanTier, { foreignKey: 'planTierId', as: 'planTier' });

PlanTier.hasMany(PlanChangeRequest, { foreignKey: 'requestedTierId', as: 'changeRequests' });
PlanChangeRequest.belongsTo(PlanTier, { foreignKey: 'requestedTierId', as: 'requestedTier' });

Store.hasMany(PlanChangeRequest, { foreignKey: 'storeId', as: 'planChangeRequests' });
PlanChangeRequest.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

User.hasMany(PlanChangeRequest, { foreignKey: 'requestedByUserId', as: 'requestedPlanChanges' });
PlanChangeRequest.belongsTo(User, { foreignKey: 'requestedByUserId', as: 'requestedBy' });

User.hasMany(PlanChangeRequest, { foreignKey: 'reviewedByUserId', as: 'reviewedPlanChanges' });
PlanChangeRequest.belongsTo(User, { foreignKey: 'reviewedByUserId', as: 'reviewedBy' });

const db = {
  sequelize,
  Sequelize,
  User,
  Category,
  Store,
  Product,
  Order,
  OrderItem,
  Review,
  PriceHistory,
  Favorite,
  StoreApplication,
  AuditLog,
  PlanTier,
  PlanChangeRequest,
};

export default db;
