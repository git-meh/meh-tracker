import { cn } from "@/lib/utils";

export function Logo({ className, ...props }: { className?: string }) {
  return (
    <svg
      role="Logo"
      aria-label="Logo"
      xmlns="http://www.w3.org/2000/svg"

      width="28"
      height="28"
      viewBox="0 0 24 24"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        "lucide lucide-audio-waveform-icon lucide-audio-waveform fill-teal-800 stroke-teal-800",
        className
      )}
      {...props}
    >
      <path d="M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2" />
    </svg>
  );
}
