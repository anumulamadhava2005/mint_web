export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:px-8 py-8 text-sm text-muted-foreground md:flex-row">
        <p>© 2025 FigmaFlow. All rights reserved.</p>
        <nav className="flex items-center gap-6">
          <a href="#" className="hover:text-foreground transition-colors">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-foreground transition-colors">
            Terms of Service
          </a>
          <a href="#" className="hover:text-foreground transition-colors">
            Documentation
          </a>
        </nav>
      </div>
    </footer>
  )
}
