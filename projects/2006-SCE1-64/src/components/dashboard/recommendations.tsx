'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { getCourseRecommendations } from '@/app/dashboard/actions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lightbulb, Loader2 } from 'lucide-react';
import type { PersonalizedCareerPlanOutput } from '@/ai/flows/generate-personalized-career-plan';
import { useActionState } from 'react';

const initialState: { recommendations: PersonalizedCareerPlanOutput | null; error: string | null } = {
  recommendations: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" /> Generating...
        </>
      ) : (
        <>
          <Lightbulb /> Generate Recommendations
        </>
      )}
    </Button>
  );
}

export function Recommendations() {
  const [state, formAction] = useActionState(getCourseRecommendations, initialState);

  // Mock data for the GenAI flow
  const mockUserProfile =
    'Mid-level Software Engineer with 5 years of experience in Python and Django. Goal is to become a Senior Software Engineer or Tech Lead in the next 2-3 years.';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Personalized Recommendations</CardTitle>
        <CardDescription>
          Use AI to get course recommendations based on your profile and current job market trends.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state.recommendations?.courseRecommendations && (
          <div className="prose prose-sm max-w-none text-foreground dark:prose-invert">
            <ul className='space-y-2'>
              {state.recommendations.courseRecommendations.map((rec, index) => (
                <li key={index}>
                  <strong>{rec.title}:</strong> {rec.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      </CardContent>
      <CardFooter>
        <form action={formAction}>
          <input type="hidden" name="jobTitle" value="Senior Software Engineer" />
          <input type="hidden" name="location" value="Singapore" />
          <input type="hidden" name="userProfile" value={mockUserProfile} />
          <SubmitButton />
        </form>
      </CardFooter>
    </Card>
  );
}
