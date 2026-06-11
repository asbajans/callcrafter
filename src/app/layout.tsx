import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CallCrafter AI - Akıllı Çağrı Merkezi',
  description: 'Yapay zeka destekli çok kanallı iletişim platformu',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
