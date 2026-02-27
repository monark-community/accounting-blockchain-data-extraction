import request from 'supertest';
import app from '../src/index';

describe('Health Check Endpoint', () => {
  it('should return 200 and status ok', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body.uptime).toBeGreaterThan(0);
  });

  it('should include environment information', async () => {
    const response = await request(app).get('/health');

    expect(response.body).toHaveProperty('environment');
    expect(['development', 'production', 'test']).toContain(
      response.body.environment
    );
  });
});

describe('Root Endpoint', () => {
  it('should return API information', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('LedgerLift API');
  });
});

describe('404 Handler', () => {
  it('should return 404 for unknown routes', async () => {
    const response = await request(app).get('/api/unknown-route');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('status', 'error');
    expect(response.body).toHaveProperty('message', 'Route not found');
  });
});
