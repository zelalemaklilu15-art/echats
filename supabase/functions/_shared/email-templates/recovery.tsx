/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import { Button, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, Greeting, Brand, Highlight, paragraph, gradientButton, codeBox } from './layout.tsx'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <EmailShell preview={`Reset your password for ${siteName}`} icon="lock" title="Reset your password"
    note="If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.">
    <Greeting />
    <Text style={paragraph}>We received a request to reset your password for <Brand />. Click the button below to choose a new password.</Text>
    <Button className="dm-btn" style={gradientButton} href={confirmationUrl}>Reset password</Button>
  </EmailShell>
)

export default RecoveryEmail
