import dotenv from 'dotenv';
dotenv.config();

const isHosted = Boolean(process.env.RENDER || process.env.NODE_ENV === 'production');
const mongo = process.env.MONGODB_URI || (isHosted ? '' : 'mongodb://127.0.0.1:27017/bizmanager');

if (isHosted && !mongo) {
	throw new Error('MONGODB_URI is required in the hosted environment. Set it to your MongoDB Atlas connection string.');
}

export const env = {
	port: Number(process.env.PORT || 4000),
	mongo,
	jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me',
	origin: process.env.CLIENT_ORIGIN || '*',
};
