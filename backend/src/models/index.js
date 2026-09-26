import { Sequelize } from 'sequelize';
import sequelize from '../config/database.js';
import User from './user.model.js';
import Category from './category.model.js';
import Product from './product.model.js';
import Order from './order.model.js';
import OrderItem from './orderItem.model.js';
import Review from './review.model.js';

// --- Asociaciones ---

Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

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

const db = {
  sequelize,
  Sequelize,
  User,
  Category,
  Product,
  Order,
  OrderItem,
  Review,
};

export default db;
