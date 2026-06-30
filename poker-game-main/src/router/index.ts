const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
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
        }
    ]
})

export default router
