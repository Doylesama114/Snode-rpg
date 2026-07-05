import type { AccountState } from '@/types/game'

const router = createRouter({
    // Electron file:// 协议下只能用 hash 路由，history 路由会白屏
    history: import.meta.env.VITE_ELECTRON
      ? createWebHashHistory(import.meta.env.BASE_URL)
      : createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: () => import('../views/Game/Home.vue')
        },
        {
            path: '/card-game',
            name: 'cardGame',
            component: () => import('../views/Game/CardGame.vue')
        },
        {
            path: '/new-game',
            name: 'newGame',
            component: () => import('../views/Game/CardGameNew.vue')
        },
        {
            path: '/multiplayer',
            name: 'multiplayerLobby',
            component: () => import('../views/Game/MultiplayerLobby.vue')
        },
        {
            path: '/game/multiplayer',
            name: 'multiplayerGame',
            component: () => import('../views/Game/CardGameMultiplayer.vue')
        },
        {
            path: '/account-setup',
            name: 'accountSetup',
            component: () => import('../views/Game/AccountSetup.vue')
        },
        {
            path: '/deck-builder',
            name: 'deckBuilder',
            component: () => import('../views/Game/DeckBuilder.vue')
        },
        {
            path: '/settings',
            name: 'gameSettings',
            component: () => import('../views/Game/GameSettings.vue')
        }
    ]
})

// Navigation guard: redirect to account setup if not registered
router.beforeEach((to, _from, next) => {
    if (to.path === '/account-setup') {
        return next()
    }

    try {
        const raw = localStorage.getItem('accountState')
        if (raw) {
            const accountState: AccountState = JSON.parse(raw)
            if (!accountState.isRegistered) {
                return next('/account-setup')
            }
            return next()
        }
    } catch {
        // No accountState or parse error → redirect
    }

    return next('/account-setup')
})

export default router
