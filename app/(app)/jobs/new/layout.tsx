import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Post a Job",
  description: "Add a job opportunity to Meh Tracker.",
  robots: { index: false, follow: false }
};

export default function NewJobLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
