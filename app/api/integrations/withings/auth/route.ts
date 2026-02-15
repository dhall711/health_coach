import { NextRequest, NextResponse } from "next/server";
import { getWithingsAuthUrl } from "@/lib/withings";

export async function GET(req: NextRequest) {
  try {
    const url = getWithingsAuthUrl();
    return NextResponse.redirect(url, { status: 302 });
  } catch (err) {
    console.error("Withings auth error:", err);
    const origin = req.nextUrl.origin;
    return NextResponse.redirect(`${origin}/settings?error=withings_auth_failed`, { status: 302 });
  }
}
