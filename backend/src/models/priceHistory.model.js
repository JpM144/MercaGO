import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PriceHistory = sequelize.define(
  'PriceHistory',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'product_id',
      references: {
        model: 'products',
        key: 'id',
      },
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
  },
  {
    tableName: 'price_history',
    underscored: true,
    timestamps: true,
    createdAt: 'changed_at',
    updatedAt: false,
  },
);

export default PriceHistory;
