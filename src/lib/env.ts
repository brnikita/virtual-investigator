import { z } from 'zod';

// Validated environment. Importing this from a server-only module crashes the
// build fast if a required key is missing — far better than a 3am 500 in prod.
const ServerEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  OPENAI_REALTIME_MODEL: z.string().default('gpt-realtime-mini'),
  OPENAI_IMAGE_MODEL: z.string().default('gpt-image-2'),
  OPENAI_IMAGE_QUALITY: z.enum(['low', 'medium', 'high']).default('medium'),
  SIMLI_API_KEY: z.string().min(10),
  SIMLI_FACE_ID: z.string().min(1),
  MAX_INTERVIEW_SECONDS: z.coerce.number().int().positive().default(300),
  MAX_IMAGES_PER_CASE: z.coerce.number().int().positive().default(3),
});

const PublicEnvSchema = ServerEnvSchema.pick({
  NEXT_PUBLIC_SITE_URL: true,
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;
export type PublicEnv = z.infer<typeof PublicEnvSchema>;

let _serverEnv: ServerEnv | undefined;
export function serverEnv(): ServerEnv {
  if (_serverEnv) return _serverEnv;
  _serverEnv = ServerEnvSchema.parse(process.env);
  return _serverEnv;
}

export function publicEnv(): PublicEnv {
  return PublicEnvSchema.parse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
