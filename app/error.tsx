'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="panel">
      <h1>Workspace unavailable</h1>
      <p>
        For local use, set LOCAL_DEV_MODE=true in .env.local. Check the terminal
        for details.
      </p>
      <button onClick={reset}>Try again</button>
    </section>
  );
}
