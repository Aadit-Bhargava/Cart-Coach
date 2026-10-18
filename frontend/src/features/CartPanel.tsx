import { useState } from "react";
import { Button, LinkButton, Loading, ProductImage, cx, field } from "@/components/ui";
import { DietMark } from "@/components/DietMark";
import { Stepper } from "@/components/Stepper";
import { grams, inr, plural } from "@/lib/format";
import { whatToDo } from "@/lib/errors";
import { detailsComplete } from "@/lib/target";
import { describeProfile } from "@/lib/profile";
import type { ProductView } from "@/lib/product";
import { MAX_PREFERENCE } from "@/lib/preference";
import { useCartView, type CartLine } from "@/state/cart";
import { useCoach } from "@/state/coach";
import { useDispatch, useStore } from "@/state/store";
import { useToast } from "@/components/Toast";

interface Props {
  byId: Map<number, ProductView>;
  onGoal: () => void;
  /** Opens the short popup that asks for age, weight and height. */
  onDetails: () => void;
  onLog: () => void;
  className?: string;
}

export function CartPanel({ byId, onGoal, onDetails, onLog, className }: Props) {
  const { profile, note, preference } = useStore();
  const dispatch = useDispatch();
  const toast = useToast();
  const cart = useCartView(byId);
  const coach = useCoach();
  const have = cart.userProtein + cart.coachProtein;

  const coachProtein = cart.coach.reduce((a, l) => a + (l.product.packProtein ?? 0), 0);
  const coachCost = cart.coach.reduce((a, l) => a + l.product.price, 0);
  const complete = profile ? detailsComplete(profile) : false;

  return (
    <div className={cx("flex flex-col overflow-hidden rounded-3xl bg-white", className)}>
      {profile && complete && (
        <Meter have={have} user={cart.userProtein} coach={cart.coachProtein} goal={profile.protein_target_g} days={profile.days} daily={profile.daily_protein_g} unknown={cart.unknownProtein} />
      )}

      <div className="flex-1 overflow-y-auto px-5 pb-2">
        <section aria-label="What Coach understood" className="mt-4 flex items-start justify-between gap-3 rounded-2xl border border-line p-3.5">
          <div>
            <b className="block font-display">{profile ? "What Coach understood" : "Get suggestions for your goal"}</b>
            <p className="mt-0.5 text-sm text-muted">{profile ? describeProfile(profile) : "Tell Coach what you're aiming for and it will suggest items for your cart."}</p>
          </div>
          <LinkButton onClick={onGoal}>{profile ? "Edit" : "Set goal"}</LinkButton>
        </section>

        {profile && !complete && (
          <section aria-label="Add your details" className="mt-3 flex items-start justify-between gap-3 rounded-2xl bg-coach-tint p-3.5">
            <div>
              <b className="block font-display text-coach">Add your details to get suggestions</b>
              <p className="mt-0.5 text-sm">Coach needs your age, weight and height to work out your protein target.</p>
            </div>
            <LinkButton onClick={onDetails}>Add</LinkButton>
          </section>
        )}

        {coach.status === "loading" && (
          <div className="mt-3">
            <Loading>Finding upgrades...</Loading>
          </div>
        )}
        {coach.status === "error" && (
          <div role="alert" className="mt-3 rounded-2xl bg-[#fdeaea] p-3.5 text-[#8a1f1f]">
            <b className="block">Coach couldn't find upgrades</b>
            Your cart hasn't changed. {whatToDo(coach.error)}
            <div>
              <LinkButton className="!text-[#8a1f1f]" onClick={coach.retry}>
                Try again
              </LinkButton>
            </div>
          </div>
        )}

        {cart.count === 0 && coach.status !== "loading" && (
          <div className="px-2 py-7 text-muted">
            <b className="block font-display text-lg text-ink">Your cart is empty</b>
            Add something from the shelves{profile ? ", and Coach will suggest items that help with your goal" : ""}.
          </div>
        )}

        {note && (
          <div className="mt-3 rounded-2xl bg-coach-tint p-3.5">
            <b className="block text-coach">Coach updated its suggestions</b>
            {note}
          </div>
        )}

        {preference && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-coach/30 py-1.5 pl-3.5 pr-1.5 text-sm">
            <span>
              Coach is prioritising: <b>{preference}</b>
            </span>
            <button
              type="button"
              aria-label={`Stop prioritising ${preference}`}
              onClick={() => dispatch({ type: "setPreference", preference: "" })}
              className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-ground"
            >
              ✕
            </button>
          </div>
        )}

        {cart.coach.length > 0 && (
          <>
            <div className="mt-3 rounded-2xl bg-coach-tint p-3.5">
              <b className="block text-coach">
                Coach added {plural(cart.coach.length, "item", "items")} (+{grams(coachProtein)} g protein, +{inr(coachCost)})
              </b>
              Review each one below, or undo them all.
              <div className="flex gap-3.5">
                <LinkButton
                  onClick={() => {
                    dispatch({ type: "undoAll" });
                    toast("Suggestions removed");
                  }}
                >
                  Undo all suggestions
                </LinkButton>
                <LinkButton onClick={onLog}>See why</LinkButton>
              </div>
            </div>
            <h3 className="mb-1 mt-4 font-display font-bold">Suggested by Coach</h3>
            {cart.coach.map((l) => (
              <CoachLine key={l.product.id} {...l} />
            ))}
          </>
        )}

        {cart.user.length > 0 && (
          <>
            <h3 className="mb-1 mt-4 font-display font-bold">Your items</h3>
            {cart.user.map((l) => (
              <UserLine key={l.product.id} {...l} />
            ))}
          </>
        )}
      </div>

      <div className="border-t border-line px-5 pb-5 pt-4">
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
          <dt>Item total</dt>
          <dd className="text-right font-semibold">{inr(cart.total)}</dd>
          <dt>Other charges</dt>
          <dd className="text-right font-semibold">None</dd>
          <dt className="pt-1.5 font-display text-xl font-extrabold">Total</dt>
          <dd className="pt-1.5 text-right font-display text-xl font-extrabold">{inr(cart.total)}</dd>
        </dl>
        <p className="mt-1.5 text-sm text-muted">
          {profile ? `${inr(Math.max(0, profile.budget - cart.total))} left of your ${inr(profile.budget)} budget. ` : ""}Demo prices.
        </p>
        <Button variant="solid" className="mt-3 h-[52px] w-full rounded-2xl" onClick={() => toast("Cart saved. Nothing has been ordered.")}>
          Save cart
        </Button>
        <LinkButton onClick={onLog}>Decision log</LinkButton>
      </div>
    </div>
  );
}

