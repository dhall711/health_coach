import { NextResponse } from "next/server";
import { deleteOAuthTokens } from "@/lib/integrations";

export async function POST() {
  try {
    await deleteOAuthTokens("withings");
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Withings disconnect error:", err);
    return NextResponse.json(
      { error: "Failed to disconnect Withings" },
      { status: 500 }
    );
  }
}
