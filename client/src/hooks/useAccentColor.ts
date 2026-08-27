import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Reads the admin's saved accent color from settings and applies it
 * to the CSS custom property --primary (and derived hues) globally.
 * Only queries settings when the current user is an admin — regular
 * users would receive a FORBIDDEN error from the adminProcedure.
 */
export function useAccentColor() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: settings } = trpc.settings.getForApi.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
  });

  useEffect(() => {
    const color = settings?.accentColor;
    if (!color) return;

    // Convert hex to OKLCH approximation via a canvas trick
    // We set the CSS variable directly so Tailwind's `primary` color updates
    const root = document.documentElement;

    // Parse hex to RGB
    const r = parseInt(color.slice(1, 3), 16) / 255;
    const g = parseInt(color.slice(3, 5), 16) / 255;
    const b = parseInt(color.slice(5, 7), 16) / 255;

    // Approximate OKLCH: L from luminance, C from saturation, H from hue
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    // Lightness (approximate)
    const L = 0.3 + (max + min) * 0.2;

    // Chroma (approximate)
    const C = delta * 0.35;

    // Hue
    let H = 0;
    if (delta !== 0) {
      if (max === r) H = ((g - b) / delta) % 6;
      else if (max === g) H = (b - r) / delta + 2;
      else H = (r - g) / delta + 4;
      H = Math.round(H * 60);
      if (H < 0) H += 360;
    }

    const oklch = `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H})`;
    root.style.setProperty("--primary", oklch);
    root.style.setProperty("--ring", oklch);
  }, [settings?.accentColor]);
}
