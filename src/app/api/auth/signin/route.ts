import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, createSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email?.trim() || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    const user = await authenticateUser(email.toLowerCase().trim(), password);
    const token = await createSession(user);
    logActivity(user.id, user.email, user.name, "signin").catch(() => {});
    const res = NextResponse.json({ user });
    res.cookies.set("rm_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
      sameSite: "lax",
    });
    return res;
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sign in failed" }, { status: 401 });
  }
}
