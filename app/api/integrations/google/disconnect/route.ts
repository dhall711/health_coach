import { NextResponse } from "next/server";
import { deleteOAuthTokens } from "@/lib/integrations";

export async function POST() {
  try {
    await deleteOAuthTokens("google");
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Google disconnect error:", err);
    return NextResponse.json(
      { error: "Failed to disconnect Google Calendar" },
      { status: 500 }
    );
  }
}
