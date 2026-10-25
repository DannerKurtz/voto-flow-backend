import { describe, expect, it } from 'vitest';

import { parseSubscriptionMessage } from '../src/routes/websocket.js';

describe('parseSubscriptionMessage', () => {
  it('accepts the second-round comparison subscription by scope', () => {
    expect(parseSubscriptionMessage(JSON.stringify({ type: 'subscribe.second-round-comparison', scopeCode: 'sp' }))).toEqual({
      success: true,
      data: { type: 'subscribe.second-round-comparison', scopeCode: 'sp' },
    });
  });

  it('keeps accepting the existing raw-result subscription format', () => {
    expect(parseSubscriptionMessage(JSON.stringify({
      type: 'subscribe', electionCode: '6258', scopeCode: 'sp', officeCode: '0001',
    }))).toEqual({
      success: true,
      data: { type: 'subscribe', electionCode: '6258', scopeCode: 'sp', officeCode: '0001' },
    });
  });
});
