/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Html, Img, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { emailBrand, darkModeCss } from './brand.ts'

const CDN = 'https://echats.site/__l5e/assets-v1'
export const emailImages = {
  logo: `${CDN}/bf41811a-3bad-4539-b4dd-8f61e798eee9/email-logo.png`,
  envelope: `${CDN}/dbe31c1f-ef6f-4b6e-a4b7-6b1e89b0e48b/email-envelope.png`,
  lock: `${CDN}/c983a422-aaa2-4137-8c8d-a1d44503c2c1/email-lock.png`,
  wallet: `${CDN}/b891cd0d-3894-4ba9-bb16-4ee2d0b6c8cf/email-wallet.png`,
  gift: `${CDN}/170b9dbc-4e69-45d8-9785-12f22821021e/email-gift.png`,
}
// Replace with the official social pages once available.
const socials = [
  { name: 'Facebook', href: 'https://echats.site', src: `${CDN}/a3feecb1-0759-48c8-afd2-d3488ebf4292/email-facebook.png` },
  { name: 'Instagram', href: 'https://echats.site', src: `${CDN}/5f0961cc-e0b3-4de4-b13d-555447828d1a/email-instagram.png` },
  { name: 'X', href: 'https://echats.site', src: `${CDN}/8dbc1948-4378-45c4-86c0-ab7aa4a06f8b/email-x.png` },
  { name: 'Telegram', href: 'https://echats.site', src: `${CDN}/5c2c9d55-a62e-4fb0-9c3f-03d7923552d8/email-telegram.png` },
]

interface ShellProps {
  preview: string
  icon: keyof typeof emailImages
  title: string
  brandLabel?: string
  note?: React.ReactNode
  children: React.ReactNode
}

export const EmailShell = ({ preview, icon, title, brandLabel = 'Echat', note, children }: ShellProps) => (
  <Html lang="en" dir="ltr">
    <Head><style>{darkModeCss}</style></Head>
    <Preview>{preview}</Preview>
    <Body style={body}>
      <Container style={outer}>
        <Section style={header}>
          <table align="center" role="presentation" style={{ margin: '0 auto' }}><tbody><tr>
            <td style={{ verticalAlign: 'middle', paddingRight: '10px' }}>
              <Img src={emailImages.logo} width="34" height="34" alt="" />
            </td>
            <td style={brandText}>{brandLabel}</td>
          </tr></tbody></table>
        </Section>
        <Section style={cardWrap}><tr><td>
        <Section style={card}>
          <Img src={emailImages[icon]} width="140" height="140" alt="" style={{ margin: '0 auto 8px', display: 'block' }} />
          <Text style={heading}>{title}</Text>
          {children}
          {note ? <Text style={noteStyle}>{note}</Text> : null}
        </Section>
        </td></tr></Section>
        <Section style={footerRow}>
          <table width="100%" role="presentation"><tbody><tr>
            <td>
              {socials.map((s) => (
                <Link key={s.name} href={s.href} style={{ marginRight: '12px', display: 'inline-block' }}>
                  <Img src={s.src} width="22" height="22" alt={s.name} style={{ display: 'inline-block' }} />
                </Link>
              ))}
            </td>
            <td style={{ textAlign: 'right' }}>
              <Link href="https://echats.site/privacy" style={privacy}>Privacy policy</Link>
            </td>
          </tr></tbody></table>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const Greeting = () => <Text style={paragraph}>Hi there,</Text>
export const Brand = ({ children = 'Echat' }: { children?: React.ReactNode }) => <span style={brandInline}>{children}</span>
export const Highlight = ({ children }: { children: React.ReactNode }) => <span style={highlight}>{children}</span>

export const paragraph = { fontSize: '17px', color: emailBrand.foreground, lineHeight: '1.6', margin: '0 0 20px' }
export const gradientButton = {
  backgroundColor: emailBrand.primary,
  backgroundImage: emailBrand.gradient,
  color: '#ffffff',
  fontSize: '17px',
  fontWeight: 700 as const,
  borderRadius: '999px',
  padding: '16px 36px',
  textDecoration: 'none',
  display: 'inline-block',
  boxShadow: '0 6px 0 #9C1468, 0 12px 26px rgba(233,30,99,0.4)',
  margin: '4px 0 8px',
}
export const codeBox = {
  fontFamily: '"SF Mono", Menlo, Consolas, monospace',
  fontSize: '34px',
  fontWeight: 800 as const,
  letterSpacing: '10px',
  color: emailBrand.primary,
  backgroundColor: '#ffffff',
  border: '2px solid #F3C6DC',
  borderRadius: '16px',
  padding: '18px 0',
  textAlign: 'center' as const,
  margin: '0 0 20px',
}

const body = { backgroundColor: '#15111C', fontFamily: emailBrand.fontFamily, padding: '40px 12px', margin: 0 }
const outer = {
  maxWidth: '460px',
  margin: '0 auto',
  backgroundColor: '#F7F6FA',
  borderRadius: '24px',
  overflow: 'hidden' as const,
  boxShadow: '0 0 70px rgba(233,30,99,0.45), 0 0 140px rgba(255,140,40,0.2)',
}
const header = {
  backgroundColor: '#E91E63',
  backgroundImage: 'linear-gradient(115deg, #8E24AA 0%, #E91E63 38%, #FF7A18 72%, #FFD23F 100%)',
  padding: '26px 0 64px',
  textAlign: 'center' as const,
}
const brandText = { color: '#ffffff', fontSize: '30px', fontWeight: 700 as const, letterSpacing: '-0.3px', verticalAlign: 'middle' }
const card = {
  backgroundColor: '#F1F0F5',
  backgroundImage: 'linear-gradient(160deg, #FFFFFF 0%, #EEEDF3 100%)',
  padding: '28px 26px 26px',
  borderRadius: '22px',
  border: '1px solid #FFFFFF',
  boxShadow: '0 10px 30px rgba(20,18,26,0.12)',
}
const cardWrap = { marginTop: '-44px', padding: '0 18px' }
const heading = {
  fontSize: '32px',
  fontWeight: 800 as const,
  letterSpacing: '-0.5px',
  lineHeight: '1.2',
  margin: '0 0 18px',
  color: '#B0237F',
  backgroundImage: 'linear-gradient(90deg, #A01E8C 0%, #E91E63 50%, #F7A23B 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}
const noteStyle = {
  fontSize: '15px',
  color: '#2A2733',
  lineHeight: '1.6',
  margin: '24px 0 0',
  paddingTop: '20px',
  borderTop: '1px solid #DAD7E2',
}
const brandInline = {
  color: '#C2185B',
  fontWeight: 700 as const,
  backgroundImage: 'linear-gradient(90deg, #C2185B, #F7A23B)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}
const highlight = {
  color: '#A01E8C',
  fontWeight: 600 as const,
  backgroundColor: '#F6DDEB',
  borderRadius: '8px',
  padding: '2px 6px',
}
const footerRow = { padding: '20px 30px 22px' }
const privacy = { color: '#B0237F', fontSize: '15px', textDecoration: 'none' }
