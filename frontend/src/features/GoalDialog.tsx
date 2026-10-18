import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/api";
import { SupportMessage } from "@/api/http";
import type { Diet, SavedProfile } from "@/api/types";
import { Button, LinkButton, Loading, field } from "@/components/ui";
import { whatToDo } from "@/lib/errors";
import { DIET_LABEL, describeProfile, splitList } from "@/lib/profile";
import { useDispatch, useStore } from "@/state/store";

type Step = "describe" | "understanding" | "confirm";

interface Props {
  /** First run at sign-up: shows Skip and cannot be dismissed any other way. */
  first: boolean;
  onDone: (saved: boolean) => void;
}

export function GoalContent({ first, onDone }: Props) {
  const { profile, goalText } = useStore();
  const dispatch = useDispatch();
  const [step, setStep] = useState<Step>("describe");
  const [text, setText] = useState(goalText);
  const [budget, setBudget] = useState(profile?.budget ?? 600);
  const [adult, setAdult] = useState(Boolean(profile));
  const [auto, setAuto] = useState(profile?.auto_add ?? true);
  const [error, setError] = useState("");

  const [protein, setProtein] = useState(profile?.protein_target_g ?? 110);
  const [diet, setDiet] = useState<Diet>(profile?.diet ?? "unknown");
  const [allergies, setAllergies] = useState(profile?.allergies.join(", ") ?? "");
  const [likes, setLikes] = useState(profile?.likes.join(", ") ?? "");

  const understand = useMutation({
    mutationFn: (t: string) => api.understandGoal(t),
    onSuccess: (u) => {
      setProtein(u.protein_target_g);
      setDiet(u.diet);
      setAllergies(u.allergies.join(", "));
      setLikes(u.likes.join(", "));
      setStep("confirm");
    },
    onError: () => setStep("describe"),
  });

  const next = () => {
    if (!adult) return setError("Confirm you are 18 or older to continue.");
    if (text.trim().length < 8) return setError("Write a few words about your goal so Coach can understand it.");
    if (!(budget >= 50)) return setError("Enter a budget of at least ₹50.");
    setError("");
    setStep("understanding");
    understand.mutate(text.trim());
  };

  const saveProfile = useMutation({ mutationFn: (p: SavedProfile) => api.saveProfile(p) });

  const save = () => {
    if (!(protein >= 30 && protein <= 200)) return setError("Enter a protein target between 30 and 200 g.");
    const p = { protein_target_g: Math.round(protein), diet, allergies: splitList(allergies), likes: splitList(likes), budget, auto_add: auto };
    setError("");
    saveProfile.mutate(
      { ...p, goal_text: text.trim() },
      {
        onSuccess: () => {
          dispatch({ type: "saveProfile", profile: p, text: text.trim(), summary: describeProfile(p) });
          onDone(true);
        },
        onError: (e) => setError(`We couldn't save your goal. ${whatToDo(e)}`),
      },
    );
  };

  if (step === "understanding") {
    return (
      <div className="p-7">
        <Loading big>Finding what you meant...</Loading>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="p-7 pt-6">
        <h2 className="pr-12 font-display text-[1.7rem] font-extrabold leading-[1.1] tracking-tight">Here's what we understood</h2>
        <p className="mt-1.5 text-muted">Fix anything that's off. Coach uses these details to pick suggestions.</p>
        <blockquote className="mt-4 rounded-2xl bg-ground px-3.5 py-3 text-sm text-muted">“{text.trim()}”</blockquote>
        <label className="mt-4 block font-semibold">
          Protein target for this cart (g)
          <input className={field} type="number" inputMode="numeric" min={30} max={200} value={protein} onChange={(e) => setProtein(e.target.valueAsNumber)} />
        </label>
        <label className="mt-4 block font-semibold">
          Diet
          <select className={field} value={diet} onChange={(e) => setDiet(e.target.value as Diet)}>
            {Object.entries(DIET_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-4 block font-semibold">
          Allergies or foods to avoid (separate with commas)
          <input className={field} value={allergies} placeholder="None" onChange={(e) => setAllergies(e.target.value)} />
        </label>
        <label className="mt-4 block font-semibold">
          Foods you like (separate with commas)
          <input className={field} value={likes} placeholder="None" onChange={(e) => setLikes(e.target.value)} />
        </label>
        <label className="mt-5 flex items-start gap-3.5 rounded-2xl bg-coach-tint p-4">
          <input type="checkbox" className="mt-0.5 size-6 shrink-0 accent-coach" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          <span>
            <b>Let Coach pre-fill my cart with suggestions</b>
            <br />
            <span className="text-sm text-muted">Suggestions are labelled "Suggested by Coach" with a reason. You can remove any of them, or all at once. Coach never checks out.</span>
          </span>
        </label>
        {error && <p role="alert" className="mt-3 font-semibold text-[#8a1f1f]">{error}</p>}
        <Button variant="solid" disabled={saveProfile.isPending} className="mt-5 h-[52px] w-full rounded-2xl" onClick={save}>
          {saveProfile.isPending ? "Saving..." : "Save and show suggestions"}
        </Button>
        <div className="mt-1 text-center">
          <LinkButton onClick={() => setStep("describe")}>Describe again</LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 pt-6">
      <h2 className="pr-12 font-display text-[1.7rem] font-extrabold leading-[1.1] tracking-tight">
        {profile ? "Tell us again what you're aiming for" : "Welcome. What are you aiming for?"}
      </h2>
      <p className="mt-1.5 text-muted">Write it the way you'd say it. Mention if you're vegetarian, any allergies, and foods you like.</p>
      <label className="mt-4 block font-semibold">
        Your goal
        <textarea
          className={field}
          rows={4}
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="I'm a skinny guy training for an Ironman. Vegetarian, love paneer and peanuts."
        />
      </label>
      <label className="mt-4 block font-semibold">
        Budget for this cart (₹)
        <input className={field} type="number" inputMode="numeric" min={50} max={5000} value={budget} onChange={(e) => setBudget(e.target.valueAsNumber)} />
      </label>
      <p className="mt-5 rounded-2xl bg-ground p-3.5 text-sm text-muted">
        Cart Coach shares food information, not medical or dietary advice. For health concerns, talk to a doctor or a registered dietitian.
      </p>
      <label className="mt-3.5 flex min-h-11 items-center gap-3">
        <input type="checkbox" className="size-[22px] accent-ink" checked={adult} onChange={(e) => setAdult(e.target.checked)} />I am 18 or older
      </label>
      {understand.error instanceof SupportMessage && (
        <p role="alert" className="mt-3 rounded-2xl bg-coach-tint p-3.5">{understand.error.message}</p>
      )}
      {understand.isError && !(understand.error instanceof SupportMessage) && (
        <p role="alert" className="mt-3 font-semibold text-[#8a1f1f]">
          Coach couldn't read that right now. {whatToDo(understand.error)}
        </p>
      )}
      {error && <p role="alert" className="mt-3 font-semibold text-[#8a1f1f]">{error}</p>}
      <Button variant="solid" className="mt-5 h-[52px] w-full rounded-2xl" onClick={next}>
        Continue
      </Button>
      {first && (
        <div className="mt-1 text-center">
          <LinkButton onClick={() => onDone(false)}>Skip for now</LinkButton>
        </div>
      )}
    </div>
  );
}
