import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "../index.css";
import { Providers } from "./providers";
import { authOptions } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Movirae",
  description: "Movirae",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname") ?? "/";
  const search = requestHeaders.get("x-search") ?? "";
  const isLoginRoute = pathname.startsWith("/login");

  const session = await getServerSession(authOptions);

  if (!isLoginRoute && !session) {
    const callbackUrl = `${pathname}${search}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  if (isLoginRoute && session) {
    const callbackUrl = new URLSearchParams(search).get("callbackUrl") || "/";
    redirect(callbackUrl);
  }

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
