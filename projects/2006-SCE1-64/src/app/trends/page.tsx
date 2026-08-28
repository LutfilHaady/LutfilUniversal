'use client';
import { AppShell } from '@/components/layout/app-shell';
import { IndustryComparison } from '@/components/trends/industry-comparison';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/supabaseClient';


export default function TrendsPage() {
    const router = useRouter();
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let mounted = true;
    async function checkVerification() {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.push('/');
        return;
      }
      if (!data.user.email_confirmed_at) {
        if (mounted) setStatus('not_verified');
        router.push('/verify');
      } else {
        if (mounted) setStatus('verified');
      }
    }
    checkVerification();
    return () => {
      mounted = false;
    };
  }, [router]);

  if (status === 'checking' || status === 'not_verified') return null;
  return (
    <AppShell>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Industry Comparison</CardTitle>
            <CardDescription>
              Select two industries to compare salary trends, in-demand skills, and recommended education paths.
            </CardDescription>
          </CardHeader>
        </Card>
        <IndustryComparison />
      </div>
    </AppShell>
  );
}
