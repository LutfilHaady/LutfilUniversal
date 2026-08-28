'use server';

/**
 * @fileOverview A personalized course recommendation AI agent.
 *
 * - generateCourseRecommendations - A function that generates personalized course recommendations.
 * - CourseRecommendationInput - The input type for the generateCourseRecommendations function.
 * - CourseRecommendationOutput - The return type for the generateCourseRecommendations function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CourseRecommendationInputSchema = z.object({
  jobMarketData: z
    .string()
    .describe('The current job market data, including in-demand skills and job availability.'),
  userProfile: z
    .string()
    .describe('The user profile, including current skills, job history, and career goals.'),
});
export type CourseRecommendationInput = z.infer<typeof CourseRecommendationInputSchema>;

const CourseRecommendationOutputSchema = z.object({
  courseRecommendations: z.array(
    z.object({
        title: z.string().describe("The title of the recommended course."),
        reason: z.string().describe("A brief reason why this course is recommended for the user."),
    })
  ).describe('A list of personalized course recommendations based on job market data and the user profile.'),
});
export type CourseRecommendationOutput = z.infer<typeof CourseRecommendationOutputSchema>;

export async function generateCourseRecommendations(
  input: CourseRecommendationInput
): Promise<CourseRecommendationOutput> {
  return personalizedCourseRecommendationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'personalizedCourseRecommendationsPrompt',
  input: {schema: CourseRecommendationInputSchema},
  output: {schema: CourseRecommendationOutputSchema},
  prompt: `You are a career advisor who specializes in providing personalized course recommendations based on job market data and user profiles.

  Job Market Data: {{{jobMarketData}}}
  User Profile: {{{userProfile}}}

  Based on the job market data and user profile, provide a list of personalized course recommendations that will help the user upskill and achieve their career goals.
  Each recommendation should have a course title and a reason for the recommendation.
  `,
});

const personalizedCourseRecommendationsFlow = ai.defineFlow(
  {
    name: 'personalizedCourseRecommendationsFlow',
    inputSchema: CourseRecommendationInputSchema,
    outputSchema: CourseRecommendationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
