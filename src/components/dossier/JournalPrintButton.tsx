'use client';

// Tiny client island for the journal page — the only reason it exists is to
// give the otherwise-server-rendered journal a `window.print()` button. The
// `.no-print` CSS hides it during the actual print pass.
export function JournalPrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="mt-4 rounded-md bg-stamp px-4 py-2 text-white shadow hover:opacity-90 no-print"
    >
      {label}
    </button>
  );
}
