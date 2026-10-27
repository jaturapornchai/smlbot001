import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'SML Bot - ระบบจัดการ Bot 24/7 (Agent Zero Engine)',
  description: 'ศูนย์ควบคุมและสั่งการบอทอัจฉริยะแบบ Web Base บนเซิร์ฟเวอร์หลัก',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('smlbot-theme') || 'dark';
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="relative min-h-screen overflow-x-hidden antialiased bg-grid-pattern selection:bg-indigo-500 selection:text-white">
        {/* Ambient Glowing Motion Orbs */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="animate-pulse-glow absolute -top-40 -left-40 h-96 w-96 rounded-full bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent blur-3xl dark:from-indigo-600/25 dark:via-purple-600/15" />
          <div className="animate-pulse-glow absolute top-1/3 -right-40 h-[30rem] w-[30rem] rounded-full bg-gradient-to-bl from-cyan-500/15 via-indigo-500/10 to-transparent blur-3xl dark:from-cyan-600/20 dark:via-indigo-600/15" style={{ animationDelay: '-3s' }} />
          <div className="animate-pulse-glow absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-gradient-to-tr from-purple-500/15 via-pink-500/10 to-transparent blur-3xl dark:from-purple-600/20 dark:via-pink-600/10" style={{ animationDelay: '-1.5s' }} />
        </div>

        <Navbar />

        <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          {children}
        </main>
      </body>
    </html>
  );
}
