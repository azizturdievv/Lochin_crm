import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import Providers from '@/components/Providers';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const metadata: Metadata = {
  title: 'Lochin School CRM',
  description: "O'quv markazi boshqaruv tizimi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={`${geist.variable} h-full`}>
      <body className="h-full bg-gray-50 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
