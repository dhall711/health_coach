import { NextResponse } from "next/server";
import { getWithingsAuthUrl } from "@/lib/withings";

export async function GET() {
  try {
    const url = getWithingsAuthUrl();
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("Withings auth error:", err);
    const base = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}` || "http://localhost:3000";
    return NextResponse.redirect(`${base}/settings?error=withings_auth_failed`);
  }
}
