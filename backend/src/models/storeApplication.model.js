import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const StoreApplication = sequelize.define(
  'StoreApplication',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    storeName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'store_name',
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    whatsappNumber: {
      type: DataTypes.STRING(30),
      allowNull: false,
      field: 'whatsapp_number',
    },
    applicantName: {
      type: DataTypes.STRING(120),
      allowNull: false,
      field: 'applicant_name',
    },
    applicantEmail: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'applicant_email',
    },
    applicantPasswordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'applicant_password_hash',
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'pending',
    },
    rejectedReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'rejected_reason',
    },
    reviewedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'reviewed_by_user_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reviewed_at',
    },
    resultingStoreId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'resulting_store_id',
      references: {
        model: 'stores',
        key: 'id',
      },
    },
  },
  {
    tableName: 'store_applications',
    underscored: true,
    timestamps: true,
  },
);

export default StoreApplication;
