// Email-safe equivalents of the application's Cosmic Obsidian design tokens.
export const emailBrand = {
  primary: 'hsl(259, 100%, 87%)',
  primaryForeground: 'hsl(263, 100%, 18%)',
  surface: 'hsl(267, 28%, 9%)',
  foreground: 'hsl(269, 28%, 91%)',
  mutedForeground: 'hsl(269, 12%, 70%)',
  radius: '8px',
  fontFamily: '"Plus Jakarta Sans", Arial, sans-serif',
}

export const main = { backgroundColor: '#ffffff', fontFamily: emailBrand.fontFamily }
export const container = {
  backgroundColor: emailBrand.surface,
  maxWidth: '480px',
  margin: '32px auto',
  padding: '32px 25px',
  borderRadius: emailBrand.radius,
}
export const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: emailBrand.foreground,
  margin: '0 0 20px',
}
export const text = {
  fontSize: '14px',
  color: emailBrand.mutedForeground,
  lineHeight: '1.5',
  margin: '0 0 25px',
}
export const link = { color: emailBrand.primary, textDecoration: 'underline' }
export const button = {
  backgroundColor: emailBrand.primary,
  color: emailBrand.primaryForeground,
  fontSize: '14px',
  fontWeight: 'bold' as const,
  border: `1px solid ${emailBrand.primary}`,
  borderRadius: emailBrand.radius,
  padding: '12px 20px',
  textDecoration: 'none',
}
export const footer = { fontSize: '12px', color: emailBrand.mutedForeground, margin: '30px 0 0' }
export const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: emailBrand.primary,
  margin: '0 0 30px',
}
export const wordmark = {
  fontSize: '16px',
  fontWeight: 'bold' as const,
  color: emailBrand.primary,
  margin: '0 0 28px',
}
// Keep brand contrast stable in email clients that support dark-mode overrides.
export const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: ${emailBrand.primary} !important; color: ${emailBrand.primaryForeground} !important; }
  }
  [data-ogsc] .dm-btn { background-color: ${emailBrand.primary} !important; color: ${emailBrand.primaryForeground} !important; }
  [data-ogsb] .dm-btn { background-color: ${emailBrand.primary} !important; color: ${emailBrand.primaryForeground} !important; }
`