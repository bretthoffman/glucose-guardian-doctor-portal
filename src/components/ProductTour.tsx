import { useEffect, useLayoutEffect, useState } from "react";
import { X } from "lucide-react";

export interface TourStep {
  selector: string;
  title: string;
  body: string;
}

const SEEN_KEY = "gg_tour_seen";
/** Fire `window.dispatchEvent(new Event(TOUR_EVENT))` to (re)launch the tour. */
export const TOUR_EVENT = "gg:start-tour";

/**
 * Lightweight first-run product tour: dims the screen, spotlights one element at a time, and shows
 * a tooltip with Back / Next / Skip. Runs automatically the first time (unless `enabled` is false),
 * and can be replayed by dispatching TOUR_EVENT. No external dependencies.
 */
export function ProductTour({ steps, enabled = true }: { steps: TourStep[]; enabled?: boolean }) {
  const [active, setActive] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Auto-start once.
  useEffect(() => {
    if (!enabled) return;
    let seen = false;
    try {
      seen = !!localStorage.getItem(SEEN_KEY);
    } catch {
      /* ignore */
    }
    if (!seen) {
      setI(0);
      setActive(true);
    }
  }, [enabled]);

  // Replay on demand.
  useEffect(() => {
    const onStart = () => {
      setI(0);
      setActive(true);
    };
    window.addEventListener(TOUR_EVENT, onStart);
    return () => window.removeEventListener(TOUR_EVENT, onStart);
  }, []);

  const step = active ? steps[i] : undefined;

  useLayoutEffect(() => {
    if (!step) return;
    const place = () => {
      const el = document.querySelector(step.selector);
      if (!el) {
        setRect(null);
        return;
      }
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      setRect(el.getBoundingClientRect());
    };
    place();
    const onChange = () => place();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [step]);

  if (!step) return null;

  const finish = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setActive(false);
  };
  const next = () => (i < steps.length - 1 ? setI(i + 1) : finish());
  const back = () => setI((n) => Math.max(0, n - 1));

  const pad = 8;
  const spot = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  const TW = 320;
  let tipStyle: React.CSSProperties;
  if (rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(rect.left, 16), vw - TW - 16);
    const below = rect.bottom + 14 + 180 < vh;
    tipStyle = below
      ? { top: rect.bottom + 14, left }
      : { top: Math.max(16, rect.top - 14 - 184), left };
  } else {
    tipStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  return (
    <div className="fixed inset-0 z-[60]">
      {/* click-catcher so the page behind isn't interactive during the tour */}
      <div className="absolute inset-0" />
      {spot ? (
        <div
          className="absolute rounded-xl transition-all duration-200 pointer-events-none"
          style={{
            ...spot,
            boxShadow: "0 0 0 2px hsl(217 91% 60%), 0 0 0 9999px rgba(2,6,23,0.72)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(2,6,23,0.72)]" />
      )}

      <div
        className="absolute w-[320px] bg-card border border-border rounded-2xl shadow-2xl p-4"
        style={tipStyle}
      >
        <button
          onClick={finish}
          aria-label="Close tour"
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
        <p className="text-sm font-semibold text-foreground pr-6">{step.title}</p>
        <p className="text-sm text-muted-foreground mt-1.5 leading-snug">{step.body}</p>
        <div className="flex items-center justify-between mt-4">
          <span className="text-[11px] text-muted-foreground">
            {i + 1} of {steps.length}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={finish} className="text-xs text-muted-foreground hover:text-foreground">
              Skip
            </button>
            {i > 0 && (
              <button
                onClick={back}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-border text-foreground hover:bg-secondary transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              {i < steps.length - 1 ? "Next" : "Done"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
