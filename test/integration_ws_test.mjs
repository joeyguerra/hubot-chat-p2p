import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WebSocket } from 'ws'
import { DatabaseSync } from 'node:sqlite'
import { initDb } from '../src/server/db/initDb.mjs'
import { ChatServer } from '../src/server/ChatServer.mjs'

const waitFor = (ws, type) => new Promise((resolve) => {
  const handler = (data) => {
    const msg = JSON.parse(data.toString())
    if (msg.t === type) {
      ws.off('message', handler)
      resolve(msg)
    }
  }
  ws.on('message', handler)
})

const send = (ws, t, body) => {
  ws.send(JSON.stringify({ v: 1, t, id: `${t}-${Date.now()}`, ts: Date.now(), body }))
}

test('ws flow: invite redeem, channel, message, search', async () => {
  const db = new DatabaseSync(':memory:')
  initDb(db)

  const adminId = 'u_admin'
  db.prepare(
    `
      INSERT INTO users (user_id, handle, display_name, roles_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `
  ).run(adminId, 'admin', 'Admin', JSON.stringify(['admin']), Date.now())

  // Create default hub
  const hubId = 'h_lobby'
  db.prepare(
    `
      INSERT INTO hubs (hub_id, name, description, visibility, created_by_user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
  ).run(hubId, 'Lobby', 'Main hub', 'public', adminId, Date.now())

  const server = new ChatServer({ db, logger: { info: () => {}, warn: () => {}, error: () => {} } })
  const port = await server.listenAsync(0)

  const ws = new WebSocket(`ws://localhost:${port}/ws`)

  await new Promise((resolve) => ws.on('open', resolve))
  send(ws, 'hello', { client: { name: 'test', ver: '0.1.0', platform: 'node' }, resume: {} })
  await waitFor(ws, 'hello_ack')

  const invite = server.authService.createInvite({ createdByUserId: adminId })
  send(ws, 'auth.invite_redeem', { invite_token: invite.inviteToken, profile: { handle: 'joey', display_name: 'Joey' }, password: 'test-password' })
  await waitFor(ws, 'auth.session')

  send(ws, 'channel.create', { hub_id: hubId, kind: 'text', name: 'general', visibility: 'public' })
  const channelCreated = await waitFor(ws, 'channel.created')
  const channelId = channelCreated.body.channel.channel_id

  send(ws, 'channel.join', { channel_id: channelId })
  await waitFor(ws, 'channel.member_event')

  send(ws, 'msg.send', { channel_id: channelId, client_msg_id: 'local-1', text: 'hello' })
  await waitFor(ws, 'msg.ack')

  send(ws, 'search.query', { scope: { kind: 'channel', channel_id: channelId }, q: 'hello', limit: 10 })
  const search = await waitFor(ws, 'search.result')

  assert.ok(search.body.hits.length >= 1)

  ws.close()
  server.close()
})
