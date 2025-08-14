import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../db'
import { Auction } from './auctions'

export class Log extends Model {
  declare id: number
  declare auctionId: number
  declare type: 'created' | 'updated' | 'bidding'
  declare bid?: number | null
  declare bidder?: string | null
  declare createdAt: Date
}

Log.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  auctionId: { 
    type: DataTypes.INTEGER, 
    allowNull: false,
    references: { model: Auction, key: 'id' }
  },
  type: { 
    type: DataTypes.ENUM('created', 'updated', 'deleted', 'bidding'), 
    allowNull: false 
  },
  bid: { type: DataTypes.FLOAT, allowNull: true },
  bidder: { type: DataTypes.STRING, allowNull: true },
  createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  sequelize,
  tableName: 'logs',
  timestamps: false
})
