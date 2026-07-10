// Hand-maintained OpenAPI spec, extended as endpoints land each day.
// Served at /docs via swagger-ui-express.
export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Demo Credit Wallet API',
    version: '0.1.0',
    description:
      'MVP wallet service: onboarding, funding, transfers and withdrawals. ' +
      'All monetary amounts are integers in kobo (minor units).',
  },
  servers: [{ url: 'http://localhost:3000' }],
  tags: [
    { name: 'Health', description: 'Liveness and readiness probes' },
    { name: 'Users', description: 'Onboarding' },
    { name: 'Auth', description: 'Faux token authentication' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'error' },
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          message: { type: 'string' },
          request_id: { type: 'string', format: 'uuid' },
        },
      },
      CreateUserRequest: {
        type: 'object',
        required: ['email', 'phone', 'bvn', 'password', 'first_name', 'last_name'],
        properties: {
          email: { type: 'string', format: 'email', example: 'ada.obi@example.com' },
          phone: {
            type: 'string',
            description: 'Nigerian number in E.164 format',
            example: '+2348012345678',
          },
          bvn: {
            type: 'string',
            description: '11 digits — dummy values accepted in this MVP',
            example: '12345678901',
          },
          password: { type: 'string', minLength: 8, maxLength: 72, example: 'correct-horse-9' },
          first_name: { type: 'string', example: 'Ada' },
          last_name: { type: 'string', example: 'Obi' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'ada.obi@example.com' },
          password: { type: 'string', example: 'correct-horse-9' },
        },
      },
      PublicUser: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string' },
          phone: { type: 'string' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
        },
      },
      Wallet: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          balance: { type: 'integer', description: 'kobo', example: 0 },
          currency: { type: 'string', example: 'NGN' },
          status: { type: 'string', example: 'active' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Liveness probe',
        responses: { '200': { description: 'Process is up' } },
      },
    },
    '/health/ready': {
      get: {
        tags: ['Health'],
        summary: 'Readiness probe (pings MySQL)',
        responses: {
          '200': { description: 'Database reachable' },
          '503': { description: 'Database unreachable' },
        },
      },
    },
    '/api/v1/users': {
      post: {
        tags: ['Users'],
        summary: 'Create an account (Karma blacklist check lands Day 3)',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateUserRequest' } },
          },
        },
        responses: {
          '201': {
            description: 'User, zero-balance wallet and token',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/PublicUser' },
                        wallet: { $ref: '#/components/schemas/Wallet' },
                        token: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation failed',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '409': {
            description: 'Email, phone or BVN already registered',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Exchange credentials for a JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } },
          },
        },
        responses: {
          '200': { description: 'Token issued' },
          '401': {
            description: 'Invalid credentials (same error for unknown email and wrong password)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '403': {
            description: 'Account suspended',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
  },
} as const;
