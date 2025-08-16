import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../db'

export class Auction extends Model {
  declare id: number
  declare item: string
  declare description: string
  declare startBid: number
  declare bidIncrement: number
  declare startDate: Date
  declare duration: number
  declare live: boolean
  declare currentBid: number
  declare seller: string
  declare highestBidder?: string | null
  declare status: 'pending' | 'accepted' | 'rejected'
}

Auction.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  item: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  startBid: { type: DataTypes.FLOAT, allowNull: false },
  bidIncrement: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 1 },
  startDate: { type: DataTypes.DATE, allowNull: false },
  duration: { type: DataTypes.INTEGER, allowNull: false },
  live: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  currentBid: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  seller: { type: DataTypes.STRING, allowNull: false },
  highestBidder: { type: DataTypes.STRING, allowNull: true },
  status: { 
    type: DataTypes.ENUM('live','pending', 'accepted', 'rejected', 'scheduled'), 
    allowNull: false, 
    defaultValue: 'scheduled' 
  }
}, {
  sequelize,
  tableName: 'auctions'
})
