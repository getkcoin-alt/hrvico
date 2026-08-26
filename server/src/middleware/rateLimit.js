import rateLimit from 'express-rate-limit';

const isDevOrTest = process.env.NODE_ENV !== 'production';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevOrTest ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
    data: null
  }
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: isDevOrTest ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many password reset requests. Please try again after 30 minutes.',
    data: null
  }
});

export const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevOrTest ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification email requests. Please try again later.',
    data: null
  }
});
