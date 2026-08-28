'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { AppShell } from '@/components/layout/app-shell';
import { UserProfileCard } from '@/components/dashboard/user-profile-card';
import { KeyMetricsCards } from '@/components/dashboard/key-metrics-cards';
import { SalaryChart } from '@/components/dashboard/salary-chart';
import { Recommendations } from '@/components/dashboard/recommendations';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { CareerRoadmapPreview } from '@/components/dashboard/career-roadmap-preview';
import { JobHeatmap } from '@/components/dashboard/job-heatmap';
import { CourseSearch } from '@/components/dashboard/course-searchbar';

import { supabase } from '@/backend/supabaseClient';
import { supabase2 } from '@/backend/supabaseClient';

// ───────────────────────── helpers ─────────────────────────
async function getSalaryTrendData(industryName: string) {
  const { data, error } = await supabase2
    .from('ges_data')
    .select('year, gross_monthly_mean')
    .ilike('industry', industryName)
    .order('year', { ascending: true });

  if (error) {
    console.error('Error fetching salary data:', error.message);
    return [];
  }
  return data ?? [];
}

// aggregate multiple rows per year into a single avg
function aggregateByYear(
  data: { year: number; gross_monthly_mean: number | null }[]
) {
  if (!data.length) return [];
  const years = data.map((d) => d.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  const grouped: Record<number, number[]> = {};
  data.forEach(({ year, gross_monthly_mean }) => {
    if (!grouped[year]) grouped[year] = [];
    if (gross_monthly_mean !== null) grouped[year].push(gross_monthly_mean);
  });

  const filled: { year: number; gross_monthly_mean: number | null }[] = [];
  for (let y = minYear; y <= maxYear; y++) {
    const salaries = grouped[y] ?? [];
    const avg =
      salaries.length > 0
        ? salaries.reduce((a, b) => a + b, 0) / salaries.length
        : null;
    filled.push({ year: y, gross_monthly_mean: avg });
  }
  return filled;
}

// ───────────────────────── page ─────────────────────────
export default function DashboardPage() {
  const router = useRouter();

  const [refresh, setRefresh] = useState(false);
  const [status, setStatus] =
    useState<'checking' | 'not_verified' | 'verified'>('checking');

  const [salaryData, setSalaryData] = useState<
    Record<string, { year: number; gross_monthly_mean: number | null }[]>
  >({});

  const [allIndustries, setAllIndustries] = useState<string[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);

  // ── 1) auth + email check ──
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

  // ── 2) fetch industry list once ──
  useEffect(() => {
    async function fetchIndustries() {
      const { data, error } = await supabase2
        .from('ges_data')
        .select('industry');
      if (error) {
        console.error('Error fetching industries:', error.message);
        return;
      }
      const unique = Array.from(new Set(data.map((d) => d.industry))).sort();
      setAllIndustries(unique);
      setSelectedIndustries(unique.slice(0, 2));
    }
    fetchIndustries();
  }, []);

  // ── 3) fetch salary data whenever selection changes ──
  useEffect(() => {
    if (status !== 'verified') return;
    if (selectedIndustries.length === 0) return;

    async function fetchAll() {
      const result: Record<
        string,
        { year: number; gross_monthly_mean: number | null }[]
      > = {};
      for (const ind of selectedIndustries) {
        const raw = await getSalaryTrendData(ind);
        result[ind] = aggregateByYear(raw);
      }
      setSalaryData(result);
    }

    fetchAll();
  }, [status, selectedIndustries]);

  if (status === 'checking' || status === 'not_verified') return null;

  return (
    <AppShell>
      <div className="space-y-8">

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
            {/* LEFT COLUMN */}
            <div className="col-span-1 flex flex-col gap-6 lg:gap-8">
              <UserProfileCard key={refresh ? 'refresh-1' : 'refresh-0'} />
              <KeyMetricsCards />

              {/* industry multi-select (made nicer) */}
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="font-headline text-base">
                    Select Industries
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Pick 1–3 industries to compare salary trends.
                  </p>
                  <div className="max-h-[220px] overflow-y-auto pr-1">
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
                      {allIndustries.map((ind) => {
                      const selected = selectedIndustries.includes(ind);
                      return (
                        <button
                          key={ind}
                          onClick={() => {
                            if (selected) {
                              //remove
                              setSelectedIndustries(selectedIndustries.filter((i) => i !== ind));
                            } else if (selectedIndustries.length < 3) {
                              //add
                              setSelectedIndustries([...selectedIndustries, ind]);
                            }
                          }}
                          className={`rounded-lg border px-3 py-2 text-sm transition ${
                            selected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background hover:bg-muted border-border text-foreground'
                          }`}
                        >
                          {ind}
                        </button>
                      );
                    })}
                    </div>
                  </div>
                  <p className="grid grid-cols-2 gap-2">

                  </p>

                </CardContent>
              </Card>
            </div>

            {/* RIGHT COLUMN */}
            <div className="col-span-1 space-y-6 lg:col-span-2 lg:space-y-8">
              {/* 1) Heatmap full width */}
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="font-headline">
                    Job Availability Heatmap (Singapore)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <JobHeatmap />
                </CardContent>
              </Card>

              {/* 2) Salary full width, slightly shorter */}
              <Card className="rounded-2xl lg:h-[340px]">
                <CardHeader className="pb-2">
                  <CardTitle className="font-headline">
                    Salary Trends
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-full">
                  <SalaryChart
                    data={salaryData}
                    selectedIndustries={selectedIndustries}
                  />
                </CardContent>
              </Card>

              {/* 3) Recommendations + Roadmap below salary */}
              <div className="grid gap-6 md:grid-cols-2">
                <Recommendations />
                <CareerRoadmapPreview />
              </div>
            </div>
        </div>
      </div>
    </AppShell>
  );
}
