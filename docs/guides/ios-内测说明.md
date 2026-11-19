# iOS 内测说明（PWA）

> 2026-11-19 首轮内测。无需安装 App，用 Safari 把网页装到主屏幕即可。

## 1. 访问地址

    https://doylesama114.github.io/Snode-rpg/斯诺德跑团/安装到主屏幕.html

（如果打不开，先用 https://doylesama114.github.io/Snode-rpg/ 进入站点。）

## 2. 安装步骤（iPhone / iPad）

1. 用 Safari 打开上面的地址（微信 / Chrome 内不行）；
2. 点底部「分享」按钮 → 添加到主屏幕 → 添加；
3. 回到桌面，点「斯诺德」图标启动；
4. 启动后应全屏、无地址栏。

## 3. 请重点验证

| # | 项目 | 怎么试 |
| --- | --- | --- |
| 1 | 安装 | 主屏幕出现图标，名称「斯诺德」 |
| 2 | 全屏 | 从图标启动无地址栏、状态栏不挡内容 |
| 3 | 离线 | 打开几个页面后，开飞行模式再启动 |
| 4 | 存档 | 建一个角色、退出、重进，数据还在 |
| 5 | 备份 | 设置/存档页导出一次，文件能在「文件」App 找到 |
| 6 | 布局 | 底部导航、按钮不被手势条遮挡；输入框不放大 |
| 7 | 更新 | 管理员发新版后，重开出现「有新版本」提示 |

## 4. 自检与反馈

打开「安装到主屏幕」页 → 点「运行自检」→ 「复制结果」，把这段文本和截图一起反馈：

    standalone: true
    iOS: 17.4
    serviceWorker: controlled
    storage: used 1.2MB / quota 5.0MB
    safeArea: top 59 / bottom 34

反馈入口：启动台右下角反馈按钮（bug-report），附自检结果。

## 5. 已知限制（内测阶段）

- iOS 对网页存储约 5MB，多角色可能写满；请定期用导出备份；
- 未安装（只是 Safari 打开）的站点，7 天不用可能被系统清数据；**务必先安装**；
- 独立模式下载文件可能受限，导出若失败请改用 Safari 打开再试；
- 推送通知暂不支持。

## 6. 管理员侧

- 代码：斯诺德跑团/manifest.webmanifest、sw.js、pwa.js、安装到主屏幕.html；
- 门禁：node verify_all.mjs（含 verify/verify_pwa.mjs）；
- 发布：push 到 master 自动部署 GitHub Pages；OSS 镜像同步见 deploy-oss.yml。
