import { z } from 'zod';

const list = z.array(z.string()).max(6);

export const EvaluationSchema = z.object({ score: z.number().int().min(0).max(100), matches: list, gaps: list, notes: list });

export const ParsedJobSchema = z.object({
  isJobPosting: z.boolean(),
  title: z.string(),
  companyName: z.string(),
  location: z.string().nullable(),
  remote: z.boolean(),
  salaryText: z.string().nullable(),
  skills: z.array(z.string()),
  description: z.string(),
  postedAt: z.string().nullable(),
  vagueDescription: z.boolean(),
  evergreen: z.boolean(),
});

export const ResumeProfileSchema = z.object({
  readable: z.boolean(),
  skills: z.array(z.string()),
  experience: z.array(z.object({ title: z.string(), company: z.string(), start: z.string(), end: z.string().nullable(), summary: z.string() })),
  education: z.array(z.object({ school: z.string(), degree: z.string() })),
  yearsTotal: z.number(),
});
