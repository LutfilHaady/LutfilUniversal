# Database Connection Fix Required

## Issue
Prisma is throwing `"prepared statement already exists"` errors when using Supabase's PgBouncer connection pooler.

## Root Cause
Prisma uses prepared statements by default, but PgBouncer in transaction mode doesn't support prepared statements properly when multiple connections are created.

## Fix Required

You need to update your `.env.local` file to add `connection_limit=1` to your DATABASE_URL.

### Current format (likely):
```
DATABASE_URL=postgresql://postgres.dqhbxjbh...:6543/postgres?pgbouncer=true
```

### Required format:
```
DATABASE_URL=postgresql://postgres.dqhbxjbh...:6543/postgres?pgbouncer=true&connection_limit=1
```

### Steps:
1. Open your `.env.local` file in the project root
2. Find the `DATABASE_URL` line
3. Add `&connection_limit=1` at the end (before any other parameters, or after `?pgbouncer=true`)
4. Save the file
5. Restart your Next.js dev server (`npm run dev`)

## Why This Works
The `connection_limit=1` parameter tells Prisma to only create a single connection, which prevents prepared statement conflicts with PgBouncer's connection pooling.



