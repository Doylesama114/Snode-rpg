import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { GameEngine } from './gameEngine.js'

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
const waitingPlayers = []
// 玩家ID到socket ID的映射（用于断线重连）
const playerSockets = new Map()

io.on('connection', (socket) => {
  console.log('玩家连接:', socket.id)

  // 创建房间
  socket.on('createRoom', ({ playerName, persistentPlayerId }) => {
    const roomId = generateRoomId()
    const playerId = persistentPlayerId || generatePlayerId()
    
    const room = {
      id: roomId,
      players: [{
        id: playerId,
        name: playerName,
        socketId: socket.id
      }],
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
  socket.on('joinRoom', ({ roomId, playerName, persistentPlayerId }) => {
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
    if (room.players.length >= 2) {
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
      isOnline: true
    })
    
    playerSockets.set(playerId, socket.id)
    socket.join(roomId)
    console.log(`[joinRoom] 成功: 玩家 ${playerName} 加入房间 ${roomId}，当前玩家数: ${room.players.length}`)
    
    // 通知房间内所有玩家
    io.to(roomId).emit('playerJoined', { room })
    
    // 如果房间满了，开始游戏
    if (room.players.length === 2) {
      room.status = 'playing'
      
      // 创建游戏引擎实例
      const gameEngine = new GameEngine(roomId, room.players)
      gameEngines.set(roomId, gameEngine)
      
      // 获取初始游戏状态
      const initialState = gameEngine.getPublicGameState()
      room.gameState = initialState
      
      console.log(`[gameStart] 游戏开始: ${roomId}，玩家: ${room.players.map(p => p.name).join(', ')}`)
      console.log(`[gameStart] 游戏引擎已创建`)
      console.log(`[gameStart] 初始游戏状态 phase: ${initialState.phase}, round: ${initialState.round}`)
      
      // 先发送 gameStart 事件
      io.to(roomId).emit('gameStart', { room })
      
      // 发送每个玩家的个人游戏状态（包含自己的手牌）
      room.players.forEach(player => {
        const playerState = gameEngine.getPlayerGameState(player.id)
        console.log(`[gameStart] 发送游戏状态给 ${player.name} (${player.socketId})`)
        console.log(`[gameStart] 玩家状态 - phase: ${playerState.phase}, 手牌数: ${playerState.players[0].hand.length}`)
        io.to(player.socketId).emit('gameStateUpdate', playerState)
      })
      
      console.log(`[gameStart] 所有游戏状态已发送`)
    }
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
          action.data.slotIndex
        )
        break
        
      case 'executeReforge':
        result = gameEngine.handleExecuteReforge(
          player.id,
          action.data.options,
          action.data.selectedCardIndex
        )
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
        playerCount: room.players.length,
        hostName: room.players[0].name,
        status: room.status,
        onlinePlayers: room.players.filter(p => p.isOnline !== false).length
      }))
    socket.emit('roomList', roomList)
    console.log(`[getRooms] 返回房间列表:`, roomList.length, '个房间')
  })
})

// 生成房间ID
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// 生成持久化玩家ID
function generatePlayerId() {
  return `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`)
})
