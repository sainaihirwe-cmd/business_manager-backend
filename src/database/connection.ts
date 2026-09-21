import mongoose from 'mongoose';
import { env } from '../config/env';

export async function connectDatabase() {
	try {
		await mongoose.connect(env.mongo, {
			serverSelectionTimeoutMS: 15000,
		});
	} catch (error) {
		const target = new URL(env.mongo).hostname;
		console.error(`MongoDB connection failed for ${target}. Check Atlas Network Access, database credentials, and cluster status.`);
		throw error;
	}
	console.log('MongoDB connected');
}
