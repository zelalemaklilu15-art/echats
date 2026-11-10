/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import { Button, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, Greeting, Brand, Highlight, paragraph, gradientButton, codeBox } from './layout.tsx'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <EmailShell preview={`Confirm your email change for ${siteName}`} icon="envelope" title="Confirm your email change"
    note="If you didn't request this change, please secure your account immediately.">
    <Greeting />
    <Text style={paragraph}>You requested to change your <Brand /> email from <Highlight>{oldEmail}</Highlight> to <Highlight>{newEmail}</Highlight>.</Text>
    <Text style={paragraph}>Click the button below to confirm this change:</Text>
    <Button className="dm-btn" style={gradientButton} href={confirmationUrl}>Confirm email change</Button>
  </EmailShell>
)

export default EmailChangeEmail
