# Backend Agent Memory

## Architectural
- [2026-05-01] For the verified instant-jobs marketplace planned from issue #47/#50, the conservative backend starting point is a modular monolith in TypeScript/NestJS with PostgreSQL, Redis, async workers, OTP-first auth, and trust/verification-first domain modules before any microservice split.
