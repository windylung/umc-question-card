import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const notoSans = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-app-sans",
});

export const metadata: Metadata = {
  title: "PICK THE QUESTION CARD",
  description: "Pick your favorite question card and save it with a nickname.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${notoSans.variable} app-shell antialiased`}>
        <div className="app-container">
          <header className="mb-10 flex items-start justify-between">
            <div className="relative flex items-center">
              <div className="relative flex h-16 w-auto items-center md:h-24 lg:h-28">
                <img
                  src="/logo.png"
                  alt="Networking Day Logo"
                  className="h-full w-auto object-contain"
                />
              </div>
            </div>
          </header>

          <main className="pb-10">{children}</main>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
