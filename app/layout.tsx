import type { Metadata } from "next";
import { DM_Sans, Bricolage_Grotesque, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage"
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono"
});

export const metadata: Metadata = {
  title: {
    default: "Meh Tracker - Job Application Tracker",
    template: "%s | Meh Tracker"
  },
  description:
    "Track job applications, share opportunities, and stay on top of your job hunt with friends.",
  icons: {
    icon: [
      {
        url: "/favicon-32x32.png",
        type: "image/png",
        sizes: "32x32"
      },
      {
        url: "/favicon-16x16.png",
        type: "image/png",
        sizes: "16x16"
      }
    ],
    shortcut: "/favicon.ico",
    apple: [
      {
        url: "/apple-touch-icon.png",
        type: "image/png",
        sizes: "180x180"
      }
    ]
  },
  manifest: "/site.webmanifest"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        "font-sans",
        dmSans.variable,
        bricolageGrotesque.variable,
        geistMono.variable
      )}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
