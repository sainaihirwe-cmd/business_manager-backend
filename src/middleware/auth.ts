import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
export interface AuthRequest extends Request { user?: { id:string; businessId:string } }
export function requireAuth(req:AuthRequest,res:Response,next:NextFunction) { const token=req.headers.authorization?.replace('Bearer ',''); if(!token) return res.status(401).json({message:'Authentication required'}); try { req.user=jwt.verify(token,env.jwtSecret) as {id:string;businessId:string}; next(); } catch { return res.status(401).json({message:'Invalid or expired token'}); } }
