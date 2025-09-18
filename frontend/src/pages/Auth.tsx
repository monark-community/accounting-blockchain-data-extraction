import { useMemo, useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, LogIn, UserPlus } from "lucide-react";

type Mode = "signin" | "register";

const passwordRules = {
  length: (v: string) => v.length >= 8,
  upper: (v: string) => /[A-Z]/.test(v),
  lower: (v: string) => /[a-z]/.test(v),
  digit: (v: string) => /\d/.test(v),
  symbol: (v: string) => /[^A-Za-z0-9]/.test(v),
};

function RuleRow({ ok, label }: { ok: boolean; label: string }) {
  const Icon = ok ? CheckCircle2 : XCircle;
  const color = ok ? "text-green-600" : "text-muted-foreground";
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className={`h-4 w-4 ${color}`} />
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
}

export default function Auth() {
  const [mode, setMode] = useState("register");

  // Register form state
  const [name, setName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regEmailTouched, setRegEmailTouched] = useState(false);

  // Sign-in form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  const checks = useMemo(
    () => ({
      length: passwordRules.length(regPassword),
      upper: passwordRules.upper(regPassword),
      lower: passwordRules.lower(regPassword),
      digit: passwordRules.digit(regPassword),
      symbol: passwordRules.symbol(regPassword),
      match: regPassword.length > 0 && regPassword === regConfirm,
    }),
    [regPassword, regConfirm]
  );

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const canRegister =
    name.trim().length > 0 &&
    emailRegex.test(regEmail) &&
    checks.length &&
    checks.upper &&
    checks.lower &&
    checks.digit &&
    checks.symbol &&
    checks.match;

  const canLogin = emailRegex.test(loginEmail) && loginPassword.length > 0;
  const emailInvalid =
    regEmailTouched && regEmail !== "" && !emailRegex.test(regEmail);

  async function onSubmitRegister(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          email: regEmail,
          password: regPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          (data?.error === "ValidationError" && "Please check your inputs.") ||
          data?.error ||
          "Registration failed";
        throw new Error(msg);
      }

      // success
      toast?.success?.("Account created! You can now sign in.");
      // Option A: auto-switch to Sign in tab
      setMode("signin");
      // Option B: auto-login later, once you want that behavior
    } catch (err: any) {
      toast?.error?.(err.message || "Registration failed");
    }
  }

  async function onSubmitLogin(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data?.error || "Invalid email or password";
        throw new Error(msg);
      }

      toast?.success?.("Signed in!");
      // TODO: set your AuthProvider state if you want to cache the user
      // Then navigate to your next page:
      // navigate("/dashboard")  (or "/welcome")
    } catch (err: any) {
      toast?.error?.(err.message || "Sign in failed");
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 text-foreground flex items-center justify-center px-4 py-24">
      <Card className="w-full max-w-xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">
                {mode === "register" ? "Create your account" : "Welcome back"}
              </CardTitle>
              <CardDescription>
                {mode === "register"
                  ? "Sign up to start tracking blockchain transactions."
                  : "Sign in to continue to your dashboard."}
              </CardDescription>
            </div>

            <div className="grid grid-cols-2 rounded-md border p-1 gap-1 bg-background">
              <Button
                type="button"
                variant={mode === "signin" ? "default" : "ghost"}
                size="sm"
                className="rounded"
                onClick={() => setMode("signin")}
              >
                <LogIn className="mr-2 h-4 w-4" />
                Sign in
              </Button>
              <Button
                type="button"
                variant={mode === "register" ? "default" : "ghost"}
                size="sm"
                className="rounded"
                onClick={() => setMode("register")}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Create
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-6">
          {mode === "register" ? (
            <form className="grid gap-4" onSubmit={onSubmitRegister}>
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Satoshi Nakamoto"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="reg-email">Email</Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="you@example.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  onBlur={() => setRegEmailTouched(true)} // NEW: mark as touched
                  autoComplete="email"
                  aria-invalid={emailInvalid || undefined} // NEW: a11y
                  aria-describedby={
                    emailInvalid ? "reg-email-error" : undefined
                  }
                  className={
                    emailInvalid
                      ? "border-red-500 focus-visible:ring-red-500"
                      : undefined
                  }
                />
                {emailInvalid && (
                  <p id="reg-email-error" className="text-sm text-red-600">
                    Please enter a valid email address.
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="reg-password">Password</Label>
                <div className="relative">
                  <Input
                    id="reg-password"
                    type={showRegPassword ? "text" : "password"} // CHANGED
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10" // NEW: space for the button
                  />
                  <button
                    type="button"
                    aria-label={
                      showRegPassword ? "Hide password" : "Show password"
                    }
                    className="absolute inset-y-0 right-2 my-auto text-muted-foreground hover:text-foreground"
                    onClick={() => setShowRegPassword((v) => !v)}
                  >
                    {showRegPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="reg-confirm">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="reg-confirm"
                    type={showRegConfirm ? "text" : "password"} // CHANGED
                    placeholder="••••••••"
                    value={regConfirm}
                    onChange={(e) => setRegConfirm(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10" // NEW
                  />
                  <button
                    type="button"
                    aria-label={
                      showRegConfirm ? "Hide password" : "Show password"
                    }
                    className="absolute inset-y-0 right-2 my-auto text-muted-foreground hover:text-foreground"
                    onClick={() => setShowRegConfirm((v) => !v)}
                  >
                    {showRegConfirm ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-md border p-3 bg-muted/30">
                <RuleRow ok={checks.length} label="At least 8 characters" />
                <RuleRow
                  ok={checks.upper}
                  label="At least one uppercase letter"
                />
                <RuleRow
                  ok={checks.lower}
                  label="At least one lowercase letter"
                />
                <RuleRow ok={checks.digit} label="At least one number" />
                <RuleRow ok={checks.symbol} label="At least one symbol" />
                <RuleRow ok={checks.match} label="Passwords match" />
              </div>

              <Button
                type="submit"
                disabled={!canRegister}
                className="w-full h-11"
              >
                Create account
              </Button>

              <p className="text-sm text-muted-foreground text-center">
                Already have an account?{" "}
                <button
                  type="button"
                  className="text-primary underline-offset-4 hover:underline"
                  onClick={() => setMode("signin")}
                >
                  Sign in
                </button>
              </p>
            </form>
          ) : (
            <form className="grid gap-4" onSubmit={onSubmitLogin}>
              <div className="grid gap-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showLoginPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    aria-label={
                      showLoginPassword ? "Hide password" : "Show password"
                    }
                    className="absolute inset-y-0 right-2 my-auto text-muted-foreground hover:text-foreground"
                    onClick={() => setShowLoginPassword((v) => !v)}
                  >
                    {showLoginPassword ? "🙈" : "👁️"}
                    {/* swap for lucide-react Eye/EyeOff if you prefer */}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  <button
                    type="button"
                    className="text-primary underline-offset-4 hover:underline"
                    // TODO: wire when you add reset flow
                    onClick={() => {}}
                  >
                    Forgot password?
                  </button>
                </span>

                <Button type="submit" disabled={!canLogin} className="h-11">
                  Sign in
                </Button>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                New here?{" "}
                <button
                  type="button"
                  className="text-primary underline-offset-4 hover:underline"
                  onClick={() => setMode("register")}
                >
                  Create an account
                </button>
              </p>
            </form>
          )}
        </CardContent>

        <CardFooter className="justify-center text-xs text-muted-foreground">
          By continuing, you agree to our Terms and Privacy Policy.
        </CardFooter>
      </Card>
    </div>
  );
}
