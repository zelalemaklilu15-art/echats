/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import { Button, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, Greeting, Brand, Highlight, paragraph, gradientButton, codeBox } from './layout.tsx'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <EmailShell preview="Your verification code" icon="lock" title="Your verification code"
    note="This code will expire shortly. If you didn't request this, you can safely ignore this email.">
    <Greeting />
    <Text style={paragraph}>Use the code below to confirm your identity in <Brand />:</Text>
    <Text style={codeBox}>{token}</Text>
  </EmailShell>
)

export default ReauthenticationEmail
