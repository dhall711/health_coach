import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google";

export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}` || "http://localhost:3000";
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${base}/settings?error=google_denied`);
  }

  if (!code) {
    return NextResponse.redirect(`${base}/settings?error=google_no_code`);
  }

  try {
    await exchangeCodeForTokens(code);
    return NextResponse.redirect(`${base}/settings?success=google_connected`);
  } catch (err) {
    console.error("Google callback error:", err);
    return NextResponse.redirect(`${base}/settings?error=google_token_failed`);
  }
}
