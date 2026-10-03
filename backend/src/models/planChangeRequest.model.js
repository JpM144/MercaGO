import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PlanChangeRequest = sequelize.define(
  'PlanChangeRequest',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    storeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'store_id',
    },
    requestedTierId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'requested_tier_id',
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'pending',
    },
    receiptUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'receipt_url',
    },
    rejectedReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'rejected_reason',
    },
    requestedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'requested_by_user_id',
    },
    reviewedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'reviewed_by_user_id',
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reviewed_at',
    },
  },
  {
    tableName: 'plan_change_requests',
    underscored: true,
    timestamps: true,
  },
);

export default PlanChangeRequest;
