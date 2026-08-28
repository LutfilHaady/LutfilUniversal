'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Briefcase, ArrowUp, Zap } from 'lucide-react';
import { supabase3 } from '@/backend/supabaseClient';

export function KeyMetricsCards() {
  const [inDemandSkills, setInDemandSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopSkills = async () => {
      setLoading(true);
      const { data, error } = await supabase3
        .from('Skills')
        .select('skillsName')
        .order('popularityScore', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching top skills:', error);
        setInDemandSkills([]);
      } else {
        setInDemandSkills(data?.map((s) => s.skillsName.charAt(0).toUpperCase() + s.skillsName.slice(1)) || []
);

      }
      setLoading(false);
    };

    fetchTopSkills();
  }, []);

  return (
    <div className="space-y-6 lg:space-y-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Skills in Demand</CardTitle>
          <Zap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading top skills...</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {inDemandSkills.map((skill) => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Job Availability</CardTitle>
          <Briefcase className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">1,250+</div>
          <p className="text-xs text-muted-foreground">
            Open roles matching your profile in Singapore
          </p>
          <div className="mt-2 flex items-center text-sm text-green-600">
            <ArrowUp className="h-4 w-4" />
            <span className="ml-1">+12% from last month</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
