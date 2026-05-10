import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/shell/Header';

export const metadata: Metadata = {
  title: 'Virtual Investigator',
  description: 'A friendly interrogation game that builds printable dossiers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-paper text-ink">
        <Header />
        {children}
      </body>
    </html>
  );
}
