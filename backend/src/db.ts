import { Sequelize } from 'sequelize'
import 'dotenv/config'

export const sequelize = new Sequelize(process.env.SUPABASE_DB_URL!, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: console.log, // optional, to see queries
})