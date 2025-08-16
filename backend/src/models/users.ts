import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../db'

export class User extends Model {
  declare id: number
  declare token: string
  declare username: string
  declare email: string
}

User.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  token: { type: DataTypes.TEXT, allowNull: false },
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true }
}, {
  sequelize,
  tableName: 'users'
})