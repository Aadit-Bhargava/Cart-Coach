import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { api } from "@/api";
import { Button, LinkButton, field } from "@/components/ui";
import { whatToDo } from "@/lib/errors";
import { useAuth } from "@/state/auth";

type Mode = "login" | "signup";

/** The sign-in popup body: log in, or create an account. Same card, one switch. */
export function SignInContent() {
  const auth = useAuth();
  const ids = { name: useId(), email: useId(), password: useId() };
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [problem, setProblem] = useState("");

  const submit = useMutation({
    mutationFn: () => (mode === "signup" ? api.signUp(name.trim(), email.trim(), password) : api.logIn(email.trim(), password)),
    onSuccess: auth.signedIn,
    onError: (e) => setProblem(whatToDo(e)),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && !name.trim()) return setProblem("Enter your name.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setProblem("Enter a valid email address.");
    if (!password) return setProblem(mode === "signup" ? "Choose a password." : "Enter your password.");
    if (mode === "signup" && password.length < 8) return setProblem("Choose a password of at least 8 characters.");
    setProblem("");
    submit.mutate();
  };

  const switchMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setProblem("");
    setPassword("");
  };

  const signup = mode === "signup";
  const heading = auth.expired ? "Log in again to keep going" : signup ? "Create your account" : "Log in to start your cart";
  const intro = auth.expired
    ? "Your session ended. Your cart is still here."
    : signup
      ? "Coach saves your goal to your account, so suggestions are ready next time you shop."
      : "Welcome back. Your goal and cart suggestions are saved to your account.";

  // The page could not load the account data after logging in.
  const accountError = auth.status === "error";

  return (
    <form onSubmit={onSubmit} noValidate className="p-8">
      <div className="font-display text-2xl font-extrabold tracking-tight">
        Nukkad
        <small className="-mt-0.5 block font-sans text-xs font-medium tracking-normal text-muted">with Cart Coach</small>
      </div>
      <h2 className="mt-6 font-display text-[1.7rem] font-extrabold leading-[1.1] tracking-tight">{heading}</h2>
      <p className="mt-1.5 max-w-[42ch] text-muted">{intro}</p>

      {accountError ? (
        <div role="alert" className="mt-6 rounded-2xl bg-[#fdeaea] p-3.5 text-[#8a1f1f]">
          <b className="block">We couldn't load your account</b>
          {whatToDo(auth.error)}
          <div>
            <LinkButton className="!text-[#8a1f1f]" onClick={auth.retry}>
              Try again
            </LinkButton>
          </div>
        </div>
      ) : (
        <>
          {signup && (
            <label htmlFor={ids.name} className="mt-5 block font-semibold">
              Name
              <input id={ids.name} className={field} value={name} autoComplete="name" maxLength={80} onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          <label htmlFor={ids.email} className="mt-4 block font-semibold">
            Email
            <input id={ids.email} className={field} type="email" inputMode="email" value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
          </label>
          <div className="mt-4">
            <label htmlFor={ids.password} className="block font-semibold">
              Password
            </label>
            <div className="relative">
              <input
                id={ids.password}
                className={`${field} pr-20`}
                type={show ? "text" : "password"}
                value={password}
                autoComplete={signup ? "new-password" : "current-password"}
                maxLength={72}
                aria-describedby={signup ? `${ids.password}-hint` : undefined}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-pressed={show}
                className="absolute right-1.5 top-3 min-h-9 rounded-lg px-3 text-sm font-semibold text-coach"
              >
                {show ? "Hide" : "Show"}
              </button>
            </div>
            {signup && (
              <p id={`${ids.password}-hint`} className="mt-1.5 text-sm text-muted">
                At least 8 characters.
              </p>
            )}
          </div>

          {problem && (
            <p role="alert" className="mt-3 font-semibold text-[#8a1f1f]">
              {problem}
            </p>
          )}

          <Button type="submit" variant="solid" disabled={submit.isPending} className="mt-5 h-[52px] w-full rounded-2xl">
            {submit.isPending ? (signup ? "Creating your account..." : "Logging in...") : signup ? "Create account" : "Log in"}
          </Button>
          <p className="mt-3 text-center text-muted">
            {signup ? "Already have an account?" : "New here?"}{" "}
            <LinkButton onClick={switchMode} className="align-baseline">
              {signup ? "Log in" : "Create an account"}
            </LinkButton>
          </p>
        </>
      )}
    </form>
  );
}
