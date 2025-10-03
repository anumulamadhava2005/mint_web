import styles from "./css/Spinner.module.css"

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
      className={[styles.overlay, className].filter(Boolean).join(" ")}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={styles.card}>
        <span
          aria-hidden="true"
          className={styles.spin}
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
        <span className={styles.label}>{label}</span>
        <span className={styles.srOnly}>{label}</span>
      </div>
    </div>
  );
}
