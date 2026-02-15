import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Health Tracker",
  description:
    "Personal health & weight loss tracker with AI-powered food analysis, workout scheduling, and progress tracking.",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HealthTrack",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="min-h-screen pb-20">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}

// ---- Bottom Navigation (inline to keep layout simple) ----
function BottomNav() {
  const navItems = [
    { href: "/", icon: "🏠", label: "Home" },
    { href: "/food", icon: "🍽️", label: "Food" },
    { href: "/workouts", icon: "💪", label: "Workout" },
    { href: "/mobility", icon: "🧘", label: "Mobility" },
    { href: "/progress", icon: "📊", label: "Progress" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[var(--card)] border-t border-slate-700 safe-bottom z-50">
      <div className="max-w-lg mx-auto flex justify-around items-center h-16">
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex flex-col items-center justify-center gap-0.5 text-xs text-slate-400 hover:text-white transition-colors px-3 py-2"
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
