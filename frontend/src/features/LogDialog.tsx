import { useStore } from "@/state/store";

export function LogContent() {
  const { log } = useStore();
  return (
    <div className="p-7 pt-6">
      <h2 className="pr-12 font-display text-[1.7rem] font-extrabold leading-[1.1] tracking-tight">Decision log</h2>
      <p className="mt-1.5 text-muted">What Coach changed, why, and where each number comes from.</p>
      {log.length ? (
        <ul className="mt-4">
          {log.map((l, i) => (
            <li key={i} className="border-t border-line py-3.5">
              <b className="block">{l.title}</b>
              <span className="text-sm text-muted">{l.detail}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-7 text-muted">
          <b className="block font-display text-lg text-ink">Nothing logged yet</b>
          When Coach suggests something or you change a suggestion, it shows up here.
        </div>
      )}
    </div>
  );
}
