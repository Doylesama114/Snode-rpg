import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { GameEngine } from './gameEngine.js'
import { createRequire } from 'module'
import { initDB, seedDefaultCards, registerPlayer, createDeck, getDeck, getPlayerByName } from './db.js'
import { getAllCards } from './cardData.js'

const require = createRequire(import.meta.url)
const fs = require('fs')

const app = express()
app.use(cors())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})

// 游戏房间管理
const rooms = new Map()
const gameEngines = new Map() // 房间ID -> GameEngine实例
// 玩家ID到socket ID的映射（用于断线重连）
const playerSockets = new Map()

// 数据库句柄（模块级别，所有socket处理器共享）
let dbHandle = null

io.on('connection', (socket) => {
  console.log('玩家连接:', socket.id)

  // 创建房间
  socket.on('createRoom', ({ playerName, persistentPlayerId, maxPlayers = 2, deckCardIds }) => {
    const roomId = generateRoomId()
    const playerId = persistentPlayerId || generatePlayerId()
    
    const room = {
      id: roomId,
      players: [{
        id: playerId,
        name: playerName,
        socketId: socket.id,
        deckCardIds: deckCardIds || null
      }],
      maxPlayers,
      gameState: null,
      status: 'waiting', // waiting, playing, finished
      createdAt: Date.now()
    }
    
    rooms.set(roomId, room)
    playerSockets.set(playerId, socket.id)
    socket.join(roomId)
    socket.emit('roomCreated', { roomId, room, playerId })
    console.log(`[createRoom] 房间创建: ${roomId}，房主: ${playerName} (${socket.id}), playerId: ${playerId}`)
  })

  // 加入房间
  socket.on('joinRoom', ({ roomId, playerName, persistentPlayerId, deckCardIds }) => {
    console.log(`[joinRoom] 玩家 ${socket.id} (${playerName}, persistentPlayerId: ${persistentPlayerId}) 尝试加入房间 ${roomId}`)
    const room = rooms.get(roomId)
    
    if (!room) {
      console.log(`[joinRoom] 失败: 房间 ${roomId} 不存在`)
      socket.emit('error', { message: '房间不存在' })
      return
    }
    
    // 检查是否是重新连接（使用持久化ID）
    const existingPlayer = room.players.find(p => p.id === persistentPlayerId)
    if (existingPlayer) {
      // 断线重连
      console.log(`[joinRoom] 玩家 ${playerName} (${persistentPlayerId}) 重新连接到房间 ${roomId}`)
      existingPlayer.socketId = socket.id
      existingPlayer.isOnline = true
      playerSockets.set(persistentPlayerId, socket.id)
      socket.join(roomId)
      socket.emit('roomRejoined', { room, playerId: persistentPlayerId })
      io.to(roomId).emit('playerReconnected', { 
        playerId: persistentPlayerId, 
        playerName: playerName 
      })
      return
    }
    
    // 新玩家加入
    if (room.players.length >= room.maxPlayers) {
      console.log(`[joinRoom] 失败: 房间 ${roomId} 已满`)
      socket.emit('error', { message: '房间已满' })
      return
    }
    
    if (room.status === 'playing') {
      console.log(`[joinRoom] 失败: 房间 ${roomId} 游戏已开始，不能加入新玩家`)
      socket.emit('error', { message: '游戏已开始，无法加入' })
      return
    }
    
    const playerId = persistentPlayerId || generatePlayerId()
    
    room.players.push({
      id: playerId,
      name: playerName,
      socketId: socket.id,
      isOnline: true,
      deckCardIds: deckCardIds || null
    })
    
    playerSockets.set(playerId, socket.id)
    socket.join(roomId)
    console.log(`[joinRoom] 成功: 玩家 ${playerName} 加入房间 ${roomId}，当前玩家数: ${room.players.length}`)
    
    // 通知房间内所有玩家
    io.to(roomId).emit('playerJoined', { room })
  })

  // 房主手动开始游戏
  socket.on('requestStartGame', ({ roomId }) => {
    const room = rooms.get(roomId)
    if (!room) {
      socket.emit('error', { message: '房间不存在' })
      return
    }
    const player = room.players.find(p => p.socketId === socket.id)
    if (!player) return
    if (room.players[0].id !== player.id) {
      socket.emit('error', { message: '只有房主可以开始游戏' })
      return
    }
    if (room.status === 'playing') return
    if (room.players.length < 2) {
      socket.emit('error', { message: '至少需要 2 名玩家才能开始' })
      return
    }
    beginRoomGame(room)
  })

  // 重新加入房间（用于页面刷新或导航后恢复）
  socket.on('rejoinRoom', ({ roomId, socketId, persistentPlayerId }) => {
    console.log(`[rejoinRoom] Socket ${socket.id} (persistentPlayerId: ${persistentPlayerId}) 尝试重新加入房间 ${roomId}`)
    const room = rooms.get(roomId)
    
    if (!room) {
      console.log(`[rejoinRoom] 失败: 房间 ${roomId} 不存在`)
      socket.emit('error', { message: '房间不存在' })
      return
    }
    
    // 查找玩家（使用持久化ID）
    const player = room.players.find(p => p.id === persistentPlayerId)
    if (player) {
      // 更新socket ID
      player.socketId = socket.id
      player.isOnline = true
      playerSockets.set(persistentPlayerId, socket.id)
      
      console.log(`[rejoinRoom] 成功: 玩家 ${player.name} 重新连接到房间 ${roomId}`)
      
      // 将新的socket加入房间
      socket.join(roomId)
      
      // 发送当前房间状态
      socket.emit('roomRejoined', { 
        room, 
        playerId: persistentPlayerId
      })
      
      // 如果游戏已开始，发送游戏状态
      const gameEngine = gameEngines.get(roomId)
      if (gameEngine) {
        const playerGameState = gameEngine.getPlayerGameState(persistentPlayerId)
        console.log(`[rejoinRoom] 发送游戏状态给 ${player.name}`)
        socket.emit('gameStateUpdate', playerGameState)
      }
      
      // 通知其他玩家
      socket.to(roomId).emit('playerReconnected', {
        playerId: persistentPlayerId,
        playerName: player.name
      })
    } else {
      console.log(`[rejoinRoom] 失败: 在房间 ${roomId} 中找不到玩家 ${persistentPlayerId}`)
      socket.emit('error', { message: '在房间中找不到你的信息' })
    }
  })

  // 游戏操作处理 - 权威服务器模式
  socket.on('gameAction', ({ roomId, action }) => {
    const room = rooms.get(roomId)
    if (!room) {
      console.log(`[gameAction] 失败: 房间 ${roomId} 不存在`)
      return
    }
    
    const gameEngine = gameEngines.get(roomId)
    if (!gameEngine) {
      console.log(`[gameAction] 失败: 房间 ${roomId} 没有游戏引擎`)
      return
    }
    
    // 检查发送者是否在房间中
    const player = room.players.find(p => p.socketId === socket.id)
    if (!player) {
      console.log(`[gameAction] 警告: 玩家 ${socket.id} 不在房间 ${roomId} 中`)
      return
    }
    
    console.log(`\n=== [gameAction] 房间 ${roomId}: ${player.name} 执行 ${action.type} ===`)
    console.log(`[gameAction] 玩家ID: ${player.id}`)
    console.log(`[gameAction] Socket ID: ${socket.id}`)
    if (action.data) {
      console.log(`[gameAction] 操作数据:`, action.data)
    }
    
    let result
    
    // 根据操作类型调用游戏引擎
    switch (action.type) {
      case 'choosePlay':
        result = gameEngine.handleChoosePlay(player.id)
        break
        
      case 'chooseReforge':
        result = gameEngine.handleChooseReforge(player.id)
        break
        
      case 'playCard':
        result = gameEngine.handlePlayCard(
          player.id,
          action.data.cardIndex,
          action.data.slotIndex,
          action.data.targetPlayerIndex,
        )
        break
        
      case 'executeReforge':
        result = gameEngine.handleExecuteReforge(
          player.id,
          action.data.options,
          action.data.selectedCardIndex
        )
        break

      case 'resolveEffectBranch':
        result = gameEngine.handleResolveEffectBranch(
          player.id,
          action.data.branch,
          action.data.discardHandIndex,
        )
        break

      case 'skipEffectBranch':
        result = gameEngine.handleSkipEffectBranch(player.id)
        break

      case 'cancelDecision':
        result = gameEngine.handleCancelDecision(player.id)
        break
        
      case 'skipTurn':
        result = gameEngine.handleSkipTurn(player.id)
        break
        
      case 'startNewRound':
        result = gameEngine.startNewRound()
        break
        
      case 'endGame':
        result = gameEngine.endGame()
        break
        
      default:
        console.log(`[gameAction] 未知操作类型: ${action.type}`)
        return
    }
    
    if (!result.success) {
      // 操作失败，通知玩家
      socket.emit('actionError', { error: result.error })
      console.log(`[gameAction] 操作失败: ${result.error}`)
      return
    }
    
    // 操作成功，更新房间状态
    room.gameState = result.gameState
    
    console.log(`[gameAction] 操作成功，准备广播游戏状态`)
    console.log(`[gameAction] 新的 phase: ${result.gameState.phase}`)
    console.log(`[gameAction] 房间内玩家数: ${room.players.length}`)
    
    // 广播游戏状态给所有玩家（每个玩家看到的状态不同）
    room.players.forEach((p, index) => {
      const playerState = gameEngine.getPlayerGameState(p.id)
      console.log(`[gameAction] 发送状态给 ${p.name} (${p.socketId}), phase: ${playerState.phase}`)
      io.to(p.socketId).emit('gameStateUpdate', playerState)
    })
    
    console.log(`[gameAction] 所有游戏状态已广播`)
    console.log(`=== [gameAction] 完成 ===\n`)
  })

  // 玩家离开房间
  socket.on('leaveRoom', ({ roomId, playerId }) => {
    const room = rooms.get(roomId)
    if (!room) return
    
    const player = room.players.find(p => p.id === playerId)
    if (!player) return
    
    console.log(`[leaveRoom] 玩家 ${player.name} 离开房间 ${roomId}`)
    
    // 广播玩家离开消息
    socket.to(roomId).emit('playerLeft', {
      playerId: playerId,
      playerName: player.name
    })
    
    // 标记玩家为离线状态（但不删除）
    player.isOnline = false
    player.leftAt = Date.now()
    
    socket.leave(roomId)
  })

  // 断开连接
  socket.on('disconnect', () => {
    console.log('玩家断开:', socket.id)
    
    // 查找并标记玩家为离线
    for (const [roomId, room] of rooms.entries()) {
      const player = room.players.find(p => p.socketId === socket.id)
      if (player) {
        player.isOnline = false
        player.disconnectedAt = Date.now()
        
        // 通知其他玩家
        socket.to(roomId).emit('playerDisconnected', {
          playerId: player.id,
          playerName: player.name
        })
        
        console.log(`玩家 ${player.name} 断开连接，房间 ${roomId} 保留`)
        
        // 如果所有玩家都离线超过5分钟，删除房间
        setTimeout(() => {
          const currentRoom = rooms.get(roomId)
          if (currentRoom) {
            const allOffline = currentRoom.players.every(p => 
              p.isOnline === false && 
              (Date.now() - (p.disconnectedAt || 0)) > 300000
            )
            if (allOffline) {
              rooms.delete(roomId)
              console.log(`房间删除: ${roomId} (所有玩家离线超时)`)
            }
          }
        }, 300000) // 5分钟
        
        break
      }
    }
  })

  // 获取房间列表
  socket.on('getRooms', () => {
    const roomList = Array.from(rooms.values())
      .map(room => ({
        id: room.id,
        maxPlayers: room.maxPlayers,
        playerCount: room.players.length,
        hostName: room.players[0].name,
        status: room.status,
        onlinePlayers: room.players.filter(p => p.isOnline !== false).length
      }))
    socket.emit('roomList', roomList)
    console.log(`[getRooms] 返回房间列表:`, roomList.length, '个房间')
  })

  // --------------------------------------------------------------------------
  // 账号系统 — 注册 / 登录 / 卡组存取
  // --------------------------------------------------------------------------

  // 注册新玩家（创建玩家记录 + 默认卡组）
  socket.on('registerPlayer', ({ playerName }) => {
    try {
      const player = registerPlayer(dbHandle, playerName)
      const defaultDeck = [
        'card_001', 'card_002', 'card_003', 'card_004', 'card_005',
        'card_006', 'card_007', 'card_008', 'card_009', 'card_010',
        'card_011', 'card_012', 'card_013', 'card_014', 'card_015'
      ]
      createDeck(dbHandle, player.id, defaultDeck, 1) // isDefault=1
      socket.emit('playerRegistered', {
        player: { id: player.id, name: player.name },
        deck: { cardIds: defaultDeck }
      })
    } catch (e) {
      socket.emit('playerRejected', { message: e.message })
    }
  })

  // 登录已有玩家
  socket.on('loginPlayer', ({ playerName }) => {
    const player = getPlayerByName(dbHandle, playerName)
    if (!player) {
      socket.emit('playerRejected', { message: `玩家 "${playerName}" 不存在，请先注册` })
      return
    }
    const deck = getDeck(dbHandle, player.id)
    socket.emit('playerLoggedIn', {
      player: { id: player.id, name: player.name },
      deck: deck ? { cardIds: deck.card_ids } : null
    })
  })

  // 保存自定义卡组
  socket.on('saveDeck', ({ playerName, cardIds }) => {
    try {
      const player = getPlayerByName(dbHandle, playerName)
      if (!player) { socket.emit('playerRejected', { message: 'Player not found' }); return }
      createDeck(dbHandle, player.id, cardIds, 0) // isDefault=0
      socket.emit('deckSaved', { cardIds })
    } catch (e) {
      socket.emit('playerRejected', { message: e.message })
    }
  })

  // 加载卡组
  socket.on('loadDeck', ({ playerName }) => {
    const player = getPlayerByName(dbHandle, playerName)
    if (!player) { socket.emit('playerRejected', { message: 'Player not found' }); return }
    const deck = getDeck(dbHandle, player.id)
    socket.emit('deckLoaded', deck ? { cardIds: deck.card_ids } : null)
  })
})

