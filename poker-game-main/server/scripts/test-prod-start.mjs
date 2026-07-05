/**
 * Smoke test: production server should NOT auto-start when room fills.
 * Host must emit requestStartGame.
 */
import { io } from 'socket.io-client'

const URL = process.argv[2] || 'https://poker-server-5lyl.onrender.com'
const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))

async function main() {
  const host = io(URL, { transports: ['websocket', 'polling'], timeout: 15000 })
  const guest = io(URL, { transports: ['websocket', 'polling'], timeout: 15000 })

  await Promise.all([
    new Promise((res, rej) => { host.on('connect', res); host.on('connect_error', rej) }),
    new Promise((res, rej) => { guest.on('connect', res); guest.on('connect_error', rej) }),
  ])

  let roomId = null
  host.on('roomCreated', ({ room }) => { roomId = room.id })

  host.emit('createRoom', {
    playerName: 'HostTest',
    persistentPlayerId: 'test_host_' + Date.now(),
    maxPlayers: 2,
  })

  await timeout(5000).catch(() => {})
  if (!roomId) throw new Error('room not created')

  let autoStarted = false
  host.on('gameStart', () => { autoStarted = true })
  guest.on('gameStart', () => { autoStarted = true })

  guest.emit('joinRoom', {
    roomId,
    playerName: 'GuestTest',
    persistentPlayerId: 'test_guest_' + Date.now(),
  })

  await new Promise(r => setTimeout(r, 3000))

  if (autoStarted) {
    console.log('FAIL: server auto-started on join (old behavior)')
    process.exitCode = 1
  } else {
    console.log('OK: no auto-start after second player joined')
  }

  let manualStarted = false
  host.once('gameStart', () => { manualStarted = true })

  host.emit('requestStartGame', { roomId })
  await new Promise(r => setTimeout(r, 3000))

  if (manualStarted) {
    console.log('OK: requestStartGame triggered gameStart')
  } else {
    console.log('FAIL: requestStartGame did not start game (server may be outdated)')
    process.exitCode = 1
  }

  host.close()
  guest.close()
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exitCode = 1
})
