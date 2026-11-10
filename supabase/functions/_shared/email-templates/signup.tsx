/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import { Button, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, Greeting, Brand, Highlight, paragraph, gradientButton, codeBox } from './layout.tsx'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <EmailShell preview={`Confirm your email for ${siteName}`} icon="envelope" title="Confirm your email"
    note="If you didn't create an account, you can safely ignore this email.">
    <Greeting />
    <Text style={paragraph}>Thanks for signing up for <Brand />!</Text>
    <Text style={paragraph}>Please confirm your email address <Highlight>({recipient})</Highlight> by clicking the button below:</Text>
    <Button className="dm-btn" style={gradientButton} href={confirmationUrl}>Confirm email</Button>
  </EmailShell>
)

export default SignupEmail
