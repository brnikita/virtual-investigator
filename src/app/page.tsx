import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-casefile text-5xl">Виртуальный следователь</h1>
      <p className="mt-4 text-lg text-ink/80">
        Шуточные досье на одноклассников и друзей. Допрос ведёт добрый Инспектор Морковкин,
        в конце получаешь распечатываемое досье.
      </p>
      <div className="mt-10 flex gap-4">
        <Link
          href="/new"
          className="rounded-md bg-stamp px-5 py-3 text-white shadow hover:opacity-90"
        >
          Завести новое дело
        </Link>
        <Link
          href="/journal"
          className="rounded-md border border-ink/20 px-5 py-3 hover:bg-ink/5"
        >
          Открыть журнал
        </Link>
      </div>
    </main>
  );
}
