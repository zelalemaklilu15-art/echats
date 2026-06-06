import { ImgHTMLAttributes, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ImgProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Eagerly load (above-the-fold). Defaults to lazy. */
  eager?: boolean;
  /** Optional fallback when src fails or is empty. */
  fallback?: string;
}

/**
 * Lightweight lazy image with intersection-observer gating, async decoding,
 * and a graceful fade-in. Drop-in replacement for <img> in lists / feeds.
 */
export const Img = ({
  src,
  eager = false,
  fallback,
  className,
  alt = "",
  onError,
  ...rest
}: ImgProps) => {
  const ref = useRef<HTMLImageElement>(null);
  const [visible, setVisible] = useState(eager);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (eager || visible) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eager, visible]);

  const finalSrc = errored && fallback ? fallback : src;

  return (
    <img
      ref={ref}
      src={visible ? (finalSrc as string) : undefined}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={(e) => {
        setErrored(true);
        onError?.(e);
      }}
      className={cn(
        "transition-opacity duration-300",
        loaded ? "opacity-100" : "opacity-0",
        className
      )}
      {...rest}
    />
  );
};

export default Img;
