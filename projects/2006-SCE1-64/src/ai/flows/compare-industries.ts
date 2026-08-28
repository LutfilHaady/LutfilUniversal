import { supabase, supabase2 } from '@/backend/supabaseClient';
import { z } from 'zod';
/**
 * @fileOverview An industry comparison AI agent.
 *
 * - compareIndustries - A function that handles the industry comparison process.
 */

import { ai } from '@/ai/genkit';
import {
  CompareIndustriesInputSchema,
  type CompareIndustriesInput,
  CompareIndustriesOutputSchema,
  type CompareIndustriesOutput,
} from './schemas';

const numeric_cols = [
  '_id',
  'year', 
  'employment_rate_overall', 
  'employment_rate_ft_perm',
  'basic_monthly_mean', 
  'basic_monthly_median',
  'gross_monthly_mean', 
  'gross_monthly_median',
  'gross_mthly_25_percentile', 
  'gross_mthly_75_percentile',
  'industry'
];

//fetch data helper function
async function fetchIndustryData(industryName: string) {
  const { data, error } = await supabase2
    .from('ges_data')
    .select(numeric_cols.join(', '))
    .or(`industry.eq.${industryName},industry.ilike.%${industryName}%`)
    .order('year', { ascending: true });

  if (error) {
    throw new Error(`Supabase fetch error: ${error.message}`)
  }
  return data
}

//summarizes salary trends by year to reduce payload size
function simplifyIndustryData(data: any[]) {
  if (!data || data.length === 0) return 'No data available.';
  //Group by year and compute averages
  const byYear: Record<number, { mean: number[] }> = {};
  for (const row of data) {
    const y = row.year;
    if (!byYear[y]) byYear[y] = { mean: [] };
    const avg = (row.basic_monthly_mean || row.gross_monthly_mean || 0);
    if (avg) byYear[y].mean.push(avg);
  }
  const summaries = Object.entries(byYear)
    .map(([year, { mean }]) => {
      const avgSalary = Math.round(mean.reduce((a, b) => a + b, 0) / mean.length);
      return `${year}: ~${avgSalary}`;
    })
    .sort((a, b) => parseInt(a) - parseInt(b));

  return summaries.join(', ');
}

//fetch top relevant degree for industry
async function fetchIndustryDegrees(industryName: string): Promise<string[]> {
  const { data, error } = await supabase2
    .from('ges_data')
    .select('degree')
    .or(`industry.eq.${industryName},industry.ilike.%${industryName}%`);

  if (error) throw new Error(`Supabase fetch error: ${error.message}`);
  if (!data) return [];

  const degreeCount: Record<string, number> = {};
  for (const row of data) {
    const degree = row.degree?.trim();
    if (degree) degreeCount[degree] = (degreeCount[degree] || 0) + 1;
  }

  return Object.entries(degreeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([deg]) => deg);
}


const prompt = ai.definePrompt({
  name: 'compareIndustriesPrompt',
  input: { schema: CompareIndustriesInputSchema.extend({
      industry1SalaryTrend: z.string().optional(),
      industry1Degrees: z.string().optional(),
      industry1Courses: z.string().optional(),
      industry2SalaryTrend: z.string().optional(),
      industry2Degrees: z.string().optional(),
      industry2Courses: z.string().optional(),
      countryContext: z.string().optional(),
  })},
  output: { schema: CompareIndustriesOutputSchema },
  prompt: `You are an expert career analyst in Singapore. Compare the two following industries: {{{industry1}}} and {{{industry2}}}.

For each industry, provide the following information:
1.  **Salary Trend**: A summary of salary trends over the last 3-5 years.
2.  **Relevant Degrees**: A list of non-repeating 3-4 relevant university degrees, using the following relevant degrees for each industry to guide your answer.
   - Industry 1 degrees: {{{industry1Degrees}}}
   - Industry 2 degrees: {{{industry2Degrees}}}
3.  **Relevant Courses**: A list of 3-4 relevant professional courses or certifications.

Use the following data for your analysis:
Industry 1 Salary and Employment Data: {{{industry1SalaryTrend}}}
Industry 2 Salary and Employment Data: {{{industry2SalaryTrend}}}


Format your response as a valid JSON object per the output schema, using **bold** markdown to emphasize key insights (e.g., highest salary, fastest growth).`,
});

const compareIndustriesFlow = ai.defineFlow(
  {
    name: 'compareIndustriesFlow',
    inputSchema: CompareIndustriesInputSchema.extend({ countryContext: z.string().optional(),}),
    outputSchema: CompareIndustriesOutputSchema,
  },
  async input => {
    const [industry1DataRaw, industry2DataRaw, industry1Degrees, industry2Degrees] = await Promise.all([
      fetchIndustryData(input.industry1),
      fetchIndustryData(input.industry2),
      fetchIndustryDegrees(input.industry1),
      fetchIndustryDegrees(input.industry2),
    ])

    const industry1Data = simplifyIndustryData(industry1DataRaw);
    const industry2Data = simplifyIndustryData(industry2DataRaw);

    const inputWithContext = {
      ...input,
      industry1SalaryTrend: JSON.stringify(industry1Data),
      industry2SalaryTrend: JSON.stringify(industry2Data),
      industry1Degrees: industry1Degrees.join(', '),  //pass as comma-separated string
      industry2Degrees: industry2Degrees.join(', '),
      countryContext: 'Singapore',
    }

    const { output } = await prompt(inputWithContext)
    return output!
  }
)

export async function compareIndustries(
  input: CompareIndustriesInput
): Promise<CompareIndustriesOutput> {
  return compareIndustriesFlow(input)
}