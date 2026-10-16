import rateLimit from 'express-rate-limit';
import type { CorsOptions } from 'cors';

/**
 * Comma-separated list of origins allowed to call the API, e.g.
 * "https://toepen.example,https://www.toepen.example". When it is empty the API
 * is same-origin only (the browser is served from the same host by nginx), so
 * cross-origin requests are refused rather than waved through.
 */
export function allowedOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export function corsOptions(): CorsOptions {
  const allowed = allowedOrigins();
  return {
    origin(origin, callback) {
      // No Origin header: same-origin navigations, curl, and native apps.
      if (!origin) return callback(null, true);
      if (allowed.includes(origin.replace(/\/+$/, ''))) return callback(null, true);
      // Withhold the CORS headers rather than failing the request. Browsers
      // send Origin on same-origin POSTs too, and those must still succeed -
      // erroring here would 500 every form post from our own page. A genuine
      // cross-origin caller simply gets no allow header and is blocked by the
      // browser, which is the behaviour we want.
      return callback(null, false);
    },
    credentials: false,
  };
}

const minutes = (n: number) => n * 60 * 1000;

/** Broad ceiling for the whole API so one client cannot flood the server. */
export const apiLimiter = rateLimit({
  windowMs: minutes(1),
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Te veel verzoeken, probeer het zo weer.' },
});

/**
 * Login and registration are the brute-force targets, so they get a far tighter
 * budget than the rest of the API. Successful logins do not count against it -
 * only failures and repeated attempts do.
 */
export const authLimiter = rateLimit({
  windowMs: minutes(15),
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Te veel inlogpogingen. Wacht even en probeer opnieuw.' },
});

/** Creating tables is cheap for a player but writes a row every time. */
export const createGameLimiter = rateLimit({
  windowMs: minutes(10),
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Te veel tafels aangemaakt. Wacht even.' },
});
