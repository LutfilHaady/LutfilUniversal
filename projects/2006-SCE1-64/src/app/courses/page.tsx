'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { CourseSearch } from '@/components/courses/course-search';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/backend/supabaseClient';


export default function CoursesPage() {
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
                <CardTitle className="font-headline">SkillsFuture Course Search</CardTitle>
                <CardDescription>
                    Search for courses from SkillsFuture Singapore to upgrade your skills and advance your career.
                </CardDescription>
            </CardHeader>
        </Card>
        <CourseSearch />
      </div>
    </AppShell>
  );
}
