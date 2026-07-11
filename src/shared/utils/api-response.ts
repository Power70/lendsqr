export interface SuccessEnvelope<T> {
  status: 'success';
  data: T;
}

export const success = <T>(data: T): SuccessEnvelope<T> => ({ status: 'success', data });
