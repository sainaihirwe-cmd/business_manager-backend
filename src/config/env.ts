import dotenv from 'dotenv';
dotenv.config();
export const env = { port: Number(process.env.PORT || 4000), mongo: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bizmanager', jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me', origin: process.env.CLIENT_ORIGIN || '*' };
