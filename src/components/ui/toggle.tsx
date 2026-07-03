"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

export const toggleVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-9 px-2 min-w-9",
        sm: "h-8 px-1.5 min-w-8",
        lg: "h-10 px-2.5 min-w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Toggle = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> &
    VariantProps<typeof toggleVariants> & {
      pressed?: boolean
      onPressedChange?: (pressed: boolean) => void
    }
>(({ className, variant, size, pressed, onPressedChange, ...props }, ref) => {
  const [isPressed, setIsPressed] = React.useState(pressed ?? false)

  React.useEffect(() => {
    if (pressed !== undefined) {
      setIsPressed(pressed)
    }
  }, [pressed])

  const handleClick = () => {
    const newPressed = !isPressed
    if (pressed === undefined) {
      setIsPressed(newPressed)
    }
    onPressedChange?.(newPressed)
  }

  return (
    <button
      ref={ref}
      role="button"
      aria-pressed={isPressed}
      data-state={isPressed ? "on" : "off"}
      className={cn(toggleVariants({ variant, size }), className)}
      onClick={handleClick}
      {...props}
    />
  )
})
Toggle.displayName = "Toggle"

export { Toggle }
