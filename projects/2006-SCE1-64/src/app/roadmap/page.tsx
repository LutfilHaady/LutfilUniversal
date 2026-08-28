'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/supabaseClient';

import { AppShell } from '@/components/layout/app-shell';
import { CareerRoadmap } from '@/components/roadmap/career-roadmap';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function RoadmapPage() {
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
            <CardTitle className="font-headline">Your Career Roadmap</CardTitle>
            <CardDescription>
              A personalized, step-by-step guide to help you achieve your career goals.
            </CardDescription>
          </CardHeader>
        </Card>
        <CareerRoadmap />
      </div>
    </AppShell>
  );
}
