'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, Circle, CircleDot } from 'lucide-react';
import { useRoadmap } from '@/contexts/roadmap-context';

export function CareerRoadmapPreview() {
  const { roadmap } = useRoadmap();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-accent" />;
      case 'in_progress':
        return <CircleDot className="h-5 w-5 text-primary" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Career Roadmap</CardTitle>
        <CardDescription>
          Your next steps to becoming a Senior Software Engineer.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ul className="space-y-3">
          {roadmap.slice(0, 4).map((step, index) => (
            <li key={index} className="flex items-center gap-3">
              {getStatusIcon(step.status)}
              <span
                className={
                  step.status === 'completed'
                    ? 'text-muted-foreground line-through'
                    : 'font-medium'
                }
              >
                {step.title}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        <Button asChild variant="outline">
          <Link href="/roadmap">
            View Full Roadmap <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
