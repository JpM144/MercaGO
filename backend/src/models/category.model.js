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
      unique: true,
    },
  },
  {
    tableName: 'categories',
    underscored: true,
    timestamps: true,
  },
);

export default Category;
