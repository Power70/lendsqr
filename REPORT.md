# Demo Credit — Security Assessment & API Review Report

## 1. Security Assessment

### How the API endpoints are secured

Every endpoint except signup, login, and health checks requires a **Bearer JWT** (HS256, ≥32-byte secret from environment, 24-hour expiry), verified on every request. The authenticated user is re-loaded from the database per request, so a token becomes useless the moment its account is suspended or deleted — before expiry. Baseline hardening: **helmet** security headers, **per-IP rate limiting** (a general budget on `/api`, a 10-per-window bucket on signup/login against brute force), a 100 KB JSON body limit, `x-powered-by` disabled, and TLS terminated by the hosting platform.

### Authentication and authorization within scope

Authentication is deliberately "faux" per the brief but structurally sound: bcrypt (cost 12) password hashing, signed expiring tokens, and one generic `INVALID_CREDENTIALS` error for both unknown email and wrong password so accounts cannot be enumerated. Authorization is **ownership scoping by construction**: every wallet and transaction query is filtered by the authenticated user's id at the repository layer. No private endpoint accepts a caller-supplied user id, which eliminates IDOR/BOLA as a class — probing another user's transaction reference returns the same 404 as a nonexistent one.

### Vulnerabilities considered and mitigations

| Vulnerability | Mitigation |
|---|---|
| Double-spend / balance race | `SELECT … FOR UPDATE` row locks; balance checked **under the lock**; proven by concurrent integration tests |
| Deadlocks between crossing transfers | Both wallets locked in one query in ascending-id order — prevention, not retry |
| Replayed / duplicated requests | Mandatory `Idempotency-Key` on all money endpoints, scoped (user, key, endpoint), body-hash checked; completion commits inside the money transaction |
| Negative / float / oversized amounts | zod: integer kobo, min 100, max ₦100 m — plus DB `CHECK` constraints and unsigned columns as a second line |
| SQL injection | Knex parameter binding everywhere; zero string-built SQL |
| Blacklisted onboarding bypass | Adjutor Karma checked (BVN, email, phone) **before** any row is created; **fails closed** if Adjutor is unreachable |
| Ledger tampering | Append-only tables; corrections are reversal transactions |
| Account enumeration | Generic auth errors; transfers addressed by wallet id; uniform 404s |
| Secret leakage | All secrets in validated env; axios interceptor never logs the Adjutor key; pino redacts `authorization` headers and password fields; masked payout destinations (last-4 only) in ledger metadata |

### Input validation and backend protection

Every route validates its body/query/params with **zod at the edge**; the parsed result *replaces* the raw input, unknown keys are stripped, and handlers never touch unvalidated data. The upstream Adjutor response is itself schema-validated — when the live API returned an undocumented shape, the service refused to onboard rather than guess (fail-closed), which is exactly the intended behaviour. Internal invariants are defended too: an unbalanced ledger posting throws a non-operational error and rolls back rather than persisting corrupt state.

### Production security improvements

Refresh-token rotation with device binding and MFA on withdrawals; real BVN/KYC verification with tiered transaction limits; Redis-backed rate limiting (multi-instance); a fraud/velocity rules engine; secrets manager with rotation; WAF; dependency and SAST scanning in CI; periodic penetration tests.

## 2. Failure Handling & Debugging Assessment

### Handling failures and unexpected errors

Errors are split into two classes. **Operational errors** (`AppError`) carry an HTTP status and a stable machine-readable code (`INSUFFICIENT_FUNDS`, `USER_BLACKLISTED`, `REQUEST_IN_FLIGHT`…) and are logged at `warn`. **Unexpected errors** are logged at `error` with full stack while the client receives an opaque 500 — internals never leak. A single global error middleware is the only place errors become responses. Because every money operation runs in one database transaction, any failure — including a process crash mid-transfer — rolls back completely; partial writes are impossible. Idempotency rows stuck in `processing` by a crash are taken over after a 60-second staleness window, so a client retry succeeds cleanly instead of being locked out.

### Detecting, debugging, and tracing issues

Every request gets an **X-Request-Id** (inbound header honoured, UUID otherwise) that is attached to every log line and returned in every response — including error envelopes. Given a user complaint, one grep over the structured pino JSON logs reconstructs the request; the logged `transaction_reference` then leads to the immutable ledger. Log levels are disciplined so `error` is a page-worthy signal: business events at `info`, handled anomalies (insufficient funds, blacklist hits, replays) at `warn`.

### Logging, monitoring, and reliability

Structured JSON logs (pino) with secret redaction; `/health` (liveness) and `/health/ready` (DB ping with a bounded 5-second connection timeout) for platform monitoring; graceful shutdown that drains in-flight requests and releases the connection pool. Reliability is enforced continuously by **`npm run reconcile`**: for every wallet, `SUM(credits) − SUM(debits)` must equal the cached balance, and all ledger entries must sum to zero globally. It runs in the integration suite and as a CLI against the deployed database; in production it becomes a scheduled job with alerting.

### Example failure scenario and diagnosis

*A user reports: "my transfer failed but I was debited."* Diagnosis: take the `request_id` from the client's error response → grep the logs → find the `transaction_reference` → query `transactions` and `transaction_entries`. Double-entry makes the truth unambiguous. Either the transaction **committed** (balanced DEBIT/CREDIT lines exist, the recipient was credited — the client merely missed the response, and retrying with the same `Idempotency-Key` would have replayed the stored success), or it **rolled back** (no ledger rows, no debit — the "debit" was a stale balance display). If a genuine bug ever produced drift, `reconcile` pinpoints the wallet, a reversal transaction corrects the books without editing history, and a regression test reproducing the interleaving is added — the same discipline used during this build, where a live Adjutor response-shape mismatch was caught by schema validation, diagnosed from a single warn log, fixed, and pinned with a test.
