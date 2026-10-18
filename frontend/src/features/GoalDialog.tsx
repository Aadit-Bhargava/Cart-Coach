import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/api";
import { SupportMessage } from "@/api/http";
import type { Activity, Diet, SavedProfile, StatsInput } from "@/api/types";
import { Button, LinkButton, Loading, field } from "@/components/ui";
import { whatToDo } from "@/lib/errors";
import { plural } from "@/lib/format";
import { DIET_LABEL, describeProfile, splitList } from "@/lib/profile";
import { cartTarget, MAX_DAILY, MIN_DAILY, readStats } from "@/lib/target";
import { applyUnderstanding } from "@/lib/understanding";
import { useDispatch, useStore } from "@/state/store";

type Step = "describe" | "understanding" | "confirm";

/** "full" asks everything. "details" is for an account saved before age, weight and height were asked. */
export type GoalMode = "full" | "details";

interface Props {
  /** First run at sign-up: shows Skip and cannot be dismissed any other way. */
  first: boolean;
  mode: GoalMode;
  onDone: (saved: boolean) => void;
}

const ACTIVITY_LABEL: Record<Activity, string> = {
  general: "Everyday movement",
  active: "Regular exercise",
  endurance: "Endurance training (running, cycling, swimming)",
  strength: "Strength training (gym, lifting)",
};

const DAY_CHOICES = [1, 3, 7];

