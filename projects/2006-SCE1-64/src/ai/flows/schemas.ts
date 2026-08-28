import {z} from 'genkit';

export const PersonalizedCareerPlanInputSchema = z.object({
  userProfile: z
    .string()
    .describe(
      'The user profile, including current role, skills, experience, and career goals.'
    ),
  jobTitle: z.string().describe('The target job title.'),
  location: z.string().describe('The target location.'),
});
export type PersonalizedCareerPlanInput = z.infer<
  typeof PersonalizedCareerPlanInputSchema
>;

export const PersonalizedCareerPlanOutputSchema = z.object({
  courseRecommendations: z
    .array(
      z.object({
        title: z.string().describe('The title of the recommended course.'),
        reason: z
          .string()
          .describe(
            'A brief reason why this course is recommended for the user.'
          ),
      })
    )
    .describe(
      'A list of personalized course recommendations based on job market data and the user profile.'
    ),
  roadmapSteps: z
    .array(
      z.object({
        title: z.string().describe('A summary of the roadmap step.'),
        completed: z.boolean().describe('Whether the step is completed.'),
      })
    )
    .describe(
      'A list of personalized career roadmap steps to help the user achieve their goals.'
    ),
});
export type PersonalizedCareerPlanOutput = z.infer<
  typeof PersonalizedCareerPlanOutputSchema
>;

export const CompareIndustriesInputSchema = z.object({
  industry1: z.string().describe('The first industry to compare.'),
  industry2: z.string().describe('The second industry to compare.'),
});
export type CompareIndustriesInput = z.infer<
  typeof CompareIndustriesInputSchema
>;

const IndustryDetailsSchema = z.object({
  name: z.string().describe('The name of the industry.'),
  salaryTrend: z
    .string()
    .describe('A summary of salary trends over the last 3-5 years.'),
  relevantDegrees: z
    .array(z.string())
    .describe('A list of 3-4 relevant university degrees for this industry.'),
  relevantCourses: z
    .array(z.string())
    .describe(
      'A list of 3-4 relevant professional courses or certifications.'
    ),
});

export const CompareIndustriesOutputSchema = z.object({
  industry1: IndustryDetailsSchema,
  industry2: IndustryDetailsSchema,
});
export type CompareIndustriesOutput = z.infer<
  typeof CompareIndustriesOutputSchema
>;
