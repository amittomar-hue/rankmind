import { NextRequest, NextResponse } from "next/server";
import { createUser, createSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function POST(req: NextRequest) {
  try {
    const { email, name, password } = await req.json();
    if (!email?.trim() || !name?.trim() || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    const user = await createUser(email.toLowerCase().trim(), name.trim(), password);
    const token = await createSession(user);
    logActivity(user.id, user.email, user.name, "signup").catch(() => {});
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
    return NextResponse.json({ error: e instanceof Error ? e.message : "Signup failed" }, { status: 400 });
  }
}