export function GoalContent({ first, mode, onDone }: Props) {
  const { profile, goalText } = useStore();
  const dispatch = useDispatch();
  const details = mode === "details";

  const [step, setStep] = useState<Step>("describe");
  const [text, setText] = useState(goalText);
  const [budget, setBudget] = useState(profile?.budget ?? 600);
  const [adult, setAdult] = useState(Boolean(profile));
  const [auto, setAuto] = useState(profile?.auto_add ?? true);
  const [error, setError] = useState("");

  // Personal details are typed as text so "72,5" and half-typed numbers are handled by readStats.
  const [age, setAge] = useState(profile?.age_years != null ? String(profile.age_years) : "");
  const [weight, setWeight] = useState(profile?.weight_kg != null ? String(profile.weight_kg) : "");
  const [height, setHeight] = useState(profile?.height_cm != null ? String(profile.height_cm) : "");
  const [days, setDays] = useState(profile?.days && DAY_CHOICES.includes(profile.days) ? profile.days : 3);
  const [stats, setStats] = useState<StatsInput | null>(null);

  const [activity, setActivity] = useState<Activity>("general");
  const [daily, setDaily] = useState(profile?.daily_protein_g || 110);
  const [dailyEdited, setDailyEdited] = useState(false);
  const [basis, setBasis] = useState("");
  const [diet, setDiet] = useState<Diet>(profile?.diet ?? "unknown");
  const [allergies, setAllergies] = useState(profile?.allergies.join(", ") ?? "");
  const [likes, setLikes] = useState(profile?.likes.join(", ") ?? "");

  const understand = useMutation({
    mutationFn: (v: { text: string; stats: StatsInput }) => api.understandGoal(v.text, v.stats),
    onSuccess: (u) => {
      const next = applyUnderstanding(mode, { diet, allergies, likes }, u);
      setActivity(next.activity);
      setDaily(next.daily);
      setDailyEdited(false);
      setBasis(next.basis);
      setDiet(next.diet);
      setAllergies(next.allergies);
      setLikes(next.likes);
      setStep("confirm");
    },
    onError: () => setStep("describe"),
  });

  // Changing the activity recalculates the daily amount, unless the user typed their own.
  const retarget = useMutation({
    mutationFn: (v: { stats: StatsInput; activity: Activity }) => api.profileTarget(v.stats, v.activity),
    onSuccess: (r) => {
      if (dailyEdited) return;
      setDaily(r.daily_protein_g);
      setBasis(r.basis);
    },
  });

  const next = () => {
    if (!details) {
      if (!adult) return setError("Confirm you are 18 or older to continue.");
      if (text.trim().length < 8) return setError("Write a few words about your goal so Coach can understand it.");
      if (!(budget >= 50)) return setError("Enter a budget of at least ₹50.");
    }
    const read = readStats(age, weight, height);
    if (!read.ok) return setError(read.error);
    setError("");
    setStats(read.stats);
    setStep("understanding");
    understand.mutate({ text: text.trim(), stats: read.stats });
  };

  const saveProfile = useMutation({ mutationFn: (p: SavedProfile) => api.saveProfile(p) });

  const save = () => {
    if (!stats) return setStep("describe");
    if (!Number.isInteger(daily) || daily < MIN_DAILY || daily > MAX_DAILY) return setError(`Enter a daily protein amount between ${MIN_DAILY} and ${MAX_DAILY} g.`);
    const p = {
      protein_target_g: cartTarget(daily, days),
      diet,
      allergies: splitList(allergies),
      likes: splitList(likes),
      budget,
      auto_add: auto,
      age_years: stats.age_years,
      weight_kg: stats.weight_kg,
      height_cm: stats.height_cm,
      activity,
      days,
      daily_protein_g: daily,
    };
    setError("");
    saveProfile.mutate(
      { ...p, goal_text: text.trim(), details_complete: true },
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

  if (step === "confirm" && stats) {
    return (
      <div className="p-7 pt-6">
        <h2 className="pr-12 font-display text-[1.7rem] font-extrabold leading-[1.1] tracking-tight">Here's what we understood</h2>
        <p className="mt-1.5 text-muted">Fix anything that's off. Coach uses these details to pick suggestions.</p>
        <blockquote className="mt-4 rounded-2xl bg-ground px-3.5 py-3 text-sm text-muted">“{text.trim()}”</blockquote>

        <label className="mt-4 block font-semibold">
          How active are you?
          <select
            className={field}
            value={activity}
            onChange={(e) => {
              const a = e.target.value as Activity;
              setActivity(a);
              retarget.mutate({ stats, activity: a });
            }}
          >
            {(Object.keys(ACTIVITY_LABEL) as Activity[]).map((a) => (
              <option key={a} value={a}>
                {ACTIVITY_LABEL[a]}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 block font-semibold">
          Protein per day (g)
          <input
            className={field}
            type="number"
            inputMode="numeric"
            min={MIN_DAILY}
            max={MAX_DAILY}
            value={Number.isNaN(daily) ? "" : daily}
            onChange={(e) => {
              setDaily(e.target.valueAsNumber);
              setDailyEdited(true);
              setBasis("the amount you set");
            }}
          />
        </label>
        <p className="mt-1.5 text-sm text-muted" aria-live="polite">
          {basis ? `Based on ${basis}. ` : ""}
          {Number.isFinite(daily) ? `That is ${cartTarget(daily, days)} g for ${plural(days, "day", "days")}.` : ""}
          {retarget.isError ? ` We couldn't recalculate it. ${whatToDo(retarget.error)}` : ""}
        </p>

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
        {error && (
          <p role="alert" className="mt-3 font-semibold text-[#8a1f1f]">
            {error}
          </p>
        )}
        <Button variant="solid" disabled={saveProfile.isPending} className="mt-5 h-[52px] w-full rounded-2xl" onClick={save}>
          {saveProfile.isPending ? "Saving..." : "Save and show suggestions"}
        </Button>
        <div className="mt-1 text-center">
          <LinkButton onClick={() => setStep("describe")}>Go back</LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 pt-6">
      <h2 className="pr-12 font-display text-[1.7rem] font-extrabold leading-[1.1] tracking-tight">
        {details ? "Add a few details" : profile ? "Tell us again what you're aiming for" : "Welcome. What are you aiming for?"}
      </h2>
      <p className="mt-1.5 text-muted">
        {details
          ? "Coach needs your age, weight and height to work out your protein target. Until then it won't suggest items."
          : "Write it the way you'd say it. Mention if you're vegetarian, any allergies, and foods you like."}
      </p>

      {!details && (
        <>
          <label className="mt-4 block font-semibold">
            Your goal
            <textarea
              className={field}
              rows={4}
              maxLength={500}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Training for an Ironman. Vegetarian, love paneer and peanuts."
            />
          </label>
          <label className="mt-4 block font-semibold">
            Budget for this cart (₹)
            <input className={field} type="number" inputMode="numeric" min={50} max={5000} value={Number.isNaN(budget) ? "" : budget} onChange={(e) => setBudget(e.target.valueAsNumber)} />
          </label>
        </>
      )}

      <div className="mt-4 grid grid-cols-3 gap-3">
        <label className="block font-semibold">
          Age
          <input className={field} inputMode="numeric" autoComplete="off" value={age} onChange={(e) => setAge(e.target.value)} />
        </label>
        <label className="block font-semibold">
          Weight (kg)
          <input className={field} inputMode="decimal" autoComplete="off" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <label className="block font-semibold">
          Height (cm)
          <input className={field} inputMode="decimal" autoComplete="off" value={height} onChange={(e) => setHeight(e.target.value)} />
        </label>
      </div>
      <p className="mt-1.5 text-sm text-muted">We use these only to work out your protein target.</p>

      <label className="mt-4 block font-semibold">
        How many days should this cart cover?
        <select className={field} value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {DAY_CHOICES.map((d) => (
            <option key={d} value={d}>
              {plural(d, "day", "days")}
            </option>
          ))}
        </select>
      </label>

      {!details && (
        <>
          <p className="mt-5 rounded-2xl bg-ground p-3.5 text-sm text-muted">
            Cart Coach shares food information, not medical or dietary advice. For health concerns, talk to a doctor or a registered dietitian.
          </p>
          <label className="mt-3.5 flex min-h-11 items-center gap-3">
            <input type="checkbox" className="size-[22px] accent-ink" checked={adult} onChange={(e) => setAdult(e.target.checked)} />I am 18 or older
          </label>
        </>
      )}

      {understand.error instanceof SupportMessage && (
        <p role="alert" className="mt-3 rounded-2xl bg-coach-tint p-3.5">
          {understand.error.message}
        </p>
      )}
      {understand.isError && !(understand.error instanceof SupportMessage) && (
        <p role="alert" className="mt-3 font-semibold text-[#8a1f1f]">
          Coach couldn't read that right now. {whatToDo(understand.error)}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 font-semibold text-[#8a1f1f]">
          {error}
        </p>
      )}
      <Button variant="solid" className="mt-5 h-[52px] w-full rounded-2xl" onClick={next}>
        Continue
      </Button>
      {(first || details) && (
        <div className="mt-1 text-center">
          <LinkButton onClick={() => onDone(false)}>{details ? "Not now" : "Skip for now"}</LinkButton>
        </div>
      )}
    </div>
  );
}
