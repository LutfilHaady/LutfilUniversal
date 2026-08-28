import { ai } from '@/ai/genkit';
import { supabase3 } from '@/backend/supabaseClient';
import { z } from 'genkit';

const SkillsInDemandInputSchema = z.object({
  courseTitle: z.string(),
  courseDescription: z.string(),
});

const SkillsInDemandOutputSchema = z.object({
  skills: z.array(z.string()),
});

export type SkillsInDemandInput = z.infer<typeof SkillsInDemandInputSchema>;
export type SkillsInDemandOutput = z.infer<typeof SkillsInDemandOutputSchema>;

const prompt = ai.definePrompt({
  name: 'skillsInDemandPrompt',
  input: { schema: SkillsInDemandInputSchema },
  output: { schema: SkillsInDemandOutputSchema },
  prompt: `
You are an AI that extracts career-relevant hard skills or professional skills taught in a course.
Focus on skills that are specific, significant, and directly usable in a job, industry, or professional context.
Do NOT include trivial or vague tasks (e.g., "using equipment", "taking notes") or soft skills like teamwork, communication, or leadership.
If multiple skill variants exist, return the most general and widely-recognized version of the skill.
Return a JSON array of skill names only — no descriptions, no extra text.

Course Title: {{{courseTitle}}}
Course Description: {{{courseDescription}}}

`,
});

export const skillsInDemandFlow = ai.defineFlow(
  {
    name: 'skillsInDemandFlow',
    inputSchema: SkillsInDemandInputSchema,
    outputSchema: SkillsInDemandOutputSchema,
  },
  async (input: SkillsInDemandInput) => {
    const { output } = await prompt(input);
    return output!;
  }
);

export async function extractSkillsFromAllCourses() {
  const { data: courses, error: coursesError } = await supabase3
    .from('Course')
    .select('id, coursetitle, what_you_learn')
    .not('what_you_learn', 'is', null);

  if (coursesError) throw new Error(coursesError.message);
  if (!courses || courses.length === 0) return [];

  const allSkills: { courseId: number; skills: string[] }[] = [];

  for (const course of courses) {
    const { id: courseId, coursetitle, what_you_learn } = course;
    if (!what_you_learn) continue;

    const skillsOutput = await skillsInDemandFlow({
      courseTitle: coursetitle,
      courseDescription: what_you_learn,
    });

    const skills = skillsOutput.skills.map((s) => s.trim().toLowerCase());
    const linkedSkillIds: number[] = [];

    for (const skill of skills) {
      const { data: existingSkill, error: checkError } = await supabase3
        .from('Skills')
        .select('skillsID, popularityScore')
        .eq('skillsName', skill)
        .maybeSingle();

      if (checkError) throw checkError;

      let skillId: number;

      if (!existingSkill) {
        const { data: newSkill, error: insertError } = await supabase3
          .from('Skills')
          .insert({ skillsName: skill, popularityScore: 1 })
          .select('skillsID')
          .single();

        if (insertError) throw insertError;
        skillId = newSkill.skillsID;
      } else {
        skillId = existingSkill.skillsID;
        await supabase3
          .from('Skills')
          .update({
            popularityScore: existingSkill.popularityScore + 1,
          })
          .eq('skillsID', skillId);
      }

      linkedSkillIds.push(skillId);

      const { data: existingLink, error: linkCheckError } = await supabase3
        .from('CourseSkill')
        .select('id')
        .eq('course_id', courseId)
        .eq('skill_id', skillId)
        .maybeSingle();

      if (linkCheckError) throw linkCheckError;

      if (!existingLink) {
        const { error: insertLinkError } = await supabase3
          .from('CourseSkill')
          .insert({ course_id: courseId, skill_id: skillId });
        if (insertLinkError) throw insertLinkError;
      }
    }

    allSkills.push({ courseId, skills });
    console.log(`Processed course: ${coursetitle} → ${skills.join(', ')}`);
  }

  console.log('Extraction completed.');
  return allSkills;
}
