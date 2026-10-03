import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Store = sequelize.define(
  'Store',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    whatsappNumber: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: 'whatsapp_number',
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    ownerUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      field: 'owner_user_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'pending',
    },
    businessHours: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'business_hours',
    },
    shippingInfo: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'shipping_info',
    },
    warrantyInfo: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'warranty_info',
    },
    paymentMethods: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'payment_methods',
    },
    rejectedReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'rejected_reason',
    },
    planStatus: {
      type: DataTypes.ENUM('active', 'paused', 'cancelled', 'expired'),
      allowNull: false,
      defaultValue: 'active',
      field: 'plan_status',
    },
    planStartedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'plan_started_at',
    },
    planExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'plan_expires_at',
    },
    planTierId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'plan_tier_id',
      references: {
        model: 'plan_tiers',
        key: 'id',
      },
    },
  },
  {
    tableName: 'stores',
    underscored: true,
    timestamps: true,
  },
);

export default Store;
