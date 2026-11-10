import { z } from 'zod';
import { text, ownerEmail } from '../shared/validation';
export {businessLines as productLines} from '../areas/policy';
import {businessLines as productLines} from '../areas/policy';
// The image travels separately (multipart to /api/products/[id]/image); this schema covers the catalog data.
export const createSchema = z.object({
  name: text, insurer: text, line: z.enum(productLines).default('MEDICAL'),
  description: z.string().trim().min(1).max(600).optional(), highlights: z.string().trim().min(1).max(5000).optional(),
  ownerEmail,
}).strict();
