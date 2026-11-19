# 斯诺德跑团（Snode）

纯前端 TRPG 工具集：角色系统、职业技能树、规则手册、斯诺德对决；桌面壳 Electron + Android WebView。

## 快速开始

    node verify_all.mjs          # 全量门禁
    打开 斯诺德跑团/启动台.html   # 本地直接运行（零构建）

## 目录

| 目录 | 内容 |
| --- | --- |
| 源文件/ | 真值：职业 / 规则 / 角色档案 / 素材 / 更新内容（manifest.json 记录 sha256） |
| scripts/ | 数据管线与校验 |
| verify/ | 校验脚本 |
| 斯诺德跑团/ | 前端站点 |
| 职业页/ | 职业技能树子站 |
| electron-app/ | 桌面壳（镜像） |
| advisor/ + advisor-server/ | AI 顾问知识库与服务 |
| docs/ | 架构 / 指南 / 治理 / 归档 / 方案 |

## 文档

- 入口与约定：[AGENTS.md](AGENTS.md)
- 文件落位：[文件整理规范.md](文件整理规范.md)
- 文档索引：[项目文档.md](项目文档.md)
- 发布流程：[docs/guides/release-guide.md](docs/guides/release-guide.md)