// 生成房间ID
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function beginRoomGame(room) {
  if (room.status === 'playing') return

  room.status = 'playing'

  const gameEngine = new GameEngine(room.id, room.players, room.maxPlayers)
  gameEngines.set(room.id, gameEngine)

  const initialState = gameEngine.getPublicGameState()
  room.gameState = initialState

  console.log(`[gameStart] 游戏开始: ${room.id}，玩家: ${room.players.map(p => p.name).join(', ')}`)
  console.log(`[gameStart] 初始游戏状态 phase: ${initialState.phase}, round: ${initialState.round}`)

  io.to(room.id).emit('gameStart', { room })

  room.players.forEach(player => {
    const playerState = gameEngine.getPlayerGameState(player.id)
    console.log(`[gameStart] 发送游戏状态给 ${player.name} (${player.socketId})`)
    io.to(player.socketId).emit('gameStateUpdate', playerState)
  })

  console.log(`[gameStart] 所有游戏状态已发送`)
}

// 生成持久化玩家ID
function generatePlayerId() {
  return `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

// --------------------------------------------------------------------------
// 数据库初始化 & 卡牌数据填充
// --------------------------------------------------------------------------
dbHandle = initDB() // 使用 :memory: 以适应 Render 等无状态环境

// 尝试从 card-seed.json 读取，不存在则回退到 cardData.js 内存数据
let cardSeed
try {
  cardSeed = JSON.parse(fs.readFileSync('./card-seed.json', 'utf-8'))
  console.log('[DB] 从 card-seed.json 加载卡牌数据')
} catch (_err) {
  cardSeed = getAllCards()
  console.log('[DB] card-seed.json 不存在，使用 cardData.js 内存数据回退')
}
seedDefaultCards(dbHandle, cardSeed)

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`)
})
