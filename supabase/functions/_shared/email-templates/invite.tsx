/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import { Button, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, Greeting, Brand, Highlight, paragraph, gradientButton, codeBox } from './layout.tsx'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <EmailShell preview={`You've been invited to ${siteName}`} icon="gift" title="You've been invited"
    note="If you weren't expecting this invitation, you can safely ignore this email.">
    <Greeting />
    <Text style={paragraph}>You've been invited to join <Brand />. Click the button below to accept the invitation and create your account.</Text>
    <Button className="dm-btn" style={gradientButton} href={confirmationUrl}>Create account</Button>
  </EmailShell>
)

export default InviteEmail
