# Adil Academy LMS

Production-ready Replit codebase for the Adil Academy Sinhala crypto trading LMS and consultant platform.

## Included

- Responsive Adil Academy marketing website
- Course curriculum and platform sections
- Student, Consultant, Staff, and Super Admin workspaces
- Password authentication with Argon2 and database-backed HTTP-only sessions
- Course, lesson, progress, quiz, certificate, coupon, notification, support, and audit APIs
- Bank/USDT payment proof uploads, staff review, atomic enrollment and SR activation
- Consultant approval, immutable SR-to-CN conversion, binary placements, points and carry-forward
- Friday commission calculation, admin release, wallets, payout requests, and 90-day inactivity reset
- PostgreSQL/Drizzle schema with 30 tables and generated migrations
- Replit App Storage integration for private proof files
- Automated business-rule tests
- Replit development and deployment configuration

## Run on Replit

1. Import or upload this project to Replit.
2. Add PostgreSQL and App Storage integrations.
3. Add the secrets listed below.
4. Run `npm install`, `npm run db:migrate`, and `npm run db:seed`.
5. Click Run or run `npm run dev`; open port 3000.

## Verification commands

    npm install
    npm run dev
    npm run check
    npm test
    npm run build

## Replit Database

Add the Replit PostgreSQL Database integration. Replit will provide DATABASE_URL.

Apply the included generated migrations:

    npm run db:migrate
    npm run db:seed

## Required production secrets

- DATABASE_URL
- SESSION_SECRET
- ADMIN_EMAIL
- ADMIN_PASSWORD
- Replit App Storage configuration supplied by its integration

Do not enable ENABLE_DEMO_LOGIN in production.

## Scheduled jobs

Create two Replit Scheduled Deployments:

- Every Friday after midnight Asia/Colombo: `npm run job:weekly-commission`
- Daily: `npm run job:inactivity-reset`

The Friday job calculates each unique cycle once and moves awards to pending wallets. A Super Admin must approve the calculated cycle before balances become withdrawable.

## Production deployment

Use an Autoscale Deployment with build command `npm run build` and run command `npm start`. Keep `ENABLE_DEMO_LOGIN` unset. Configure the public custom domain and HTTPS in Replit, then confirm `/api/health` returns an OK response.

## Operational launch checklist

- Set the course price, points, curriculum, video IDs, and publish status.
- Configure payment receiving details and additional platform settings in Admin.
- Create staff accounts and test least-privilege access.
- Complete one full payment → enrollment → SR activation test.
- Complete consultant approval → CN conversion → LEFT/RIGHT placement test.
- Run a test commission cycle and payout approval with non-production data.
- Replace demo copy and contact details, then disable all preview credentials.
