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
    { name: 'Transactions', description: 'Transfers and transaction history' },
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
      TransferRequest: {
        type: 'object',
        required: ['recipient_wallet_id', 'amount'],
        properties: {
          recipient_wallet_id: { type: 'string', format: 'uuid' },
          amount: { type: 'integer', description: 'kobo', example: 250000 },
          narration: { type: 'string', maxLength: 255, example: 'rent' },
        },
      },
      WithdrawRequest: {
        type: 'object',
        required: ['amount', 'bank_code', 'account_number'],
        properties: {
          amount: { type: 'integer', description: 'kobo', example: 100000 },
          bank_code: { type: 'string', example: '058' },
          account_number: { type: 'string', description: '10-digit NUBAN', example: '0123456789' },
          narration: { type: 'string', maxLength: 255 },
        },
      },
      StatementItem: {
        type: 'object',
        properties: {
          entry_id: { type: 'integer' },
          reference: { type: 'string' },
          type: { type: 'string', enum: ['FUNDING', 'TRANSFER', 'WITHDRAWAL'] },
          status: { type: 'string', enum: ['SUCCESS', 'FAILED', 'REVERSED'] },
          direction: { type: 'string', enum: ['DEBIT', 'CREDIT'] },
          amount: { type: 'integer' },
          balance_after: { type: 'integer', nullable: true },
          narration: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
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
    '/api/v1/wallets/me': {
      get: {
        tags: ['Wallets'],
        summary: 'Own wallet balance and status',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Wallet details' },
          '401': { description: 'Missing or invalid token' },
        },
      },
    },
    '/api/v1/wallets/withdraw': {
      post: {
        tags: ['Wallets'],
        summary: 'Withdraw to a bank account (simulated payout)',
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/WithdrawRequest' } },
          },
        },
        responses: {
          '201': { description: 'Wallet debited' },
          '400': { description: 'Invalid input or missing Idempotency-Key' },
          '401': { description: 'Missing or invalid token' },
          '409': { description: 'Idempotency conflict' },
          '422': {
            description: 'Insufficient funds or inactive wallet',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/v1/transactions/transfer': {
      post: {
        tags: ['Transactions'],
        summary: "Transfer to another user's wallet",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/TransferRequest' } },
          },
        },
        responses: {
          '201': { description: 'Transfer settled' },
          '400': { description: 'Invalid input or missing Idempotency-Key' },
          '401': { description: 'Missing or invalid token' },
          '404': { description: 'Recipient wallet not found' },
          '409': { description: 'Idempotency conflict' },
          '422': {
            description: 'Insufficient funds, self-transfer or inactive wallet',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/v1/transactions': {
      get: {
        tags: ['Transactions'],
        summary: 'Own transaction history (keyset paginated)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
          {
            name: 'cursor',
            in: 'query',
            schema: { type: 'integer' },
            description: 'entry_id from the previous page (next_cursor)',
          },
        ],
        responses: {
          '200': {
            description: 'Statement page',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: {
                      type: 'object',
                      properties: {
                        items: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/StatementItem' },
                        },
                        next_cursor: { type: 'integer', nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'Missing or invalid token' },
        },
      },
    },
    '/api/v1/transactions/{reference}': {
      get: {
        tags: ['Transactions'],
        summary: 'Single transaction by reference (own wallet only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'reference',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'TXN-20260711-7QG26D7H' },
          },
        ],
        responses: {
          '200': { description: 'Transaction detail' },
          '401': { description: 'Missing or invalid token' },
          '404': { description: 'Unknown reference, or not your transaction' },
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
