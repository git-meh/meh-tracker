import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accept Invitation",
  description: "Accept your invitation and create a Meh Tracker account."
};

export default function InviteLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
