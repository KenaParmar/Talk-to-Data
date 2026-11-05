import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const metadata: Metadata = {
  title: 'DataTalk Agent',
  description: 'Unleash agentic power over your data',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${outfit.variable} font-sans bg-slate-950 text-slate-200 antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
