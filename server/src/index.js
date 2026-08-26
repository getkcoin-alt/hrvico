import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

import { initDb } from './db.js';
import { authenticate } from './middleware/auth.js';
import { loginLimiter, forgotPasswordLimiter, resendVerificationLimiter } from './middleware/rateLimit.js';

import {
  signup,
  verifyEmail,
  resendVerification,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword
} from './controllers/authController.js';

import {
  getProfile,
  updateProfile,
  changePassword
} from './controllers/ownerController.js';

import {
  listRestaurants,
  createRestaurant,
  getRestaurantById,
  updateRestaurant,
  updateRestaurantStatus
} from './controllers/restaurantController.js';

dotenv.config();

// Initialize DB schema & tables
initDb();

const app = express();
const PORT = process.env.PORT || 4000;

// Security & Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());

// Request correlation ID assignment
app.use((req, res, next) => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    message: 'RestroVico Task 1 Backend API is running.',
    data: {
      status: 'UP',
      timestamp: new Date().toISOString()
    },
    request_id: req.requestId
  });
});

// Auth Routes (Public)
app.post('/api/v1/auth/signup', signup);
app.post('/api/v1/auth/verify-email', verifyEmail);
app.post('/api/v1/auth/resend-verification', resendVerificationLimiter, resendVerification);
app.post('/api/v1/auth/login', loginLimiter, login);
app.post('/api/v1/auth/refresh', refresh);
app.post('/api/v1/auth/logout', logout);
app.post('/api/v1/auth/forgot-password', forgotPasswordLimiter, forgotPassword);
app.post('/api/v1/auth/reset-password', resetPassword);

// Owner Profile Routes (Authenticated)
app.get('/api/v1/me', authenticate, getProfile);
app.patch('/api/v1/me', authenticate, updateProfile);
app.post('/api/v1/me/change-password', authenticate, changePassword);

// Restaurant Routes (Authenticated & Tenant Scoped)
app.get('/api/v1/restaurants', authenticate, listRestaurants);
app.post('/api/v1/restaurants', authenticate, createRestaurant);
app.get('/api/v1/restaurants/:id', authenticate, getRestaurantById);
app.patch('/api/v1/restaurants/:id', authenticate, updateRestaurant);
app.patch('/api/v1/restaurants/:id/status', authenticate, updateRestaurantStatus);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
    data: null,
    request_id: req.requestId
  });
});

// Global Error Handler (Section 12: friendly messages, no raw stack trace to user)
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'An internal server error occurred.',
    data: null,
    request_id: req.requestId
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 RestroVico Task 1 Backend API running on port ${PORT}`);
  console.log(`   Health Check: http://localhost:${PORT}/api/v1/health\n`);
});
