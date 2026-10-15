process.env.NODE_ENV = 'test';
process.env.STORAGE_DRIVER = 'local';
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'mysql://chameleon:chameleon@localhost:3306/chameleon_test';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.UPLOAD_DIR = './tests/tmp/uploads';
process.env.CONVERTED_DIR = './tests/tmp/converted';
process.env.RATE_LIMIT_MAX = '1000';
