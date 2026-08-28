'use server';

import {
  generatePersonalizedCareerPlan,
  type PersonalizedCareerPlanOutput,
} from '@/ai/flows/generate-personalized-career-plan';
import {z} from 'zod';

const recommendationsSchema = z.object({
  jobTitle: z.string(),
  location: z.string(),
  userProfile: z.string(),
});

export async function getCourseRecommendations(
  prevState: {
    recommendations: PersonalizedCareerPlanOutput | null;
    error: string | null;
  },
  formData: FormData
) {
  const validatedFields = recommendationsSchema.safeParse({
    jobTitle: formData.get('jobTitle'),
    location: formData.get('location'),
    userProfile: formData.get('userProfile'),
  });

  if (!validatedFields.success) {
    return {
      recommendations: null,
      error: 'Invalid input data.',
    };
  }

  try {
    const result = await generatePersonalizedCareerPlan(validatedFields.data);
    return {
      recommendations: result,
      error: null,
    };
  } catch (error) {
    console.error(error);
    return {
      recommendations: null,
      error: 'Failed to generate recommendations. Please try again.',
    };
  }
}