function Meter({ have, user, coach, goal, days, daily, unknown }: { have: number; user: number; coach: number; goal: number; days: number; daily: number; unknown: number }) {
  const scale = Math.max(goal, have) || 1;
  return (
    <section aria-label="Protein goal" className="bg-ink px-5 pb-[18px] pt-[22px] text-white">
      <h2 className="text-[15px] font-semibold text-[#c9c9e4]">Protein in your cart</h2>
      <div className="mt-1.5 font-display text-[3.2rem] font-extrabold leading-none tracking-tight">
        {grams(have)}
        <small className="ml-1 text-xl font-medium tracking-normal text-[#c9c9e4]">of {goal} g</small>
      </div>
      <p className="mt-1 text-sm text-[#c9c9e4]">{plural(days, "day", "days")} at {daily} g a day</p>
      <div
        role="img"
        aria-label={`${grams(user)} g from your items, ${grams(coach)} g from Coach suggestions, goal ${goal} g`}
        className="mt-4 flex h-4 overflow-hidden rounded-lg bg-white/15"
      >
        <div className="h-full bg-white transition-[width] duration-700 ease-out-soft" style={{ width: `${(user / scale) * 100}%` }} />
        <div
          className="h-full transition-[width] duration-700 ease-out-soft"
          style={{ width: `${(coach / scale) * 100}%`, background: "repeating-linear-gradient(135deg,#8b73ff 0 6px,#6c4ef2 6px 12px)" }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-[#e0e0f2]">
        <span><i className="mr-1.5 inline-block size-2.5 rounded-[3px] bg-white" />Your items</span>
        <span><i className="mr-1.5 inline-block size-2.5 rounded-[3px] bg-[#8b73ff]" />Suggested by Coach</span>
      </div>
      <p className="mt-2.5 font-semibold" aria-live="polite">
        {have >= goal ? `Goal reached, ${grams(have - goal)} g over` : `${grams(goal - have)} g to go`}
      </p>
      {unknown > 0 && (
        <p className="mt-1 text-[13px] text-[#c9c9e4]">
          {plural(unknown, "item has", "items have")} no protein data per pack, so {unknown === 1 ? "it isn't" : "they aren't"} counted.
        </p>
      )}
    </section>
  );
}

function UserLine({ product, line }: CartLine) {
  const dispatch = useDispatch();
  return (
    <div className="grid grid-cols-[52px_1fr_auto] items-center gap-3 border-b border-line py-3">
      <ProductImage product={product} className="size-[52px] rounded-xl" textClass="text-2xl" />
      <div>
        <div className="line-clamp-2 font-semibold leading-tight">
          <DietMark diet={product.diet} /> {product.name}
        </div>
        <div className="text-[13px] text-muted">{product.packText}</div>
      </div>
      <div className="grid justify-items-end gap-1.5">
        <span className="font-bold">{inr(product.price * line.qty)}</span>
        <Stepper small qty={line.qty} onInc={() => dispatch({ type: "add", id: product.id })} onDec={() => dispatch({ type: "step", id: product.id, delta: -1 })} />
      </div>
    </div>
  );
}

function CoachLine({ product }: CartLine) {
  const dispatch = useDispatch();
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const [wanted, setWanted] = useState("");
  return (
    <div className="my-2 grid grid-cols-[52px_1fr] gap-3 rounded-2xl border-l-4 border-coach bg-coach-tint p-3">
      <ProductImage product={product} className="size-[52px] rounded-xl !bg-white !text-coach" textClass="text-2xl" />
      <div>
        <span className="mb-1 inline-block rounded-lg bg-coach px-2.5 py-0.5 text-xs font-bold text-white">Suggested by Coach</span>
        <div className="line-clamp-2 font-semibold leading-tight">
          <DietMark diet={product.diet} /> {product.name}
        </div>
        <div className="text-[13px] text-muted">
          {product.packText}, {inr(product.price)} demo price{product.proteinPerRupee != null ? `, ${product.proteinPerRupee.toFixed(2)} g per ₹` : ""}
        </div>
        <div className="mt-0.5 text-sm font-semibold text-coach">
          +{grams(product.packProtein ?? 0)} g protein, {inr(product.price)} more
        </div>
      </div>
      <div className="col-span-2 flex items-center justify-between gap-2">
        <LinkButton onClick={() => setAsking((a) => !a)} aria-expanded={asking}>
          Not this
        </LinkButton>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              dispatch({ type: "dismiss", id: product.id, name: product.name });
              toast("Removed");
            }}
          >
            Remove
          </Button>
          <Button variant="coach" onClick={() => dispatch({ type: "keep", id: product.id, name: product.name })}>
            Keep
          </Button>
        </div>
      </div>
      {asking && (
        <form
          className="col-span-2"
          onSubmit={(e) => {
            e.preventDefault();
            dispatch({ type: "findAnother", id: product.id, name: product.name, preference: wanted });
            toast("Looking for another pick");
          }}
        >
          <label className="block text-sm font-semibold">
            What would you like instead? (optional)
            <input
              className={field}
              autoFocus
              maxLength={MAX_PREFERENCE}
              value={wanted}
              onChange={(e) => setWanted(e.target.value)}
              placeholder="For example: paneer"
            />
          </label>
          <div className="mt-2 flex gap-2">
            <Button type="submit" variant="coach">
              Find another
            </Button>
            <Button variant="ghost" onClick={() => setAsking(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
