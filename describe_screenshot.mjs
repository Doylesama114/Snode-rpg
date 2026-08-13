// 截图 UI 缺陷描述：免费视觉模型优先，失败自动降级到百炼 qwen-vl
// 后端策略（--backend）:
//   auto (默认): 先 opencode/mimo-v2.5-free（免费）→ 不可用时自动降级 qwen-vl-plus（百炼）
//   opencode:    强制免费模型
//   qwen:        强制百炼（需 .env 配置 QWEN_API_KEY）
// 用法: node describe_screenshot.mjs <图片路径> [--backend auto|opencode|qwen]
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from './scripts/advisor-env.mjs';

loadEnv(); // 加载根目录 .env（QWEN_API_KEY 等）

const imgPath = process.argv[2];
if (!imgPath || !fs.existsSync(imgPath)) {
  console.error('用法: node describe_screenshot.mjs <图片路径> [--backend auto|opencode|qwen]');
  process.exit(1);
}
const backend = process.argv.includes('--backend') ? process.argv[process.argv.indexOf('--backend') + 1] : 'auto';

const prompt = `你是 UI 质检员。分析这张 RPG 角色面板/商店界面的截图，只报告"视觉层"问题：
1. 元素是否重叠、挤压、遮挡
2. 文字是否被截断、溢出、不可读
3. 布局是否错位、间距异常
4. 内容是否明显缺失或不可达
5. 按钮/图标是否可辨认
重要说明：截图由无头浏览器生成——滚动条被隐藏、列表视口底部内容自然截断均属截图环境的正常现象，**不要**因此报告问题；只有当内容完全无法访问（如被遮挡、重叠、空白异常）时才报告。
输出格式（无问题则输出"无视觉问题"）：
- [严重度: 高/中/低] 位置（如"商店列表区"）: 问题描述
逐条列出，不要泛泛而谈。`;

function hasQwenKey() { return !!process.env.QWEN_API_KEY; }

function runOpencode() {
  const out = execSync(
    'opencode run ' + JSON.stringify(prompt) + ' -m opencode/mimo-v2.5-free -f ' + JSON.stringify(imgPath),
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 300000 }
  );
  let text = out.replace(/^> [^\n]*mimo[^\n]*\n?/gm, '').trim();
  text = text.replace(/^[\u2713\u2717\u2022][^\n]*Vision Agent[^\n]*\n?/gm, '').trim();
  // 防御：空输出或纯错误行（如 "Error: xxx"）视为失败，触发降级
  const errorOnly = /^Error:/.test(text) && !/\n/.test(text);
  if (!text || errorOnly) throw new Error('免费模型返回空/错误输出: ' + text.slice(0, 120));
  return text;
}

async function runQwen() {
  const key = process.env.QWEN_API_KEY;
  const b64 = fs.readFileSync(imgPath).toString('base64');
  const ext = path.extname(imgPath).slice(1).toLowerCase() || 'png';
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
  const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({
      model: 'qwen-vl-plus',
      messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + b64 } },
        { type: 'text', text: prompt }
      ]}],
      max_tokens: 800
    })
  });
  if (!res.ok) throw new Error('API ' + res.status + ': ' + (await res.text()).slice(0, 300));
  const data = await res.json();
  return data.choices[0].message.content;
}

let used = null;
try {
  if (backend === 'auto' || backend === 'opencode') {
    used = 'opencode/mimo-v2.5-free（免费）';
    console.log('→ 尝试免费模型 opencode/mimo-v2.5-free ...');
    const text = runOpencode();
    console.log('===== 视觉检查报告 (' + used + '): ' + imgPath + ' =====');
    console.log(text);
  } else if (backend === 'qwen') {
    if (!hasQwenKey()) { console.error('缺少 QWEN_API_KEY（.env 中配置，阿里云百炼获取）'); process.exit(1); }
    used = 'qwen-vl-plus（百炼）';
    const text = await runQwen();
    console.log('===== 视觉检查报告 (' + used + '): ' + imgPath + ' =====');
    console.log(text);
  } else {
    console.error('未知后端: ' + backend + '（可选 auto|opencode|qwen）');
    process.exit(1);
  }
} catch (e) {
  const freeFailed = backend === 'auto' || backend === 'opencode';
  if (freeFailed && (backend === 'auto') && hasQwenKey()) {
    console.log('→ 免费模型不可用（' + String(e.message).split('\n')[0] + '），降级到百炼 qwen-vl-plus ...');
    try {
      const text = await runQwen();
      console.log('===== 视觉检查报告 (qwen-vl-plus 百炼): ' + imgPath + ' =====');
      console.log(text);
    } catch (e2) {
      console.error('百炼降级也失败:', String(e2.message).split('\n')[0]);
      process.exit(1);
    }
  } else if (freeFailed && !hasQwenKey()) {
    console.error('免费模型调用失败:', String(e.message).split('\n')[0]);
    console.error('提示：可配置 QWEN_API_KEY 启用百炼降级（.env 中 QWEN_API_KEY=sk-...）');
    process.exit(1);
  } else {
    console.error('调用失败:', String(e.message).split('\n')[0]);
    process.exit(1);
  }
}
