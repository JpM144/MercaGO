import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Category = sequelize.define(
  'Category',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    storeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'stores', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
  },
  {
    tableName: 'categories',
    underscored: true,
    timestamps: true,
    indexes: [{ unique: true, fields: ['store_id', 'slug'] }],
  },
);

export default Category;
