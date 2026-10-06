"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        "expired-callback": () => void;
        "error-callback": () => void;
      }) => string;
    };
  }
}

type AuthAction = () => void | Promise<void>;

type AuthModalContextValue = {
  requireAuth: (action?: AuthAction) => boolean;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [action, setAction] = useState<AuthAction>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const sessionStatusRef = useRef(status);
  const openAuthRef = useRef<(action?: AuthAction) => void>(() => undefined);

  const requireAuth = (nextAction?: AuthAction) => {
    if (status === "authenticated" && session) return true;
    setAction(() => nextAction);
    setError(null);
    setOpen(true);
    return false;
  };

  sessionStatusRef.current = status;
  openAuthRef.current = (nextAction) => {
    setAction(() => nextAction);
    setError(null);
    setOpen(true);
  };

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    const guardedFetch: typeof window.fetch = async (input, init) => {
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const isSameOriginApi = requestUrl.startsWith("/") && requestUrl.startsWith("/api/");
      const isAuthRequest = requestUrl.startsWith("/api/auth/");

      if (
        isSameOriginApi &&
        !isAuthRequest &&
        method !== "GET" &&
        sessionStatusRef.current === "unauthenticated"
      ) {
        return new Promise<Response>((resolve, reject) => {
          openAuthRef.current(async () => {
            try {
              resolve(await originalFetch(input, init));
            } catch (error) {
              reject(error);
            }
          });
        });
      }

      return originalFetch(input, init);
    };

    window.fetch = guardedFetch;
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !open) return;
    setOpen(false);
    const pendingAction = action;
    setAction(undefined);
    if (pendingAction) void pendingAction();
  }, [action, open, status]);

  useEffect(() => {
    if (!open || !isSignup || !turnstileSiteKey) return;
    const scriptId = "cloudflare-turnstile-script";
    const renderWidget = () => {
      const container = document.getElementById("auth-turnstile-widget");
      if (!container || !window.turnstile || container.childElementCount > 0) return;
      window.turnstile.render(container, {
        sitekey: turnstileSiteKey,
        callback: setCaptchaToken,
        "expired-callback": () => setCaptchaToken(null),
        "error-callback": () => setCaptchaToken(null),
      });
    };
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      renderWidget();
      return;
    }
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = renderWidget;
    document.head.appendChild(script);
  }, [isSignup, open, turnstileSiteKey]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || password.length < 8) {
        setError("Enter a valid email and a password of at least 8 characters.");
        return;
      }

      if (isSignup) {
        if (name.trim() && name.trim().length < 2) {
          setError("Name must be at least 2 characters.");
          return;
        }
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() || undefined, email: normalizedEmail, password, captchaToken }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          setError(payload?.error ?? "Signup failed. Please try again.");
          return;
        }
      }

      const result = await signIn("credentials", {
        email: normalizedEmail,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid email or password.");
      }
    } catch (submitError) {
      console.error("Authentication failed:", submitError);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthModalContext.Provider value={{ requireAuth }}>
      {children}
      <Dialog open={open} onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setAction(undefined);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isSignup ? "Create your MOVIRAE account" : "Welcome back"}</DialogTitle>
            <DialogDescription>
              {isSignup ? "Join the conversation around the films you love." : "Sign in to continue this action."}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            {isSignup && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" className="w-full rounded-lg border border-border bg-secondary py-3 pl-10 pr-4 text-sm outline-none focus:border-primary" />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" className="w-full rounded-lg border border-border bg-secondary py-3 pl-10 pr-4 text-sm outline-none focus:border-primary" />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input required minLength={8} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="w-full rounded-lg border border-border bg-secondary py-3 pl-10 pr-10 text-sm outline-none focus:border-primary" />
              <button type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
            {isSignup && turnstileSiteKey && <div id="auth-turnstile-widget" className="min-h-[65px]" />}
            <Button className="w-full" disabled={isLoading}>{isLoading ? "Please wait..." : isSignup ? "Create Account" : "Sign In"}</Button>
          </form>
          <Button variant="secondary" disabled={isLoading} onClick={() => void signIn("google", { callbackUrl: window.location.href })}>Continue with Google</Button>
          <p className="text-center text-sm text-muted-foreground">
            {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
            <button type="button" className="text-primary hover:underline" onClick={() => { setIsSignup((value) => !value); setError(null); }}>
              {isSignup ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </DialogContent>
      </Dialog>
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (!context) throw new Error("useAuthModal must be used within AuthModalProvider");
  return context;
}
