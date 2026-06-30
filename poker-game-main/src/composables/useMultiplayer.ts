import { ref, computed } from 'vue'
import { io, Socket } from 'socket.io-client'
import type { GameState, GameAction } from '@/types/game'

export interface MultiplayerRoom {
  id: string
  players: Array<{
    id: string
    name: string
    socketId: string
  }>
  gameState: GameState | null
  status: 'waiting' | 'playing' | 'finished'
}

// 为每个标签页创建独立的实例
// 使用sessionStorage来标识不同的标签页
function getTabId(): string {
  let tabId = sessionStorage.getItem('tabId')
  if (!tabId) {
    tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem('tabId', tabId)
  }
  return tabId
}

// 获取或创建持久化玩家ID（跨标签页、跨会话）
function getPersistentPlayerId(): string {
  let playerId = localStorage.getItem('persistentPlayerId')
  if (!playerId) {
    playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('persistentPlayerId', playerId)
    console.log('[useMultiplayer] 创建新的持久化玩家ID:', playerId)
  } else {
    console.log('[useMultiplayer] 使用现有的持久化玩家ID:', playerId)
  }
  return playerId
}

// 每个标签页独立的状态
const instances = new Map<string, {
  socket: Socket | null
  connected: any
  currentRoom: any
  availableRooms: any
  error: any
  playerName: any
  isHost: any
  myPlayerId: any
  persistentPlayerId: string  // 改为直接存储字符串
  onGameStateUpdateCallback: ((gameState: GameState) => void) | null
  cachedGameState: GameState | null  // 缓存游戏状态
}>()

function getInstance() {
  const tabId = getTabId()
  const persistentPlayerId = getPersistentPlayerId()  // 每次都获取最新的
  
  if (!instances.has(tabId)) {
    instances.set(tabId, {
      socket: null,
      connected: ref(false),
      currentRoom: ref<MultiplayerRoom | null>(null),
      availableRooms: ref<Array<{ id: string; playerCount: number; hostName: string }>>([]),
      error: ref<string | null>(null),
      playerName: ref(''),
      isHost: ref(false),
      myPlayerId: ref(''),
      persistentPlayerId: persistentPlayerId,  // 直接使用字符串
      onGameStateUpdateCallback: null,
      cachedGameState: null
    })
  } else {
    // 更新现有实例的 persistentPlayerId
    instances.get(tabId)!.persistentPlayerId = persistentPlayerId
  }
  
  return instances.get(tabId)!
}

