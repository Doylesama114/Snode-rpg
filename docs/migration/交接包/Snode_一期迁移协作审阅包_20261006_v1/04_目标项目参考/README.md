# Snode

面向 Snode 自定义规则的网页角色创建与管理平台。第一期覆盖规则资料、建卡与角色管理、云端保存、团与 DM 权限、基础经济。

[一期开发文档与任务进度](https://lcnnkviu5vj0.feishu.cn/wiki/S0Crw8VEIi7kWPkBIRqcs3xdn6b)

## 当前状态

此仓库已搭建工程基础：首页用于评审美术方向，本地开发代理连接后端，后端可以检查 PostgreSQL 连接，Drizzle 管理数据库迁移，GitHub Actions 执行检查。角色管理首个本机预览已接入：列表、资料/数值编辑、后台草稿、显式保存、历史快照及冲突/离开处理。登录、规则建卡、云端角色保存、团权限和经济功能仍待开发。

当前首页采用深墨、暖白与旧金的视觉方向，参考 EchoVoyage、Owlbear Rodeo、Roll20、Foundry VTT 和 Alchemy。色调、字体、参考取舍与素材说明见 [美术与界面方向](docs/design.md)。

只预览角色界面可运行 `pnpm --filter @snode/web dev`，打开 http://127.0.0.1:5173/#/characters。预览记录保存在当前浏览器，尚未连接登录/云端；成长、装备和结构化状态明确标为待接入。范围、保存/恢复行为和验收命令见 [角色管理候选核心与本机预览](docs/proposals/character-management/README.md)。

## 技术栈与目录

| 目录 | 用途 | 技术 |
| --- | --- | --- |
| `apps/web` | 网页前端 | React、Vite、TypeScript |
| `apps/api` | 业务 API | Node.js、Fastify、TypeScript |
| `packages/contracts` | 双方共享的接口类型 | TypeScript |
| `packages/db` | 数据库连接、Schema 与迁移 | PostgreSQL、Drizzle |
| `docs` | 工程说明与项目配图 | — |

统一使用 pnpm workspace。旧仓库作为规则和功能资料参考，新代码在此实现。

## 本地启动

需要 Node.js 24（版本见 `.node-version`）、pnpm 11.9.0。数据库可使用 Docker Compose 或已有的 PostgreSQL。

安装 pnpm：

```bash
npm install -g pnpm@11.9.0
```

在仓库根目录执行：

```bash
pnpm install
cp .env.example .env
pnpm db:up
pnpm db:migrate
pnpm dev
```

- 前端：<http://127.0.0.1:5173>
- 后端存活检查：<http://127.0.0.1:3001/api/health>
- 数据库就绪检查：<http://127.0.0.1:3001/api/ready>

本地数据库账号和密码均为 `snode`，数据库名为 `snode`。这些仅供本地开发；部署时使用独立凭据。数据库端口只绑定到本机。

没有 Docker 时，可启动现有 PostgreSQL，并在 `.env` 中填写 `DATABASE_URL`，跳过 `pnpm db:up`。暂未准备数据库也能运行 `pnpm dev` 检查前后端联通；这时 `/api/ready` 返回 503。

`pnpm db:down` 停止数据库容器，并保留数据卷。

## 常用命令

| 命令 | 功能 |
| --- | --- |
| `pnpm dev` | 构建共享包后，启动前后端及共享包监听 |
| `pnpm check` | 类型检查、API 测试和生产构建 |
| `pnpm test:characters` | 角色管理校验、编辑与草稿恢复回归 |
| `pnpm test:characters:browser` | 无头网页验收，需先安装 Playwright Chromium |
| `pnpm db:generate` | 修改 Schema 后生成迁移文件 |
| `pnpm db:migrate` | 应用已提交的迁移 |
| `pnpm --filter @snode/api start` | 运行已构建的后端 |

`DATABASE_URL` 存在时，测试包含真实数据库连接检查；未配置时该项跳过。CI 提供 PostgreSQL 并执行迁移及完整检查。运行构建产物前先执行 `pnpm build`。前端生产文件在 `apps/web/dist`，部署时将 `/api` 反向代理至后端。

## 两人协作

按飞书文档中的两组任务协作：旧仓库迁移；云同步与经济市场建设。每组同时负责需要的前后端工作，共享接口放在 `packages/contracts`，数据库结构放在 `packages/db`。

1. 先确认角色和规则的数据格式，再分别开发；尚未敲定的业务模型不作为既定接口。
2. 从 `main` 创建短期功能分支，提交 PR，由另一位开发者评审。
3. PR 关联飞书任务编号（如 `3.1.1`），记录变更和验证；进度与情况继续维护在飞书文档。
4. 修改共享接口或数据库结构时，在 PR 中说明影响；迁移文件与对应代码一起提交。

详见 [开发说明](docs/development.md)。
