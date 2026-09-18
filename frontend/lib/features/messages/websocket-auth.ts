import type { IncomingMessage } from "node:http";
import { getToken } from "next-auth/jwt";

function toTokenRequest(request: Request | IncomingMessage) {
  if (request instanceof Request) return request;

  return {
    headers: request.headers,
    cookies: parseCookies(request.headers.cookie),
  };
}

export async function getMessageWebSocketUserId(request: Request | IncomingMessage) {
  const authRequest = toTokenRequest(request);
  const token = await getToken({
    req: authRequest as Parameters<typeof getToken>[0]["req"],
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NEXTAUTH_URL?.startsWith("https://") || Boolean(process.env.VERCEL),
  });

  return typeof token?.id === "string" ? token.id : null;
}

function parseCookies(cookieHeader: string | undefined) {
  return Object.fromEntries(
    (cookieHeader ?? "")
      .split(";")
      .map((cookie) => cookie.trim().split("="))
      .filter(([name, value]) => name && value !== undefined)
      .map(([name, ...value]) => [name, decodeURIComponent(value.join("="))])
  );
}