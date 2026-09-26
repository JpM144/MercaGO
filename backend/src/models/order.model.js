import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Order = sequelize.define(
  'Order',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    customerName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'customer_name',
    },
    customerContact: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'customer_contact',
    },
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'shipped', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: 'orders',
    underscored: true,
    timestamps: true,
  },
);

export default Order;
