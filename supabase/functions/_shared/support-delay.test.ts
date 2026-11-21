import { expect, test } from 'bun:test'
import { randomReplyDelaySeconds } from './support-delay.ts'
test('reply delay is never shorter than 8 minutes', () => { expect(randomReplyDelaySeconds(() => 0)).toBe(480) })
test('reply delay is never longer than 22 minutes', () => { expect(randomReplyDelaySeconds(() => 0.999999)).toBe(1320) })
