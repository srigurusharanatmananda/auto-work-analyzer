'use client';

import { Inter } from "next/font/google";
import { usePathname } from "next/navigation";
import { Toaster } from "react-hot-toast";
import Sidebar from "@/lib/components/Sidebar";
import TopLoadingBar from "@/components/TopLoadingBar";
import ClientWrapper from "@/components/ClientWrapper";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/register';

  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <ClientWrapper>
          <TopLoadingBar />
          {isAuthPage ? (
            // Full-screen layout for auth pages
            <main className="min-h-screen">
              {children}
            </main>
          ) : (
            // Sidebar layout for authenticated pages
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <main className="flex-1 overflow-y-auto">
                {children}
              </main>
            </div>
          )}
        </ClientWrapper>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1a1a1a',
              color: '#fff',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #2a2a2a',
              boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#1a1a1a',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#1a1a1a',
              },
            },
            loading: {
              iconTheme: {
                primary: '#3b82f6',
                secondary: '#1a1a1a',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
