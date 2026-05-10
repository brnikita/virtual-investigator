import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env';
import { createSupabaseServer } from '@/lib/supabase/server';

// GET /api/simli/session — returns the public Simli config the browser needs
// to start the avatar. The API key is intentionally returned to the client:
// Simli expects the key in the browser SDK. If you need stricter isolation,
// proxy the WebRTC SDP exchange through the server instead.
export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const env = serverEnv();
  return NextResponse.json({
    apiKey: env.SIMLI_API_KEY,
    faceId: env.SIMLI_FACE_ID,
  });
}
