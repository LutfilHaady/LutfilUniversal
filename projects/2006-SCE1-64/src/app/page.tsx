'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/supabaseClient';
import { LoginForm } from '@/components/auth/login-form';
import { Logo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import Link from 'next/link';


export default function LoginPage() {
  const router = useRouter();

  // Check if user is already logged in
  useEffect(() => {
    async function checkAuth() {
      const { data } = await supabase.auth.getUser();
      
      // If user is logged in and email is verified, redirect to dashboard
      if (data?.user && data.user.email_confirmed_at) {
        router.push('/dashboard');
      }
    }
    
    checkAuth();
  }, [router]);

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
      <div className="relative hidden items-center justify-center bg-muted p-10 lg:flex">
        <div className="absolute inset-0 bg-primary/10" />
        <div className="relative z-10 flex flex-col items-center text-center">
            <Logo width="200" height="40" className="mb-6" />
          <h1 className="font-headline text-4xl font-bold text-primary">
            Your Personalized Career Navigator
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Gain insights into job trends, find relevant courses, and build your
            career roadmap.
          </p>
        </div>
      </div>
      <div className="flex min-h-screen items-center justify-center p-6 lg:p-8">
        <div className="mx-auto flex w-full max-w-sm flex-col justify-center space-y-6">
          <LoginForm />
          <p className="px-8 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Button variant="link" asChild className="p-0 underline">
              <Link href="/signup">Sign up</Link>
            </Button>
          </p>
        </div>
      </div>
    </div>
  );
}
