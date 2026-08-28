'use server';

import { compareIndustries } from '@/ai/flows/compare-industries';
import {
  type CompareIndustriesOutput,
  CompareIndustriesInputSchema,
} from '@/ai/flows/schemas';


interface FormState {
  data: CompareIndustriesOutput | null;
  error: string | null;
  downloadableData: string;
}

export async function getIndustryComparison(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validatedFields = CompareIndustriesInputSchema.safeParse({
    industry1: formData.get('industry1'),
    industry2: formData.get('industry2'),
  });

  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors;
    return {
      ...prevState,
      data: null,
      error:
        errors.industry1?.[0] ||
        errors.industry2?.[0] ||
        'Invalid input.',
      downloadableData: ''
    };
  }

  const { industry1, industry2 } = validatedFields.data;

  if (industry1 === industry2) {
    return {
      ...prevState,
      data: null,
      error: 'Please select two different industries for comparison.',
    };
  }

  try {
    //call buisness logic function to get comparison result
    const result = await compareIndustries(validatedFields.data);

    // Prepare data for download
    const downloadableData = `
Industry Comparison: ${result.industry1.name} vs ${result.industry2.name}

=================================
Industry: ${result.industry1.name}
=================================

Salary Trend:
${result.industry1.salaryTrend}

Relevant Degrees:
- ${result.industry1.relevantDegrees.join('\n- ')}

Relevant Courses:
- ${result.industry1.relevantCourses.join('\n- ')}

=================================
Industry: ${result.industry2.name}
=================================

Salary Trend:
${result.industry2.salaryTrend}

Relevant Degrees:
- ${result.industry2.relevantDegrees.join('\n- ')}

Relevant Courses:
- ${result.industry2.relevantCourses.join('\n- ')}
`;

    return {
      data: result,
      error: null,
      downloadableData,
    };
  } catch (error) {
    console.error(error);
    return {
      ...prevState,
      data: null,
      error: 'Failed to generate industry comparison. Please try again later.',
      downloadableData: '',
    };
  }
}
