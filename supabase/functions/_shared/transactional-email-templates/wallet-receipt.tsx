/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { emailBrand, main, container, h1, text, button, wordmark } from '../email-templates/brand.ts'

interface Props {
  action?: string
  amount?: string
  counterparty?: string
  fee?: string
  balance?: string
  date?: string
  reference?: string
  receiptUrl?: string
}

const Row = ({ label, value }: { label: string; value?: string }) => value ? (
  <table width="100%" style={{ borderCollapse: 'collapse' }}><tbody><tr>
    <td style={rowLabel}>{label}</td><td style={rowValue}>{value}</td>
  </tr></tbody></table>
) : null

const WalletReceipt = ({ action = 'Wallet activity', amount = '', counterparty, fee, balance, date, reference, receiptUrl = 'https://echats.site/wallet' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${action}: ${amount}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={wordmark}>💬 Echat Wallet</Text>
        <Text style={badge}>✓ {action}</Text>
        <Heading style={{ ...h1, fontSize: '40px', letterSpacing: '-1px', margin: '0 0 28px' }}>{amount}</Heading>
        <Section style={card}>
          <Row label={counterparty?.startsWith('to ') ? 'Recipient' : 'Details'} value={counterparty?.replace(/^(to|from) /, '')} />
          <Row label="Fee" value={fee} />
          <Row label="Balance after" value={balance} />
          <Row label="Date" value={date} />
          <Row label="Transaction ID" value={reference} />
        </Section>
        <Button href={receiptUrl} style={{ ...button, marginTop: '28px' }}>View receipt</Button>
        <Hr style={{ borderColor: emailBrand.border, margin: '32px 0 16px' }} />
        <Text style={{ ...text, fontSize: '12px', margin: 0 }}>
          If you did not make this transaction, change your wallet PIN and contact support@echats.site.
        </Text>
      </Container>
    </Body>
  </Html>
)

const card = { backgroundColor: emailBrand.card, border: `1px solid ${emailBrand.border}`, borderRadius: '16px', padding: '8px 18px' }
const badge = { display: 'inline-block', fontSize: '13px', fontWeight: 600 as const, color: emailBrand.success, backgroundColor: '#E6F6EF', borderRadius: '999px', padding: '5px 12px', margin: '0 0 12px' }
const rowLabel = { fontSize: '14px', color: emailBrand.mutedForeground, padding: '10px 0' }
const rowValue = { fontSize: '14px', color: emailBrand.foreground, padding: '10px 0', textAlign: 'right' as const, fontWeight: 'bold' as const }

export const template = {
  component: WalletReceipt,
  subject: (d: Record<string, any>) => {
    const amt = d.amount ?? ''
    const cp = typeof d.counterparty === 'string' ? d.counterparty : ''
    if (d.action === 'Money sent') return cp.startsWith('to ') ? `You sent ${amt} ${cp}` : `You sent ${amt}`
    if (d.action === 'Money received') return cp.startsWith('from ') ? `You received ${amt} ${cp}` : `You received ${amt}`
    return `Echat Wallet receipt · ${d.action ?? 'Activity'} ${amt}`.trim()
  },
  displayName: 'Wallet receipt',
  previewData: {
    action: 'Money sent', amount: 'ETB 250.00', counterparty: 'to Abebe K.', fee: 'ETB 0.00',
    balance: 'ETB 1,240.50', date: '2026-11-08 13:40 UTC', reference: 'TXN8F3A21C9D0', receiptUrl: 'https://echats.site/wallet',
  },
} satisfies TemplateEntry
