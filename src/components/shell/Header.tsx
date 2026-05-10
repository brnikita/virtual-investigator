import Link from 'next/link';

// Top-of-page navigation. Bilingual labels (RU / EN) keep the header useful
// before the user has chosen a case language; per-case copy lives in the
// dictionary helpers used by individual pages.
export function Header() {
  return (
    <header className="border-b border-ink/10 bg-paper/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="font-casefile text-2xl">
          Виртуальный следователь
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/new">Новое дело / New case</Link>
          <Link href="/cases">Мои дела / My cases</Link>
          <Link href="/journal">Журнал / Journal</Link>
        </nav>
      </div>
    </header>
  );
}
