// Hand-maintained OpenAPI spec served at /docs via swagger-ui-express
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
    { name: 'Wallets', description: 'Wallet funding and withdrawals' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    parameters: {
      IdempotencyKey: {
        name: 'Idempotency-Key',
        in: 'header',
        required: true,
        schema: { type: 'string', minLength: 8, maxLength: 64 },
        description:
          'Unique key per logical operation (a UUID works). Retrying with the same key ' +
          'and body replays the original response instead of moving money twice.',
      },
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
      FundWalletRequest: {
        type: 'object',
        required: ['amount'],
        properties: {
          amount: {
            type: 'integer',
            description: 'kobo, 100 to 10,000,000,000',
            example: 500000,
          },
          narration: { type: 'string', maxLength: 255, example: 'wallet top-up' },
        },
      },
      MoneyOperationResult: {
        type: 'object',
        properties: {
          reference: { type: 'string', example: 'TXN-20260711-8F3K2MPQ' },
          amount: { type: 'integer', example: 500000 },
          balance_after: { type: 'integer', example: 500000 },
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
        summary: 'Create an account (rejected if on the Adjutor Karma blacklist)',
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
          '403': {
            description: 'Profile appears on the Karma blacklist',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '409': {
            description: 'Email, phone or BVN already registered',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '503': {
            description: 'Blacklist status could not be verified — retry later',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/v1/wallets/fund': {
      post: {
        tags: ['Wallets'],
        summary: 'Fund own wallet (simulated settlement)',
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/FundWalletRequest' } },
          },
        },
        responses: {
          '201': {
            description: 'Wallet credited (X-Idempotent-Replay: true on replays)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: { $ref: '#/components/schemas/MoneyOperationResult' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid amount or missing Idempotency-Key',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '401': { description: 'Missing or invalid token' },
          '409': {
            description: 'Idempotency conflict (key reused with different body, or in flight)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '422': {
            description: 'Wallet cannot receive funds',
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
