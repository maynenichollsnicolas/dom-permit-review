import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let railwayUrl = process.env.RAILWAY_API_URL || "http://localhost:8000";
  if (!railwayUrl.startsWith("http")) railwayUrl = `https://${railwayUrl}`;
  railwayUrl = railwayUrl.replace(/\/$/, "");

  const upstream = await fetch(
    `${railwayUrl}/api/v1/expedients/${id}/rounds/comparison`,
    { headers: { "Content-Type": "application/json" } }
  );
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
