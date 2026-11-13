/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { emailBrand } from '../email-templates/brand.ts'
import { EmailShell, paragraph } from '../email-templates/layout.tsx'

interface Props { subject?: string; message?: string; brandLabel?: string; replyAddress?: string }
const card = { backgroundColor: '#ffffff', border: '1px solid #E4E1EC', borderRadius: '16px', padding: '14px 18px', margin: '0 0 16px' }
const body = { fontSize: '14px', color: emailBrand.foreground, margin: 0, whiteSpace: 'pre-wrap' as const }

const Msg = ({ subject, message, brandLabel, replyAddress }: Props) => (
  <EmailShell preview={subject ?? 'Message from Echat'} icon="envelope" title={subject || 'Message from Echat'} brandLabel={brandLabel || 'Echat'}
    note={replyAddress ? `Reply to this email to reach ${replyAddress}.` : undefined}>
    <Section style={card}><Text style={body}>{message}</Text></Section>
    <Text style={paragraph}>— {brandLabel || 'Echat'}</Text>
  </EmailShell>)

export const adminMessage = { component: Msg, subject: (d: Record<string, any>) => d.subject || 'Message from Echat', displayName: 'Admin message', previewData: { subject: 'Hello', message: 'Thanks for using Echat.', brandLabel: 'Echat Support', replyAddress: 'support@echats.site' } } satisfies TemplateEntry
