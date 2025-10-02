import Link from "next/link"
// Fallback Button if ui/button does not exist
function Button({ children, className = "", variant, asChild, ...props }: any) {
  const base = "px-4 py-2 text-sm rounded-md transition";
  let variantClass = "bg-primary text-primary-foreground hover:opacity-90";
  if (variant === "ghost") variantClass = "text-muted-foreground hover:text-foreground";
  if (asChild) return children;
  return <button className={`${base} ${variantClass} ${className}`} {...props}>{children}</button>;
}

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/70 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 md:px-8 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span
            aria-hidden
            className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground"
          >
            {/* simple brand mark */}
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12h16M12 4v16" strokeLinecap="round" />
            </svg>
          </span>
          <span className="font-medium tracking-tight">FigmaFlow</span>
          <span className="sr-only">FigmaFlow Home</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/api/auth/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/api/auth/login">Get started</Link>
          </Button>
        </div>
      </nav>
    </header>
  )
}
