import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google";

export async function GET(req: NextRequest) {
  try {
    const url = getAuthUrl();
    return NextResponse.redirect(url, { status: 302 });
  } catch (err) {
    console.error("Google auth error:", err);
    const origin = req.nextUrl.origin;
    return NextResponse.redirect(`${origin}/settings?error=google_auth_failed`, { status: 302 });
  }
}
