// All monetary amounts are integers in kobo (minor units)
export const MIN_TRANSACTION_AMOUNT_KOBO = 100;

// ₦100m cap per request — bounds both abuse and JS safe-integer arithmetic
export const MAX_TRANSACTION_AMOUNT_KOBO = 10_000_000_000;
