# WORKSPACE SETUP

Version: 1.0

## Repository

Repository name:
luz-app

## Local Folder

Recommended local folder name:
luz-app

## Initial Setup

1. Clone repository.
2. Configure Git identity.
3. Configure SSH with GitHub.
4. Copy .env.example to .env.
5. Install dependencies:
   npm install
6. Start local database.
7. Run migrations.
8. Start Next.js:
   npm run dev
9. Start Worker:
   npm run worker

## Verify

git status
git remote -v
npm run lint
npm run typecheck
