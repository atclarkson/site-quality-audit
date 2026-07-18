import { z } from 'zod';

export const portSchema = z.coerce.number().int().min(1).max(65535);
