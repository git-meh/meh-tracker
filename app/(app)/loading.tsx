import { SpinnerCustom } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <SpinnerCustom className="size-6" />
    </div>
  );
}
