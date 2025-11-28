import React from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Guacamole | Ratio1 image sharing',
  description: 'Minimal Ratio1 image sharing app using CStore and R1FS'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f172a'
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header className="app-header">
            <div className="brand">
              <span className="brand-mark">🥑</span>
              <div>
                <div className="brand-title">Guacamole</div>
                <div className="brand-subtitle">Ratio1 image sharing</div>
              </div>
            </div>
          </header>
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
