/**
 * Guided demo.
 *
 * The three-minute walkthrough is a feature of the product, not a rehearsal aid.
 * It drives the real application — switching objective, running scenarios — rather
 * than playing a recording, so what the audience sees is the live system. The
 * script is served by the API, which means it cannot drift out of sync with the
 * build.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from '../router.tsx';
import { api, useTwin, type DemoStep } from '../store.tsx';

export interface DemoController {
  active: boolean;
  index: number;
  step: DemoStep | null;
  steps: DemoStep[];
  elapsed: number;
  playing: boolean;
  start: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  togglePlay: () => void;
}

export function useDemo(): DemoController {
  const { boot, setObjective, reoptimize, setLastScenario } = useTwin();
  const { navigate } = useRouter();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const ranRef = useRef<Set<string>>(new Set());

  const steps = boot?.demo.steps ?? [];
  const step = active ? (steps[index] ?? null) : null;

  // Execute the step's command when it becomes current. Each command runs once.
  useEffect(() => {
    if (!step) return;
    navigate(step.route);
    if (ranRef.current.has(step.id)) return;
    ranRef.current.add(step.id);

    const c = step.command;
    if (c.kind === 'setObjective') {
      void setObjective(c.mode as never);
    } else if (c.kind === 'runOptimization') {
      void reoptimize();
    } else if (c.kind === 'runScenario') {
      void api
        .scenario({ kind: c.scenario as never, params: c.params }, false)
        .then((r) => setLastScenario(r.result))
        .catch(() => {
          /* the Scenarios page shows the error state if this fails */
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id]);

  // Advance the clock.
  useEffect(() => {
    if (!active || !playing || !step) return;
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, [active, playing, step]);

  useEffect(() => {
    if (!step) return;
    if (elapsed >= step.seconds) {
      setElapsed(0);
      setIndex((i) => Math.min(i + 1, steps.length - 1));
    }
  }, [elapsed, step, steps.length]);

  const start = useCallback(() => {
    ranRef.current = new Set();
    setIndex(0);
    setElapsed(0);
    setPlaying(true);
    setActive(true);
  }, []);

  const stop = useCallback(() => {
    setActive(false);
    navigate('/');
  }, [navigate]);

  const next = useCallback(() => {
    setElapsed(0);
    setIndex((i) => Math.min(i + 1, steps.length - 1));
  }, [steps.length]);

  const prev = useCallback(() => {
    setElapsed(0);
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  return {
    active,
    index,
    step,
    steps,
    elapsed,
    playing,
    start,
    stop,
    next,
    prev,
    togglePlay: () => setPlaying((p) => !p),
  };
}

export function DemoBar({ demo }: { demo: DemoController }) {
  const { step, index, steps, elapsed, playing } = demo;
  if (!step) return null;
  const progress = Math.min(100, (elapsed / step.seconds) * 100);
  const total = steps.reduce((s, x) => s + x.seconds, 0);
  const done = steps.slice(0, index).reduce((s, x) => s + x.seconds, 0) + elapsed;

  return (
    <div className="demobar" role="region" aria-label="Guided demonstration">
      <div className="demoprog" style={{ width: `${progress}%` }} />
      <div>
        <div className="dstep">
          STEP {index + 1} / {steps.length} · {Math.floor(done / 60)}:
          {String(done % 60).padStart(2, '0')} of {Math.floor(total / 60)}:
          {String(total % 60).padStart(2, '0')}
        </div>
      </div>
      <div>
        <h4>{step.title}</h4>
        <div className="dsay">{step.say}</div>
        <div className="dwatch">Watch: {step.watchFor}</div>
      </div>
      <div className="dctl">
        <button onClick={demo.prev} disabled={index === 0}>
          Back
        </button>
        <button onClick={demo.togglePlay}>{playing ? 'Pause' : 'Play'}</button>
        <button className="primary" onClick={demo.next} disabled={index === steps.length - 1}>
          Next
        </button>
        <button onClick={demo.stop}>Exit</button>
      </div>
    </div>
  );
}
