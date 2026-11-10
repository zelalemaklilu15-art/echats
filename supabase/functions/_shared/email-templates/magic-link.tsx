/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import { Button, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, Greeting, Brand, Highlight, paragraph, gradientButton, codeBox } from './layout.tsx'

interface MagicLinkEmailProps {
  siteName: string
  token: string
}

export const MagicLinkEmail = ({ siteName, token }: MagicLinkEmailProps) => (
  <EmailShell preview={`Your ${siteName} verification code`} icon="lock" title="Your verification code"
    note="If you didn't request this code, you can safely ignore this email. Never share it with anyone.">
    <Greeting />
    <Text style={paragraph}>Enter this code in the "Email code" box in <Brand />. It expires shortly.</Text>
    <Text style={codeBox}>{token}</Text>
  </EmailShell>
)

export default MagicLinkEmail
