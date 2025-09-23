import "./globals.css";
import { SessionProvider } from '../components/providers/SessionProvider';

export const metadata = { title: "DealershipAI — Halo", description: "Algorithmic Trust Dashboard" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: "#0b0b0b", color: "#e5e7eb", margin: 0, fontFamily: "ui-sans-serif, system-ui" }}>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}