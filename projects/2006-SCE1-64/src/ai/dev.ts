'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/personalized-course-recommendations.ts';
import '@/ai/flows/compare-industries.ts';
import '@/ai/flows/generate-personalized-career-plan.ts';
