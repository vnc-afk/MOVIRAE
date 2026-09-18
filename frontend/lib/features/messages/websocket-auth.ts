import type { IncomingMessage } from "node:http";
import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";

function toNextRequest(request: Request | IncomingMessage) {
  if (request instanceof Request) return new NextRequest(request);

  const forwardedProtocol = request.headers["x-forwarded-proto"]?.toString().split(",")[0]?.trim();
  const secure = forwardedProtocol === "https" || ("encrypted" in request.socket && Boolean(request.socket.encrypted));
  const host = request.headers.host ?? "localhost";
  const headers = new Headers();

  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value) {
      headers.set(name, value);
    }
  }

  return new NextRequest(`${secure ? "https" : "http"}://${host}${request.url ?? "/"}`, { headers });
}

export async function getMessageWebSocketUserId(request: Request | IncomingMessage) {
  const authRequest = toNextRequest(request);
  const token = await getToken({
    req: authRequest,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: authRequest.nextUrl.protocol === "https:",
  });

  return typeof token?.id === "string" ? token.id : null;
}