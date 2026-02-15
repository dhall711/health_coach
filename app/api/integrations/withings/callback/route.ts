import { NextRequest, NextResponse } from "next/server";
import { exchangeWithingsCode } from "@/lib/withings";

export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}` || "http://localhost:3000";
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${base}/settings?error=withings_denied`);
  }

  if (!code) {
    // Withings validates the callback URL by sending a GET without params.
    // Return 200 so their verification succeeds.
    return new NextResponse("OK", { status: 200 });
  }

  try {
    await exchangeWithingsCode(code);
    return NextResponse.redirect(`${base}/settings?success=withings_connected`);
  } catch (err) {
    console.error("Withings callback error:", err);
    return NextResponse.redirect(`${base}/settings?error=withings_token_failed`);
  }
}
