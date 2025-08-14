import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../db'

export class Auction extends Model {
  declare id: number
  declare item: string
  declare description: string
  declare startBid: number
  declare startDate: Date
  declare duration: number // in minutes/hours
  declare live: boolean
  declare currentBid: number
  declare seller: string
  declare highestBidder?: string | null
}

Auction.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  item: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  startBid: { type: DataTypes.FLOAT, allowNull: false },
  startDate: { type: DataTypes.DATE, allowNull: false },
  duration: { type: DataTypes.INTEGER, allowNull: false }, // duration in minutes
  live: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  currentBid: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  seller: { type: DataTypes.STRING, allowNull: false },
  highestBidder: { type: DataTypes.STRING, allowNull: true }
}, {
  sequelize,
  tableName: 'auctions'
})
