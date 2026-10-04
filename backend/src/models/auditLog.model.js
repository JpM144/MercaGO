import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AuditLog = sequelize.define(
  'AuditLog',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    actorUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'actor_user_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    action: {
      type: DataTypes.ENUM(
        'approve_application',
        'reject_application',
        'pause_store',
        'reactivate_store',
        'cancel_store',
      ),
      allowNull: false,
    },
    targetType: {
      type: DataTypes.STRING(40),
      allowNull: false,
      field: 'target_type',
    },
    targetId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'target_id',
    },
    details: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    tableName: 'audit_logs',
    underscored: true,
    timestamps: true,
  },
);

export default AuditLog;
