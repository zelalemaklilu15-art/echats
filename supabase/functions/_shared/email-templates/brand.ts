// Vibrant Gradient email style (magenta → orange → gold), shared by auth and app emails.
const gradient = 'linear-gradient(120deg, #8E24AA 0%, #E91E63 40%, #FF7A18 75%, #FFC83D 100%)'
export const emailBrand = {
  primary: '#C2185B',
  primaryForeground: '#ffffff',
  gradient,
  surface: '#F4F3F7',
  card: '#ffffff',
  border: '#E4E1EC',
  foreground: '#14121A',
  mutedForeground: '#4A4756',
  success: '#0F8A5F',
  radius: '22px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
}

export const main = { backgroundColor: '#15111C', fontFamily: emailBrand.fontFamily, padding: '32px 12px' }
export const container = {
  backgroundColor: emailBrand.surface,
  maxWidth: '460px',
  margin: '0 auto',
  padding: '0 28px 32px',
  borderRadius: emailBrand.radius,
  overflow: 'hidden' as const,
  boxShadow: '0 0 60px rgba(233,30,99,0.35)',
}
export const wordmark = {
  backgroundColor: '#E91E63',
  backgroundImage: gradient,
  color: '#ffffff',
  fontSize: '26px',
  fontWeight: 800 as const,
  letterSpacing: '-0.3px',
  textAlign: 'center' as const,
  margin: '0 -28px 28px',
  padding: '26px 0 30px',
}
export const h1 = {
  fontSize: '28px',
  fontWeight: 800 as const,
  letterSpacing: '-0.5px',
  color: emailBrand.primary,
  margin: '0 0 18px',
}
export const text = {
  fontSize: '16px',
  color: emailBrand.foreground,
  lineHeight: '1.6',
  margin: '0 0 22px',
}
export const link = {
  color: emailBrand.primary,
  backgroundColor: '#F8E1EE',
  padding: '1px 6px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontWeight: 600 as const,
}
export const button = {
  backgroundColor: emailBrand.primary,
  backgroundImage: gradient,
  color: emailBrand.primaryForeground,
  fontSize: '16px',
  fontWeight: 700 as const,
  borderRadius: '999px',
  padding: '16px 34px',
  textDecoration: 'none',
  display: 'inline-block',
  boxShadow: '0 8px 22px rgba(233,30,99,0.35)',
}
export const footer = {
  fontSize: '13px',
  color: emailBrand.mutedForeground,
  lineHeight: '1.6',
  margin: '30px 0 0',
  paddingTop: '20px',
  borderTop: `1px solid ${emailBrand.border}`,
}
export const codeStyle = {
  fontFamily: '"SF Mono", Menlo, Consolas, monospace',
  fontSize: '32px',
  fontWeight: 800 as const,
  letterSpacing: '8px',
  color: emailBrand.primary,
  backgroundColor: '#ffffff',
  border: '2px solid #F3C6DC',
  borderRadius: '16px',
  padding: '18px 0',
  textAlign: 'center' as const,
  margin: '0 0 28px',
}
// Keep header and button legible in email clients that force dark mode.
export const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: ${emailBrand.primary} !important; color: #ffffff !important; }
  }
  [data-ogsc] .dm-btn { background-color: ${emailBrand.primary} !important; color: #ffffff !important; }
  [data-ogsb] .dm-btn { background-color: ${emailBrand.primary} !important; color: #ffffff !important; }
`
