import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"
import { resolveProfileAvatar, PROFILE_ACCESS_EVENT, avatarObjectPath } from '@/lib/profileAccess'

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, src, ...props }, ref) => {
  const [resolved, setResolved] = React.useState<string | undefined>(undefined)
  React.useEffect(() => {
    let cancelled = false
    const refresh = () => {
      setResolved(undefined)
      resolveProfileAvatar(src).then(url => { if (!cancelled) setResolved(url ?? undefined) })
    }
    refresh()
    const invalidate = () => { if (!cancelled) refresh() }
    window.addEventListener(PROFILE_ACCESS_EVENT, invalidate)
    return () => { cancelled = true; window.removeEventListener(PROFILE_ACCESS_EVENT, invalidate) }
  }, [src])
  return <AvatarPrimitive.Image ref={ref} className={cn("aspect-square h-full w-full", className)} {...props} src={src && avatarObjectPath(src) ? resolved : src} />
})
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
