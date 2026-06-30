<script setup lang="ts">
import { ref } from 'vue'
import { SERVER_CONFIG } from '@/config/multiplayer'

const emit = defineEmits<{
  close: []
  save: [url: string]
}>()

const customUrl = ref('')
const selectedPreset = ref<'local' | 'lan' | 'frp' | 'custom'>('local')

const presets = [
  { value: 'local', label: '本地测试', url: SERVER_CONFIG.local, desc: '同一台电脑，使用无痕窗口' },
  { value: 'lan', label: '局域网', url: SERVER_CONFIG.lan, desc: '同一WiFi，朋友访问你的IP' },
  { value: 'frp', label: 'Sakura FRP', url: SERVER_CONFIG.frp, desc: '互联网访问，需要配置FRP' },
  { value: 'custom', label: '自定义', url: '', desc: '手动输入服务器地址' }
]

function selectPreset(preset: typeof selectedPreset.value) {
  selectedPreset.value = preset
  if (preset !== 'custom') {
    const config = presets.find(p => p.value === preset)
    if (config) {
      customUrl.value = config.url
    }
  }
}

function handleSave() {
  const url = selectedPreset.value === 'custom' ? customUrl.value : presets.find(p => p.value === selectedPreset.value)?.url || ''
  if (url) {
    emit('save', url)
  }
}
</script>

<template>
  <div class="dialog-overlay" @click="emit('close')">
    <div class="dialog" @click.stop>
      <div class="dialog-header">
        <h3>🔧 服务器配置</h3>
        <button @click="emit('close')" class="close-btn">×</button>
      </div>
      
      <div class="dialog-body">
        <div class="presets">
          <div 
            v-for="preset in presets" 
            :key="preset.value"
            class="preset-card"
            :class="{ active: selectedPreset === preset.value }"
            @click="selectPreset(preset.value as any)"
          >
            <div class="preset-label">{{ preset.label }}</div>
            <div class="preset-url" v-if="preset.url">{{ preset.url }}</div>
            <div class="preset-desc">{{ preset.desc }}</div>
          </div>
        </div>

        <div v-if="selectedPreset === 'custom'" class="custom-input">
          <label>自定义服务器地址：</label>
          <input 
            v-model="customUrl" 
            type="text" 
            placeholder="http://your-server.com:3001"
            class="input"
          />
          <div class="input-hint">
            示例：http://abc123.natfrp.cloud:12345
          </div>
        </div>

        <div v-if="selectedPreset === 'frp'" class="frp-help">
          <h4>🌸 Sakura FRP 配置提示</h4>
          <ol>
            <li>在Sakura FRP创建TCP隧道，本地端口：3001</li>
            <li>启动隧道，获得远程地址（例如：cn-sh-bgp-1.natfrp.cloud:12345）</li>
            <li>在下方输入完整地址：<code>http://节点域名:端口</code></li>
            <li>点击保存并重新连接</li>
          </ol>
          <input 
            v-model="customUrl" 
            type="text" 
            :placeholder="SERVER_CONFIG.frp"
            class="input"
          />
          <div class="input-hint">
            当前配置：{{ SERVER_CONFIG.frp }}
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <button @click="handleSave" class="btn btn-primary">保存并连接</button>
        <button @click="emit('close')" class="btn btn-secondary">取消</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 15px;
  padding: 0;
  min-width: 600px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.dialog-header {
  padding: 20px 30px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dialog-header h3 {
  margin: 0;
  font-size: 24px;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 32px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.3s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.dialog-body {
  padding: 30px;
}

.presets {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}

.preset-card {
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 10px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.3s;
}

.preset-card:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.preset-card.active {
  background: rgba(76, 175, 80, 0.3);
  border-color: #4caf50;
  box-shadow: 0 0 20px rgba(76, 175, 80, 0.5);
}

.preset-label {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 8px;
}

.preset-url {
  font-size: 12px;
  font-family: monospace;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 8px;
  word-break: break-all;
}

.preset-desc {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.custom-input,
.frp-help {
  background: rgba(0, 0, 0, 0.2);
  padding: 20px;
  border-radius: 10px;
  margin-top: 20px;
}

.custom-input label,
.frp-help h4 {
  display: block;
  margin-bottom: 10px;
  font-weight: bold;
}

.frp-help ol {
  margin: 15px 0;
  padding-left: 20px;
  line-height: 1.8;
}

.frp-help code {
  background: rgba(0, 0, 0, 0.3);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  color: #4caf50;
}

.input {
  width: 100%;
  padding: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  font-size: 16px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  box-sizing: border-box;
}

.input:focus {
  outline: none;
  border-color: #4caf50;
  background: rgba(255, 255, 255, 0.15);
}

.input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.input-hint {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.dialog-footer {
  padding: 20px 30px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-primary {
  background: #4caf50;
  color: white;
}

.btn-primary:hover {
  background: #45a049;
  transform: scale(1.05);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
