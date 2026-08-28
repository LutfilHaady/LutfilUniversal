'use server';
/**
 * @fileOverview A personalized career plan AI agent.
 *
 * - generatePersonalizedCareerPlan - A function that generates a personalized career plan.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  PersonalizedCareerPlanInputSchema,
  type PersonalizedCareerPlanInput,
  PersonalizedCareerPlanOutputSchema,
  type PersonalizedCareerPlanOutput,
} from './schemas';

// Re-export the output type (optional convenience)
//export type { PersonalizedCareerPlanOutput } from './schemas';

export async function generatePersonalizedCareerPlan(
  input: PersonalizedCareerPlanInput
): Promise<PersonalizedCareerPlanOutput> {
  return personalizedCareerPlanFlow(input);
}

const prompt = ai.definePrompt({
  name: 'personalizedCareerPlanPrompt',
  input: {
    schema: z.object({
      jobMarketAnalysis: z.string(),
      userProfile: z.string(),
    }),
  },
  output: { schema: PersonalizedCareerPlanOutputSchema },
  prompt: `You are a career advisor who specializes in providing personalized course recommendations and career roadmaps based on job market data and user profiles.

  Job Market Analysis: {{{jobMarketAnalysis}}}
  User Profile: {{{userProfile}}}

  Based on the job market data and user profile, provide a list of personalized course recommendations that will help the user upskill and achieve their career goals.
  Each recommendation should have a course title and a reason for the recommendation.
  
  Also provide a list of 4-5 career roadmap steps to guide the user. The first two steps should be marked as completed, and the rest as not completed.`,
});

const personalizedCareerPlanFlow = ai.defineFlow(
  {
    name: 'personalizedCareerPlanFlow',
    inputSchema: PersonalizedCareerPlanInputSchema,
    outputSchema: PersonalizedCareerPlanOutputSchema,
  },
  async (input) => {
    // Placeholder job market analysis (replace with your own data source later)
    const jobMarketAnalysis = `Job market for ${input.jobTitle} in ${input.location} is strong, with high demand for skills in cloud computing and data analysis.`;

    const { output } = await prompt({
      jobMarketAnalysis,
      userProfile: input.userProfile,
    });

    return output!;
  }
);
