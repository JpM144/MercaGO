import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PlanTier = sequelize.define(
  'PlanTier',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      get() {
        const raw = this.getDataValue('price');
        return raw === null || raw === undefined ? null : Number(raw);
      },
    },
    productLimit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'product_limit',
    },
  },
  {
    tableName: 'plan_tiers',
    underscored: true,
    timestamps: true,
  },
);

export default PlanTier;
