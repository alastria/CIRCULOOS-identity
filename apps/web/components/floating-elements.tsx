"use client"

export function FloatingElements() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      {/* Aurora gradient background */}
      <div className="absolute inset-0 aurora-bg opacity-50" />

      {/* Floating orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-alastria-blue/5 dark:bg-alastria-blue/10 blur-3xl animate-float" />
      <div className="absolute top-1/2 right-1/4 w-96 h-96 rounded-full bg-alastria-red/5 dark:bg-alastria-red/10 blur-3xl animate-float-slow stagger-2" />
      <div className="absolute bottom-1/4 left-1/3 w-72 h-72 rounded-full bg-primary/5 dark:bg-primary/10 blur-3xl animate-float stagger-3" />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Floating geometric shapes */}
      <div className="absolute top-20 right-20 w-4 h-4 rotate-45 border border-alastria-blue/20 dark:border-alastria-blue/30 animate-float stagger-1" />
      <div className="absolute top-40 left-32 w-6 h-6 rounded-full border border-alastria-red/20 dark:border-alastria-red/30 animate-float-slow stagger-2" />
      <div className="absolute bottom-32 right-40 w-3 h-3 bg-alastria-blue/10 dark:bg-alastria-blue/20 rotate-45 animate-float stagger-3" />
      <div className="absolute bottom-48 left-20 w-5 h-5 rounded-full bg-alastria-red/10 dark:bg-alastria-red/20 animate-float-slow stagger-4" />
    </div>
  )
}
