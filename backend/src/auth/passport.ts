import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { prisma } from '../services/prisma';
import { comparePassword } from './password';
import { env } from '../config/env';
import { logger } from '../utils/logger';

passport.use(
  new LocalStrategy({ usernameField: 'email', passwordField: 'password' }, async (email, password, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!user || !user.passwordHash) {
        return done(null, false, { message: 'Invalid email or password' });
      }
      const valid = await comparePassword(password, user.passwordHash);
      if (!valid) {
        return done(null, false, { message: 'Invalid email or password' });
      }
      return done(null, user);
    } catch (err) {
      return done(err as Error);
    }
  })
);

// Google and GitHub OAuth are scaffolded but disabled by default.
// To enable: set ENABLE_GOOGLE_OAUTH=true / ENABLE_GITHUB_OAUTH=true and supply
// the corresponding client id/secret + callback URL env vars, then mount the
// routes in auth.routes.ts (see comments there).
if (env.enableGoogleOAuth) {
  if (!env.googleClientId || !env.googleClientSecret) {
    logger.warn('ENABLE_GOOGLE_OAUTH is true but GOOGLE_CLIENT_ID/SECRET are missing; skipping strategy setup');
  } else {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const GoogleStrategy = require('passport-google-oauth20').Strategy;
    passport.use(
      new GoogleStrategy(
        {
          clientID: env.googleClientId,
          clientSecret: env.googleClientSecret,
          callbackURL: '/api/auth/google/callback',
        },
        async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('Google profile has no email'));
            let user = await prisma.user.findUnique({ where: { email } });
            if (!user) {
              user = await prisma.user.create({
                data: { email, provider: 'GOOGLE', providerId: profile.id },
              });
            }
            return done(null, user);
          } catch (err) {
            return done(err as Error);
          }
        }
      )
    );
  }
}

if (env.enableGithubOAuth) {
  if (!env.githubClientId || !env.githubClientSecret) {
    logger.warn('ENABLE_GITHUB_OAUTH is true but GITHUB_CLIENT_ID/SECRET are missing; skipping strategy setup');
  } else {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const GitHubStrategy = require('passport-github2').Strategy;
    passport.use(
      new GitHubStrategy(
        {
          clientID: env.githubClientId,
          clientSecret: env.githubClientSecret,
          callbackURL: '/api/auth/github/callback',
        },
        async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
          try {
            const email = profile.emails?.[0]?.value ?? `${profile.username}@users.noreply.github.com`;
            let user = await prisma.user.findUnique({ where: { email } });
            if (!user) {
              user = await prisma.user.create({
                data: { email, provider: 'GITHUB', providerId: profile.id },
              });
            }
            return done(null, user);
          } catch (err) {
            return done(err as Error);
          }
        }
      )
    );
  }
}

export default passport;
