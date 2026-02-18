import './global.css';
import { AuthProvider } from '@/components/auth/AuthProvider';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nookstead — Pixel Art MMO',
  description:
    'Build your homestead in a living world populated by AI-driven NPCs. A 2D pixel art MMO farming RPG.',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Nookstead — Pixel Art MMO',
    description:
      'Build your homestead in a living world populated by AI-driven NPCs.',
    images: [{ url: '/pics_logo.png', width: 1569, height: 1569 }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
