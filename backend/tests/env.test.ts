// Configuration tests must not pick up secrets from a developer's .env file.
jest.mock('dotenv', () => ({ config: jest.fn() }));

describe('Production configuration', () => {
  const originalMode = process.env.NODE_ENV;
  const originalSecret = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalMode;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  it.each([undefined, '', 'short-secret', ' '.repeat(32), 'dev-secret-change-me', 'change-me-to-a-long-random-string', 'REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS'])(
    'rejects an absent or placeholder production secret (%s)', (secret) => {
      process.env.NODE_ENV = 'production';
      if (secret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = secret;
      expect(() => jest.isolateModules(() => require('../src/config/env'))).toThrow('Production JWT_SECRET');
    }
  );

  it('accepts a configured production secret', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-characters';
    expect(() => jest.isolateModules(() => require('../src/config/env'))).not.toThrow();
  });
});

describe('Proxy configuration', () => {
  const originalHops = process.env.TRUST_PROXY_HOPS;

  afterEach(() => {
    if (originalHops === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = originalHops;
  });

  it.each(['-1', '1.5', 'Infinity', 'true'])('rejects invalid proxy hops (%s)', (hops) => {
    process.env.TRUST_PROXY_HOPS = hops;
    expect(() => jest.isolateModules(() => require('../src/config/env'))).toThrow('TRUST_PROXY_HOPS');
  });

  it('defaults to trusting no proxies', () => {
    delete process.env.TRUST_PROXY_HOPS;
    jest.isolateModules(() => {
      expect(require('../src/config/env').env.trustProxyHops).toBe(0);
    });
  });
});
