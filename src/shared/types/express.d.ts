// Augments Express so `req.user` (set by the authenticate middleware) is typed
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        status: 'active' | 'suspended';
      };
    }
  }
}

export {};
