/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { main, container, h1, text, footer, wordmark, codeStyle, darkModeCss } from './brand.ts'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  token: string
}

export const MagicLinkEmail = ({ siteName, token }: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Your {siteName} verification code: {token}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={wordmark}>💬 Echat</Text>
        <Heading style={h1}>Your verification code</Heading>
        <Text style={text}>
          Enter this code in the "Email code" box in {siteName}. It expires shortly.
        </Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          If you didn't request this code, you can safely ignore this email. Never share it with anyone.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