export function useMultiplayer() {
  const instance = getInstance()
  
  // 使用实例的状态
  const socket = computed(() => instance.socket)
  const connected = instance.connected
  const currentRoom = instance.currentRoom
  const availableRooms = instance.availableRooms
  const error = instance.error
  const playerName = instance.playerName
  const isHost = instance.isHost
  const myPlayerId = instance.myPlayerId
  const persistentPlayerId = computed(() => instance.persistentPlayerId)  // 改为 computed

  // 连接到服务器
  function connect(serverUrl: string = 'http://localhost:3001') {
    if (instance.socket?.connected) return

    instance.socket = io(serverUrl, {
      transports: ['websocket'],
      reconnection: true
    })

    instance.socket.on('connect', () => {
      instance.connected.value = true
      const currentPersistentId = getPersistentPlayerId()
      console.log(`[${getTabId()}] 已连接到服务器, socketId:`, instance.socket!.id, 'persistentPlayerId:', currentPersistentId)
      
      // 尝试恢复房间信息和玩家ID
      const savedRoomId = sessionStorage.getItem('currentRoomId')
      const savedRoomData = sessionStorage.getItem('currentRoomData')
      const savedPlayerId = sessionStorage.getItem('myPlayerId')
      
      if (savedPlayerId) {
        instance.myPlayerId.value = savedPlayerId
        console.log(`[${getTabId()}] 恢复玩家ID:`, savedPlayerId)
      }
      
      if (savedRoomId && savedRoomData) {
        try {
          const roomData = JSON.parse(savedRoomData)
          instance.currentRoom.value = roomData
          console.log(`[${getTabId()}] 恢复房间信息:`, savedRoomId)
          
          // 重新加入socket.io房间，使用持久化玩家ID
          instance.socket!.emit('rejoinRoom', { 
            roomId: savedRoomId, 
            socketId: instance.socket!.id,
            persistentPlayerId: currentPersistentId
          })
        } catch (e) {
          console.error(`[${getTabId()}] 恢复房间信息失败:`, e)
        }
      }
    })

    instance.socket.on('disconnect', () => {
      instance.connected.value = false
      console.log(`[${getTabId()}] 与服务器断开连接`)
    })

    instance.socket.on('error', (data: { message: string }) => {
      instance.error.value = data.message
      console.error(`[${getTabId()}] 错误:`, data.message)
      
      // 如果是房间不存在的错误，清理本地状态
      if (data.message.includes('房间不存在') || data.message.includes('房间中找不到')) {
        console.log(`[${getTabId()}] 房间不存在，清理本地状态`)
        sessionStorage.removeItem('currentRoomId')
        sessionStorage.removeItem('currentRoomData')
        sessionStorage.removeItem('myPlayerId')
        sessionStorage.removeItem('savedGameState')
        instance.currentRoom.value = null
      }
    })

    instance.socket.on('roomCreated', (data: { roomId: string; room: MultiplayerRoom; playerId: string }) => {
      instance.currentRoom.value = data.room
      instance.myPlayerId.value = data.playerId
      instance.isHost.value = true
      console.log(`[${getTabId()}] 房间已创建:`, data.roomId, '房间信息:', data.room, 'playerId:', data.playerId)
      // 保存房间信息到sessionStorage
      sessionStorage.setItem('currentRoomId', data.roomId)
      sessionStorage.setItem('currentRoomData', JSON.stringify(data.room))
      sessionStorage.setItem('myPlayerId', data.playerId)
    })

    instance.socket.on('playerJoined', (data: { room: MultiplayerRoom }) => {
      instance.currentRoom.value = data.room
      // 如果还没有设置myPlayerId，从房间中找到自己的ID
      if (!instance.myPlayerId.value) {
        const myPlayer = data.room.players.find(p => p.socketId === instance.socket!.id)
        if (myPlayer) {
          instance.myPlayerId.value = myPlayer.id
          sessionStorage.setItem('myPlayerId', myPlayer.id)
        }
      }
      console.log(`[${getTabId()}] 玩家加入:`, data.room.players)
      // 更新房间信息到sessionStorage
      sessionStorage.setItem('currentRoomId', data.room.id)
      sessionStorage.setItem('currentRoomData', JSON.stringify(data.room))
    })

    instance.socket.on('gameStart', (data: { room: MultiplayerRoom }) => {
      instance.currentRoom.value = data.room
      console.log(`[${getTabId()}] 游戏开始!`, '房间信息:', data.room)
      // 更新房间信息到sessionStorage
      sessionStorage.setItem('currentRoomId', data.room.id)
      sessionStorage.setItem('currentRoomData', JSON.stringify(data.room))
    })
    
    // 监听游戏状态更新（权威服务器模式）
    instance.socket.on('gameStateUpdate', (gameState: GameState) => {
      console.log(`[${getTabId()}] 收到游戏状态更新:`, gameState)
      
      // 如果有回调，立即调用
      if (instance.onGameStateUpdateCallback) {
        instance.onGameStateUpdateCallback(gameState)
      } else {
        // 否则缓存状态，等待组件挂载
        console.log(`[${getTabId()}] 回调未设置，缓存游戏状态`)
        instance.cachedGameState = gameState
      }
    })

    // 注意：opponentAction 监听器由组件通过 onOpponentAction() 设置
    // 不在这里设置，避免重复监听

    instance.socket.on('gameStateUpdated', (gameState: GameState) => {
      console.log(`[${getTabId()}] 游戏状态更新`)
    })

    instance.socket.on('playerDisconnected', (data: { playerId: string; playerName: string }) => {
      instance.error.value = `${data.playerName} 已断开连接`
      console.log(`[${getTabId()}] 玩家断开:`, data.playerName)
    })

    instance.socket.on('roomList', (rooms: Array<{ id: string; playerCount: number; hostName: string }>) => {
      instance.availableRooms.value = rooms
    })

    instance.socket.on('roomRejoined', (data: { room: MultiplayerRoom; playerId: string; gameState?: any; actionHistory?: any[] }) => {
      instance.currentRoom.value = data.room
      instance.myPlayerId.value = data.playerId
      console.log('[${getTabId()}] 重新加入房间成功:', data.room.id, 'playerId:', data.playerId)
      
      // 更新房间信息到sessionStorage
      sessionStorage.setItem('currentRoomId', data.room.id)
      sessionStorage.setItem('currentRoomData', JSON.stringify(data.room))
      sessionStorage.setItem('myPlayerId', data.playerId)
      
      // 如果有游戏状态，立即触发回调或缓存
      if (data.gameState) {
        console.log(`[${getTabId()}] 收到保存的游戏状态`)
        
        // 如果回调已设置，立即调用
        if (instance.gameStateUpdateCallback) {
          console.log(`[${getTabId()}] 立即触发 gameStateUpdate 回调`)
          instance.gameStateUpdateCallback(data.gameState)
        } else {
          // 否则缓存状态
          console.log(`[${getTabId()}] 缓存游戏状态`)
          instance.cachedGameState = data.gameState
        }
      }
    })
    
    instance.socket.on('playerLeft', (data: { playerId: string; playerName: string }) => {
      instance.error.value = `${data.playerName} 已离开游戏`
      console.log(`[${getTabId()}] 玩家离开:`, data.playerName)
    })
    
    instance.socket.on('playerReconnected', (data: { playerId: string; playerName: string }) => {
      instance.error.value = null
      console.log(`[${getTabId()}] 玩家重新连接:`, data.playerName)
    })
  }

  // 断开连接
  function disconnect() {
    if (instance.socket) {
      instance.socket.disconnect()
      instance.socket = null
      instance.connected.value = false
      instance.currentRoom.value = null
    }
  }

  // 创建房间
  function createRoom(name: string) {
    if (!instance.socket?.connected) {
      instance.error.value = '未连接到服务器'
      return
    }
    const currentPersistentId = getPersistentPlayerId()
    console.log(`[${getTabId()}] createRoom 被调用:`, { name, persistentPlayerId: currentPersistentId })
    instance.playerName.value = name
    instance.socket.emit('createRoom', { 
      playerName: name, 
      persistentPlayerId: currentPersistentId
    })
  }

  // 加入房间
  function joinRoom(roomId: string, name: string) {
    if (!instance.socket?.connected) {
      instance.error.value = '未连接到服务器'
      return
    }
    const currentPersistentId = getPersistentPlayerId()
    console.log(`[${getTabId()}] joinRoom 被调用:`, { roomId, name, persistentPlayerId: currentPersistentId })
    instance.playerName.value = name
    instance.socket.emit('joinRoom', { 
      roomId, 
      playerName: name, 
      persistentPlayerId: currentPersistentId
    })
  }
  
  // 离开房间
  function leaveRoom() {
    console.log(`[${getTabId()}] leaveRoom 被调用`)
    console.log(`[${getTabId()}] socket.connected:`, instance.socket?.connected)
    console.log(`[${getTabId()}] currentRoom:`, instance.currentRoom.value)
    
    if (!instance.socket?.connected) {
      console.log(`[${getTabId()}] socket 未连接，直接清理本地状态`)
      // 即使 socket 未连接，也清理本地状态
      sessionStorage.removeItem('currentRoomId')
      sessionStorage.removeItem('currentRoomData')
      sessionStorage.removeItem('myPlayerId')
      sessionStorage.removeItem('savedGameState')
      instance.currentRoom.value = null
      return
    }
    
    if (!instance.currentRoom.value) {
      console.log(`[${getTabId()}] 不在房间中，直接返回`)
      return
    }
    
    console.log(`[${getTabId()}] 离开房间:`, instance.currentRoom.value.id)
    instance.socket.emit('leaveRoom', {
      roomId: instance.currentRoom.value.id,
      playerId: instance.myPlayerId.value
    })
    
    // 清理本地状态
    sessionStorage.removeItem('currentRoomId')
    sessionStorage.removeItem('currentRoomData')
    sessionStorage.removeItem('myPlayerId')
    sessionStorage.removeItem('savedGameState')
    instance.currentRoom.value = null
    
    console.log(`[${getTabId()}] 房间状态已清理`)
  }

  // 获取房间列表
  function getRooms() {
    if (!instance.socket?.connected) {
      instance.error.value = '未连接到服务器'
      return
    }
    instance.socket.emit('getRooms')
  }

  // 发送游戏操作
  function sendAction(action: GameAction) {
    if (!instance.socket?.connected) {
      console.error(`[${getTabId()}] 无法发送操作: socket未连接`)
      return
    }
    if (!instance.currentRoom.value) {
      console.error(`[${getTabId()}] 无法发送操作: 不在房间中`)
      return
    }
    
    console.log(`[${getTabId()}] 发送操作到房间 ${instance.currentRoom.value.id}:`, action.type, action.data || '')
    
    instance.socket.emit('gameAction', {
      roomId: instance.currentRoom.value.id,
      action
    })
  }

  // 同步游戏状态
  function syncGameState(gameState: GameState) {
    if (!instance.socket?.connected || !instance.currentRoom.value) return
    instance.socket.emit('syncGameState', {
      roomId: instance.currentRoom.value.id,
      gameState
    })
  }

  // 监听对手操作
  function onOpponentAction(callback: (action: GameAction) => void) {
    if (!instance.socket) {
      console.error(`[${getTabId()}] onOpponentAction: socket不存在`)
      return
    }
    console.log(`[${getTabId()}] 设置 opponentAction 监听器`)
    instance.socket.on('opponentAction', (action: GameAction) => {
      console.log(`[${getTabId()}] 收到 opponentAction 事件:`, action)
      callback(action)
    })
  }

  // 监听游戏状态更新（权威服务器模式）
  function onGameStateUpdate(callback: (gameState: GameState) => void) {
    console.log(`[${getTabId()}] 设置 gameStateUpdate 回调`)
    instance.onGameStateUpdateCallback = callback
    
    // 如果有缓存的状态，立即调用回调
    if (instance.cachedGameState) {
      console.log(`[${getTabId()}] 发现缓存的游戏状态，立即应用`)
      callback(instance.cachedGameState)
      instance.cachedGameState = null
    }
  }
  
  // 移除游戏状态更新回调
  function offGameStateUpdate() {
    instance.onGameStateUpdateCallback = null
  }

  // 监听游戏状态更新（旧版，保留兼容性）
  function onGameStateUpdateLegacy(callback: (gameState: GameState) => void) {
    if (!instance.socket) return
    instance.socket.on('gameStateUpdated', callback)
  }

  // 移除监听器
  function offOpponentAction(callback: (action: GameAction) => void) {
    if (!instance.socket) return
    instance.socket.off('opponentAction', callback)
  }

  function offGameStateUpdateLegacy(callback: (gameState: GameState) => void) {
    if (!instance.socket) return
    instance.socket.off('gameStateUpdated', callback)
  }

  const isInRoom = computed(() => currentRoom.value !== null)
  const isGameStarted = computed(() => currentRoom.value?.status === 'playing')
  const roomPlayerCount = computed(() => currentRoom.value?.players.length || 0)
  const opponentName = computed(() => {
    if (!currentRoom.value || currentRoom.value.players.length < 2) return ''
    const opponent = currentRoom.value.players.find(p => p.socketId !== myPlayerId.value)
    return opponent?.name || ''
  })

  return {
    socket,
    connected,
    currentRoom,
    availableRooms,
    error,
    playerName,
    isHost,
    myPlayerId,
    persistentPlayerId,
    isInRoom,
    isGameStarted,
    roomPlayerCount,
    opponentName,
    connect,
    disconnect,
    createRoom,
    joinRoom,
    leaveRoom,
    getRooms,
    sendAction,
    syncGameState,
    onOpponentAction,
    onGameStateUpdate,
    offOpponentAction,
    offGameStateUpdate
  }
}
