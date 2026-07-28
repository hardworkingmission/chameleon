import { Router } from 'express';
import passport from '../auth/passport';
import { register, login, logout, me } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { authRateLimiter } from '../middleware/rateLimit.middleware';
import { env } from '../config/env';
import { signToken } from '../auth/jwt';

const router = Router();

router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

// Google/GitHub OAuth routes are only mounted when explicitly enabled via env.
// This keeps the app fully functional with email/password only until OAuth
// app credentials are configured (see README "Enabling OAuth").
if (env.enableGoogleOAuth) {
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
  router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    (req, res) => {
      const user = req.user as unknown as { id: number; email: string };
      const token = signToken({ userId: user.id, email: user.email });
      res.redirect(`${env.corsOrigin}/oauth/callback?token=${token}`);
    }
  );
}

if (env.enableGithubOAuth) {
  router.get('/github', passport.authenticate('github', { scope: ['user:email'], session: false }));
  router.get(
    '/github/callback',
    passport.authenticate('github', { session: false, failureRedirect: '/login' }),
    (req, res) => {
      const user = req.user as unknown as { id: number; email: string };
      const token = signToken({ userId: user.id, email: user.email });
      res.redirect(`${env.corsOrigin}/oauth/callback?token=${token}`);
    }
  );
}

export default router;
