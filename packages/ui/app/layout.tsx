import type { ReactNode } from "react";
import AuthGate from "../components/AuthGate";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "./globals.css";

export const metadata = {
  title: "Pulse",
  description: "Self-owned monitoring dashboard",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden bg-bg text-text">
        <AuthGate>
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header />
            <div className="flex-1 overflow-y-auto">
              <main className="p-8">{children}</main>
              <Footer />
            </div>
          </div>
        </AuthGate>
      </body>
    </html>
  );
}
