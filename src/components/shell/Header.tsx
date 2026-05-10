import Link from 'next/link';

export function Header() {
  return (
    <header className="border-b border-ink/10 bg-paper/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="font-casefile text-2xl">
          Виртуальный следователь
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/new">Новое дело</Link>
          <Link href="/journal">Журнал</Link>
        </nav>
      </div>
    </header>
  );
}
