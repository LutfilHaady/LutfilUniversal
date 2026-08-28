---
name: project-auth-phase
description: "Auth phase implementation status — login, middleware, AuthContext, profile popout, sign-out all complete"
metadata: 
  node_type: memory
  type: project
  originSessionId: e5dcb7b5-a197-439c-a577-6451d2d3ae38
---

Phase 4 (Auth + Login) is now substantially complete:

- `lib/supabase.ts` — `createBrowserClient` from `@supabase/ssr` (cookie-based, readable by middleware)
- `lib/auth-context.tsx` — `AuthContext` with `{ id, email, name, role }`, `AuthProvider` in root layout
- `app/login/page.tsx` — Login page; auth error = banner only, field errors = red borders for client-side validation only
- `middleware.ts` — `createServerClient` + `getUser()` at the edge; unauthenticated → `/login`, authenticated + on `/login` → `/`
- `components/header.tsx` — `ProfileMenu` popout (user info, Profile Settings, Change Password, Sign Out in rose); dynamic from AuthContext; click-outside + Escape to close; chevron rotates on open
- `components/shell.tsx` — client-side back-nav guard via `useEffect` watching `user + loading`

**Why:** Auth was 0% complete; needed full flow: login → session → role → protected pages → sign-out → back to login.

**How to apply:** Middleware handles route protection at the edge. Shell has a fallback client guard. Name derived from `user_metadata.full_name`, fallback derives from email local part. `NEXT_PUBLIC_SUPABASE_ANON_KEY` filled in `.env.local` by user.
