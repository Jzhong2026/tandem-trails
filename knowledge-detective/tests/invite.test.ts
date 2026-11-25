import assert from 'node:assert/strict';
import test from 'node:test';
import { inviteLink } from '../src/lib/invite.js';

test('LAN invitations use the configured frontend address or the current reachable origin', () => {
  const lan = 'http://192.168.1.20:5173';
  const link = lan + '/?room=ABC234';
  assert.equal(inviteLink('ABC234', 'http://localhost:5173', lan), link);
  assert.equal(inviteLink('ABC234', lan), link);
  assert.equal(inviteLink('ABC234', lan, 'invalid'), link);
  for (const host of ['localhost', '127.0.0.1', '127.0.1.1', '[::1]', '0.0.0.0']) {
    assert.equal(inviteLink('ABC234', 'http://' + host + ':5173'), null);
  }
});
