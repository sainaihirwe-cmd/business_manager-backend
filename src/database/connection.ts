import mongoose from 'mongoose';
import { env } from '../config/env';
export async function connectDatabase() { await mongoose.connect(env.mongo); console.log('MongoDB connected'); }
