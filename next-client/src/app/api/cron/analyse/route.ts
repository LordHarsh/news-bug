import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { analyseLoop } from '@/lib/pipeline/analyser';
import { createGeminiAnalyser } from '@/lib/pipeline/gemini';
import { createMapboxGeocoder } from '@/lib/pipeline/geocode';
import { isPipelineRequestAuthorized, invocationDeadline } from '@/lib/pipeline/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Analysis tick (replaces the Appwrite analyse-article function): batches of
 * crawled articles go to Gemini for disease extraction, locations are
 * geocoded via Mapbox, and results land back on the article documents.
 */
async function handle(req: Request): Promise<NextResponse> {
  if (!isPipelineRequestAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const mapboxToken = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!geminiKey) {
    return NextResponse.json(
      { success: false, error: 'GEMINI_API_KEY is not set' },
      { status: 500 }
    );
  }
  if (!mapboxToken) {
    return NextResponse.json(
      { success: false, error: 'MAPBOX_TOKEN (or NEXT_PUBLIC_MAPBOX_TOKEN) is not set' },
      { status: 500 }
    );
  }

  const deadline = invocationDeadline();
  try {
    const db = await getDb();
    const summary = await analyseLoop(
      db,
      deadline,
      createGeminiAnalyser(geminiKey),
      createMapboxGeocoder(mapboxToken)
    );
    return NextResponse.json({ success: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline] analyse failed: ${message}`);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
