import type { Metadata } from "next"
import { Geist, Geist_Mono, Cabin, Mukta, Fira_Code } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils";

const firaCodeFiraCode = Fira_Code({subsets:['cyrillic','cyrillic-ext','greek','greek-ext','latin','latin-ext'],weight:['300','400','500','600','700'],variable:'--font-fira-code'});

const muktaMukta = Mukta({subsets:['devanagari','latin','latin-ext'],weight:['200','300','400','500','600','700','800'],variable:'--font-mukta'});

const cabinCabin = Cabin({subsets:['latin','latin-ext','vietnamese'],weight:['400','500','600','700'],variable:'--font-cabin'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "meh-tracker - Job Application Tracker",
  description:
    "Track job applications, share opportunities, and stay on top of your job hunt with friends.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, cabinCabin.variable, muktaMukta.variable, firaCodeFiraCode.variable)}
    >
      <body className="min-h-full">{children}</body>
    </html>
  )
}
