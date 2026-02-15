import { NextResponse } from "next/server";
import { getAllIntegrationStatuses } from "@/lib/integrations";

export async function GET() {
  try {
    const statuses = await getAllIntegrationStatuses();
    return NextResponse.json(statuses);
  } catch (err) {
    console.error("Error fetching integration statuses:", err);
    return NextResponse.json(
      { error: "Failed to fetch integration statuses" },
      { status: 500 }
    );
  }
}
