"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Film, Eye, EyeOff, Mail, Lock, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  return (
    <div className="min-h-screen flex items-center justify-center p-4 cinema-gradient">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-card rounded-2xl p-8 card-shadow"
      >
        <div className="flex items-center justify-center gap-2 mb-8">
          <Film className="h-7 w-7 text-primary" />
          <span className="font-display text-xl font-bold text-foreground">CineLog</span>
        </div>

        <h1 className="font-display text-2xl font-bold text-foreground text-center">
          {isSignup ? "Create Account" : "Welcome Back"}
        </h1>
        <p className="text-sm text-muted-foreground text-center mt-1 mb-6">
          {isSignup ? "Start tracking your film journey" : "Sign in to continue"}
        </p>

        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          {isSignup && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full rounded-lg bg-secondary pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full rounded-lg bg-secondary pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-lg bg-secondary pl-10 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <Button className="w-full gap-2 py-3">
            {isSignup ? "Create Account" : "Sign In"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-3 text-muted-foreground">or continue with</span>
          </div>
        </div>

        <div className="flex gap-3">
          {['Google', 'Apple', 'X'].map((provider) => (
            <button
              key={provider}
              className="flex-1 rounded-lg border border-border bg-secondary py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              {provider}
            </button>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => setIsSignup(!isSignup)}
            className="text-primary font-medium hover:underline"
          >
            {isSignup ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
