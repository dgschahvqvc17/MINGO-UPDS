jest.mock('serverless-http', () => jest.fn(() => jest.fn()));
jest.mock('../src/app', () => ({}));

const serverless = require('serverless-http');
const app = require('../src/app');

describe('Lambda de la API HTTP', () => {
  it('adapta la aplicacion Express con serverless-http', () => {
    const { handler } = require('../src/lambda/api');

    expect(serverless).toHaveBeenCalledWith(app);
    expect(typeof handler).toBe('function');
  });
});
