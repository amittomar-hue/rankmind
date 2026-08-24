import { NextRequest, NextResponse } from "next/server";
import { resetPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, token, password } = await req.json();
    if (!email?.trim() || !token?.trim() || !password)
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    await resetPassword(email.toLowerCase().trim(), token.trim(), password);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Reset failed" }, { status: 400 });
  }
}
