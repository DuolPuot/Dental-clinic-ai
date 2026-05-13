/**
 * Vitest global test setup.
 * Runs before all test files.
 */

// Set test environment variables before any module imports
process.env['NODE_ENV'] = 'test';
process.env['JWT_ACCESS_SECRET'] = 'test-access-secret-that-is-at-least-32-chars-long';
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-that-is-at-least-32-chars-long';
process.env['MONGODB_URI'] = 'mongodb://localhost:27017/dental_clinic_test';
process.env['REDIS_URL'] = 'redis://localhost:6379/1';
