# Adil Academy LMS

## Product

Adil Academy is a Sinhala-first crypto trading learning platform with:

- Public course sales pages
- Student learning and progress tracking
- Bank Transfer and Binance Pay/USDT payment review
- Student-to-consultant approval
- Sequential SR/CN account management
- Fixed LEFT/RIGHT network placements
- Points, carry-forward, weekly commissions, wallets, and payouts
- Staff and Super Admin operations

## Stack

- React + TypeScript + Vite
- Express + TypeScript
- PostgreSQL + Drizzle ORM
- Zod validation
- Replit App Storage for user uploads
- Replit Scheduled Deployment for Friday commission cycles

## Non-negotiable business rules

1. Account identifiers are sequential and start from an admin-configured value.
2. Never generate random SR/CN numbers.
3. A reserved number becomes final only after authorized approval.
4. Full approved payment is required before course access, points, or commission.
5. Partial payments receive no points.
6. Student main-account conversion preserves the number: SR527694 becomes CN527694.
7. CN ownership cannot be transferred.
8. An active parent/side placement cannot be edited directly.
9. Each parent has only one LEFT and one RIGHT direct slot.
10. The consultant selects the receiving CN account and LEFT/RIGHT placement.
11. Financial and point ledgers are append-only. Corrections use reversal entries.
12. Weekly commission runs must be idempotent.
13. Critical actions must create audit records.
14. Stage history never resets. A 90-day inactivity reset affects current carry-forward only.

## Commission rules

- 1:1 = Rs. 2,500, once per account
- 2:2 = Rs. 5,000, once per account
- 3:3 = Rs. 7,500, at most once per account per weekly cycle
- Weekly release day: Friday

Do not implement ambiguous commission behavior without an explicit rule test.

## Engineering rules

- Keep domain logic outside routes and UI components.
- Validate all API input with Zod.
- Authorize every sensitive API operation on the server.
- Use database transactions for payment approval, account activation, placement, and ledger writes.
- Add unique database constraints for idempotency and placement ownership.
- Never place secrets in source code.
- Never use the local project filesystem for production uploads.
- Keep demo login disabled in production unless ENABLE_DEMO_LOGIN=true is deliberately set.
- Add unit tests for business rules and integration tests for critical workflows.

## UI direction

- Dark black/green/gold Adil Academy branding
- Sinhala-first copy with familiar English trading terms
- Responsive mobile and desktop layouts
- Responsible education language; never guarantee trading profit
- Accessible headings, labels, keyboard controls, and color contrast
