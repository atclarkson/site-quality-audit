import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { APP_NAME } from '@site-quality-audit/domain';
import './globals.css';

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Phase 1 foundation scaffold',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
