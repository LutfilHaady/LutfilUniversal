import { extractSkillsFromAllCourses } from '@/ai/flows/skills-in-demand';

export async function GET() {
  try {
    const results = await extractSkillsFromAllCourses();
    return new Response(JSON.stringify({ success: true, data: results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in /api/extract-skills:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
