import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import path from 'path'

// 去除 crossorigin 属性 (Electron file:// 下报错)
function removeCrossorigin() {
  return {
    name: 'remove-crossorigin',
    transformIndexHtml(html: string) {
      if (process.env.VITE_ELECTRON) {
        return html.replace(/ crossorigin/g, '')
      }
      return html
    }
  }
}

export default defineConfig({
    // GitHub Pages 部署时需要设置正确的 base
    // 仓库名是 poker-game，所以 base 应该是 '/poker-game/'
    // Electron 打包时设置 VITE_ELECTRON=1 使用相对路径
    base: process.env.VITE_ELECTRON ? './' : (process.env.NODE_ENV === 'production' ? '/poker-game/' : '/'),
    plugins: [
        vue(),
        UnoCSS(),
        removeCrossorigin(),
        AutoImport({
            // targets to transform
            include: [/\.[tj]sx?$/, /\.vue$/, /\.vue\?vue/, /\.md$/],

            // global imports to register
            imports: [
                // vue auto import
                'vue',
                // vue-router auto import
                {
                    'vue-router': [
                        'createRouter',
                        'createWebHistory',
                        'createWebHashHistory'
                    ]
                },
                // @vueuse/core auto import
                {
                    '@vueuse/core': [
                        'createGlobalState',
                        'useStorage',
                        'useColorMode',
                        'useFullscreen'
                    ]
                },
                // @/store auto import
                {
                    '@/store': [
                        'useGlobalState'
                    ]
                }
            ]
        }),
    ],
    resolve: {
        // 别名
        alias: {
            '@': path.resolve(__dirname, 'src')
        },
        // 忽略后缀
        extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
    },
    server: {
        port: 5173,
        host: true,
        open: true
    },
    build: {
        // 生产环境构建配置
        outDir: 'dist',
        assetsDir: 'assets',
        // 启用 gzip 压缩大小报告
        reportCompressedSize: true,
        // chunk 大小警告限制（KB）
        chunkSizeWarningLimit: 1000
    }
})
