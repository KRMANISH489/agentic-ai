import { NextRequest, NextResponse } from "next/server";

const API_ORIGIN = process.env.API_ORIGIN || "http://127.0.0.1:7860";

async function proxyAuth(req: NextRequest, path: string[]) {
  const dest = `${API_ORIGIN}/auth/${path.join("/")}${req.nextUrl.search}`;
  const incoming = new Headers();
  const cookie = req.headers.get("cookie");
  if (cookie) incoming.set("cookie", cookie);

  const res = await fetch(dest, {
    method: req.method,
    headers: incoming,
    redirect: "manual",
  });

  const headers = new Headers();
  res.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "set-cookie" || lower === "transfer-encoding") return;
    headers.set(key, value);
  });
  const cookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const item of cookies) headers.append("set-cookie", item);

  const body =
    res.status === 204 || res.status === 304 || res.status === 302 || res.status === 301
      ? null
      : await res.arrayBuffer();
  return new NextResponse(body, { status: res.status, headers });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  return proxyAuth(req, path);
}
