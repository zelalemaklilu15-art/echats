/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { emailBrand } from '../email-templates/brand.ts'
import { EmailShell, paragraph, gradientButton } from '../email-templates/layout.tsx'

interface Props { name?: string; subject?: string; message?: string; reply?: string; ticketRef?: string; category?: string; email?: string }

const card = { backgroundColor: '#ffffff', border: '1px solid #E4E1EC', borderRadius: '16px', padding: '14px 18px', margin: '0 0 16px' }
const label = { fontSize: '12px', color: emailBrand.mutedForeground, margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const body = { fontSize: '14px', color: emailBrand.foreground, margin: 0, whiteSpace: 'pre-wrap' as const }
const Block = ({ title, text }: { title: string; text?: string }) => text ? (
  <Section style={card}><Text style={label}>{title}</Text><Text style={body}>{text}</Text></Section>) : null
const SUPPORT_URL = 'https://echats.site/support'

const Received = ({ name, subject, message, ticketRef }: Props) => (
  <EmailShell preview="We received your support request" icon="envelope" title="We got your message" brandLabel="Echat Support"
    note="You can reply to this email or follow your request in the app under Help & Support.">
    <Text style={paragraph}>{name ? `Hi ${name},` : 'Hi,'} thanks for contacting Echat Support. Your request {ticketRef ? `#${ticketRef} ` : ''}has been received and our team will reply soon.</Text>
    <Block title="Subject" text={subject} />
    <Block title="Your message" text={message} />
    <Button className="dm-btn" href={SUPPORT_URL} style={gradientButton}>View my requests</Button>
  </EmailShell>)

const Alert = ({ name, email, subject, message, category, ticketRef }: Props) => (
  <EmailShell preview={`New support request: ${subject ?? ''}`} icon="envelope" title="New support request" brandLabel="Echat Admin">
    <Text style={paragraph}>From {name || 'a user'}{email ? ` (${email})` : ''}{category ? ` · ${category}` : ''}{ticketRef ? ` · #${ticketRef}` : ''}</Text>
    <Block title="Subject" text={subject} />
    <Block title="Message" text={message} />
    <Button className="dm-btn" href="https://echats.site/zola0890/admin" style={gradientButton}>Open admin panel</Button>
  </EmailShell>)

const Reply = ({ name, subject, message, reply, ticketRef }: Props) => (
  <EmailShell preview="Echat Support replied to your request" icon="envelope" title="Support replied" brandLabel="Echat Support"
    note="Need more help? Send a new request in the app under Help & Support.">
    <Text style={paragraph}>{name ? `Hi ${name},` : 'Hi,'} our team replied to your request {ticketRef ? `#${ticketRef}` : ''}.</Text>
    <Block title="Echat Support" text={reply} />
    <Block title={`Your request${subject ? `: ${subject}` : ''}`} text={message} />
    <Button className="dm-btn" href={SUPPORT_URL} style={gradientButton}>Open in Echat</Button>
  </EmailShell>)

const preview = { name: 'Abebe', email: 'abebe@example.com', subject: 'Cannot log in', category: 'account', message: 'I forgot my password.', reply: 'Use "Forgot password" on the sign-in screen.', ticketRef: 'A1B2C3' }

export const supportReceived = { component: Received, subject: (d: Record<string, any>) => `We received your request${d.ticketRef ? ` #${d.ticketRef}` : ''}`, displayName: 'Support request received', previewData: preview } satisfies TemplateEntry
export const supportAlert = { component: Alert, to: 'support@echats.site', subject: (d: Record<string, any>) => `New support request: ${d.subject ?? ''}`, displayName: 'Support admin alert', previewData: preview } satisfies TemplateEntry
export const supportReply = { component: Reply, subject: (d: Record<string, any>) => `Echat Support replied${d.ticketRef ? ` · #${d.ticketRef}` : ''}`, displayName: 'Support reply', previewData: preview } satisfies TemplateEntry
