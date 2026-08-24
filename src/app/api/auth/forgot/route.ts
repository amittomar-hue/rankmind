import { NextRequest, NextResponse } from "next/server";
import { generateResetToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email?.trim()) return NextResponse.json({ error: "Email is required" }, { status: 400 });
    const token = await generateResetToken(email.toLowerCase().trim());
    return NextResponse.json({ token });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
