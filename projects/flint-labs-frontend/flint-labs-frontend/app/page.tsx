import { redirect } from 'next/navigation';

// The dashboard lives at /dashboard. The root path redirects to /login;
// middleware then forwards already-authenticated users on to /dashboard.
export default function RootPage() {
  redirect('/login');
}
