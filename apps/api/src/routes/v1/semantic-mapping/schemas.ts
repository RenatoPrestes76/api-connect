import { z } from 'zod';

export const AnalyzeBodySchema = z.object({
  profileId: z.string().min(1),
});
