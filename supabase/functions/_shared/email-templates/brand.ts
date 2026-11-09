// Clean Light email style (Wise / Apple inspired), shared by auth and app emails.
export const emailBrand = {
  primary: '#5B3FD9',
  primaryForeground: '#ffffff',
  surface: '#ffffff',
  card: '#F6F5FA',
  border: '#E7E5EE',
  foreground: '#14121A',
  mutedForeground: '#6B6878',
  success: '#0F8A5F',
  radius: '14px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Plus Jakarta Sans", Helvetica, Arial, sans-serif',
}

export const main = { backgroundColor: '#ffffff', fontFamily: emailBrand.fontFamily, padding: '24px 0' }
export const container = {
  backgroundColor: emailBrand.surface,
  maxWidth: '480px',
  margin: '0 auto',
  padding: '36px 32px',
  borderRadius: emailBrand.radius,
  border: `1px solid ${emailBrand.border}`,
}
export const h1 = {
  fontSize: '24px',
  fontWeight: 700 as const,
  letterSpacing: '-0.4px',
  color: emailBrand.foreground,
  margin: '0 0 16px',
}
export const text = {
  fontSize: '15px',
  color: emailBrand.mutedForeground,
  lineHeight: '1.6',
  margin: '0 0 24px',
}
export const link = { color: emailBrand.primary, textDecoration: 'none', fontWeight: 600 as const }
export const button = {
  backgroundColor: emailBrand.primary,
  color: emailBrand.primaryForeground,
  fontSize: '15px',
  fontWeight: 600 as const,
  borderRadius: '999px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
export const footer = {
  fontSize: '12px',
  color: emailBrand.mutedForeground,
  lineHeight: '1.6',
  margin: '32px 0 0',
  paddingTop: '20px',
  borderTop: `1px solid ${emailBrand.border}`,
}
export const codeStyle = {
  fontFamily: '"SF Mono", Menlo, Consolas, monospace',
  fontSize: '32px',
  fontWeight: 700 as const,
  letterSpacing: '8px',
  color: emailBrand.foreground,
  backgroundColor: emailBrand.card,
  borderRadius: '12px',
  padding: '18px 0',
  textAlign: 'center' as const,
  margin: '0 0 28px',
}
export const wordmark = {
  fontSize: '20px',
  fontWeight: 800 as const,
  letterSpacing: '-0.5px',
  color: emailBrand.primary,
  margin: '0 0 32px',
}
// Keep button contrast stable in email clients that force dark mode.
export const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: ${emailBrand.primary} !important; color: ${emailBrand.primaryForeground} !important; }
  }
  [data-ogsc] .dm-btn { background-color: ${emailBrand.primary} !important; color: ${emailBrand.primaryForeground} !important; }
  [data-ogsb] .dm-btn { background-color: ${emailBrand.primary} !important; color: ${emailBrand.primaryForeground} !important; }
`
