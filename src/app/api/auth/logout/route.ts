import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });
  return response;
}
