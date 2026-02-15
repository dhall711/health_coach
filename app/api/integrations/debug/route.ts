import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasWithingsClientId: !!process.env.WITHINGS_CLIENT_ID,
    withingsClientIdLength: process.env.WITHINGS_CLIENT_ID?.length ?? 0,
    withingsClientIdPrefix: process.env.WITHINGS_CLIENT_ID?.substring(0, 6) ?? "MISSING",
    hasWithingsSecret: !!process.env.WITHINGS_CLIENT_SECRET,
    hasAppUrl: !!process.env.NEXT_PUBLIC_APP_URL,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "MISSING",
    vercelUrl: process.env.VERCEL_URL ?? "MISSING",
  });
}
