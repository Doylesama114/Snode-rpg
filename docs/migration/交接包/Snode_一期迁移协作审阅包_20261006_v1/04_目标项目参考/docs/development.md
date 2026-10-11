# 开发说明

## 共享接口

前端通过 Vite 的 `/api` 代理请求 Fastify。服务的存活和数据库就绪是两个独立接口：

```text
GET /api/health  → 200：API 正常运行
GET /api/ready   → 200：数据库可连接；503：未配置或不可连接
```

接口响应类型放在 `packages/contracts`，前后端共同引用。角色、物品、规则版本及状态边界需要双方确认后再加入该包。

共享包输出到各自的 `dist`；根目录 `pnpm dev` 会先构建，再监听修改。单独启动某个应用前可运行 `pnpm build:packages`。

## 数据库迁移

`packages/db/src/schema.ts` 当前只有最小用户身份表，尚未实现登录。后续按确认后的规则增加角色、团、物品与流水等表。

修改流程：

```bash
pnpm db:generate
pnpm db:migrate
pnpm check
```

检查生成的 SQL 后提交 `packages/db/drizzle`。已被其他开发者或环境应用的迁移保留历史，通过新增迁移调整结构。

数据库数据不进入 Git；`.env`、依赖和构建产物也已忽略。配置项变化时同步更新 `.env.example` 和 README。

## 验证与发布

当前 API 测试覆盖：无数据库时存活检查仍正常、未配置数据库时就绪失败、连接错误时返回可控状态、已配置真实数据库时连接成功。

GitHub Actions 对 `main` 的推送和 PR 执行安装、迁移、类型检查、测试与构建。业务开发按实际行为增加必要验证。

部署方式与登录方式仍待确定。前端生产部署需保持 `/api` 与后端路由的映射；Vite 开发代理不属于生产部署配置。

## 项目资料

[飞书一期开发文档](https://lcnnkviu5vj0.feishu.cn/wiki/S0Crw8VEIi7kWPkBIRqcs3xdn6b)是背景、范围和任务同步的主要记录。配图及生成提示词保存在 `docs/assets`。
