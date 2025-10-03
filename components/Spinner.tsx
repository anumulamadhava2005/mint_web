// Utility to join class names conditionally
function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

type TopEndSpinnerProps = {
  show?: boolean
  size?: number
  thickness?: number
  label?: string
  className?: string
}

export default function Spinner({
  show = true,
  size = 28,
  thickness = 3,
  label = "Loading",
  className,
}: TopEndSpinnerProps) {
  if (!show) return null;
  return (
    <div
      className={cn(
        "fixed inset-0 z-[1000] flex items-center justify-center bg-white",
        className
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 shadow-sm">
        <span
          aria-hidden="true"
          className={cn("inline-block rounded-full animate-spin motion-reduce:animate-none")}
          style={{
            width: size,
            height: size,
            borderRadius: "9999px",
            borderStyle: "solid",
            borderWidth: thickness,
            borderColor: "#eee",
            borderTopColor: "#388bfd",
          }}
        />
        <span className="text-sm text-gray-700">{label}</span>
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}
