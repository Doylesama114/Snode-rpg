# snode-combat（战斗系统 v2）

斯诺德战斗系统的重制版：BG3 式交互的 2D 正方形格战棋。

## 当前状态
- 项目骨架阶段，尚未实现战斗逻辑。
- v1 目标：纯 PVE、单角色卡 vs 怪物遭遇、首发职业游荡者。
- 权威设计文档：`docs/战斗系统设计v2.md`（2026-09-20 由仓库根目录迁入）。
- AI 开发指导：`docs/战斗系统AI指导v2.md`（同上）。

## 目录
- `core/`：纯 TypeScript 规则引擎（无 DOM）
- `data/`：单位/能力/状态/怪物/遭遇卡片数据
- `render/`：PixiJS 棋盘渲染与特效
- `ui/`：HTML UI（动作栏、先攻条、弹窗、日志）
- `app/`：战斗入口与模式装配
- `tools/`：数据导入、校验、导出工具
- `docs/`：数据 schema 等设计附属文档

## 命令
```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
```
