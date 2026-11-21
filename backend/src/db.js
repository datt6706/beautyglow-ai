
import 'dotenv/config';
import mysql from 'mysql2/promise';

// Cấu hình kết nối MySQL Railway hoặc MySQL Local
export const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),

  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'beautyglow',

  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,

  charset: 'utf8mb4',
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Kiểm tra kết nối Database
export async function testDatabase() {
  try {
    const connection = await db.getConnection();

    console.log('MySQL kết nối thành công!');
    console.log('Database:', process.env.DB_NAME || 'beautyglow');

    connection.release();
    return true;
  } catch (error) {
    console.error('MySQL kết nối thất bại:', error.message);
    return false;
  }
}
