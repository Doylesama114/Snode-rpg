# 角色创建 CLI

`snode.cmd` 是运行中 Snode 桌面应用的本地客户端。所有命令输出 JSON；失败时输出错误 JSON 并以非零状态退出。CLI 使用创建页同一份数据与保存流程，角色写入桌面应用现有存档。

## 启动与连接

先启动桌面应用，然后在仓库根目录运行：

```powershell
.\snode.cmd chargen flow
```

`snode.cmd` 默认把 JSON 中的中文直接显示出来。Agent 或脚本需要与终端编码无关的稳定输出时，在子命令前加全局参数 `--json`；中文会用标准 `\uXXXX` 表示，解析结果仍是中文：

```powershell
.\snode.cmd --json chargen flow
```

只安装应用、没有仓库时，先启动应用，再在任意 PowerShell 目录定位安装版 CLI：

```powershell
$exe = Get-Process -Name '斯诺德跑团' | Where-Object Path | Select-Object -First 1 -ExpandProperty Path
$cli = Join-Path (Split-Path $exe) 'snode.cmd'
& $cli chargen flow
```

`snode.cmd` 优先使用安装包同目录（或仓库 `electron-app/dist/win-unpacked/`）中的应用运行时，无需单独安装 Node.js；没有打包运行时时才使用系统中的 `node`。也可以手动运行 `node scripts/snode-cli.mjs ...`。应用启动时在应用数据目录的 `snode-rpg-cli/chargen-cli-connection.json` 写入仅供本机使用的连接文件，CLI 自动读取。安装包同目录还包含 `snode.cmd`、`CLI.md` 和 CLI 脚本；命令未注册到系统 PATH，需要从安装目录调用。测试或多实例环境可以用 `--connection <路径>` 或 `SNODE_CLI_CONNECTION` 指定连接文件。应用关闭时 CLI 会报告连接不可用。

`--json` 输出仅含 ASCII 字节，避免 Windows PowerShell 5.1 把 UTF-8 中文误读为 GBK。默认显示模式在 PowerShell 中解析这份 JSON 后再输出，因此可直接阅读中文。在 PowerShell 中也可以用 `(.\snode.cmd --json chargen flow | ConvertFrom-Json).steps | Format-Table` 查看表格。

## 查询创建信息

```powershell
.\snode.cmd chargen flow
.\snode.cmd chargen catalog classes
.\snode.cmd chargen catalog features --class 蛮斗士
.\snode.cmd chargen catalog proficiencies --class 蛮斗士
.\snode.cmd chargen show class 蛮斗士
.\snode.cmd chargen show race 龙裔
.\snode.cmd chargen show background 法师学徒
.\snode.cmd chargen rules pointBuy
.\snode.cmd chargen show class 法师 --full
.\snode.cmd chargen show class 法师 --part skills
.\snode.cmd chargen catalog classSkills --class 法师
.\snode.cmd chargen show skill 法师 塑能箭
```

`flow` 列出八步和可填写字段。`catalog` 返回完整候选集；`show` 返回单项完整资料和关联选择。职业的 `--full` 读取客户端可打开的技能树与进阶职业预览，包括展开后才显示的技能详情；返回页面标题、标题目录、技能结构、渲染文字和全部 DOM 文字。可用 `--part` 只读取一个预览页，或用 `catalog classSkills` / `show skill` 按技能查询。需要原始页面时加 `--include-source`。

目录类型：`classes`、`races`、`backgrounds`、`features`、`equipment`、`proficiencies`、`classSkills`、`deities`、`patrons`、`contracts`、`dragonTypes`、`languages`、`cantrips`、`instruments`、`gambling`、`sports`、`advancements`。创建规则主题见 `chargen rules all`。

## 草稿与创建

```powershell
.\snode.cmd chargen draft new
.\snode.cmd chargen draft patch <草稿ID> --input .\build.json
.\snode.cmd chargen draft get <草稿ID>
.\snode.cmd chargen options <草稿ID> --step 2
.\snode.cmd chargen validate <草稿ID>
.\snode.cmd chargen preview <草稿ID>
.\snode.cmd chargen commit <草稿ID>
```

`patch` 合并 JSON 对象；数组整体替换。`options` 返回指定步骤的页面文字、HTML、当前选择，以及条件选项。步骤编号为 0–7。Agent 应在改变职业、种族或背景后重新查询相关步骤的 `options`。`validate` 在隔离存储中运行创建页的保存流程，不写入真实角色；`commit` 再次校验，成功后创建 1 号存档并返回角色 ID 与完整角色数据。

下面是一份可验证的 1 级草稿示例：

```json
{
  "className": "蛮斗士",
  "specChoices": { "运动健将": { "attr": "力量", "skill": "威力" } },
  "selectedFeatures": ["猛击", "凶蛮打击"],
  "raceName": "矮人",
  "attrs": { "力量": 15, "敏捷": 15, "体质": 15, "智力": 8, "感知": 8, "魅力": 8, "意志": 13, "幸运": 8 },
  "selectedSkills": ["威力", "体操", "耐力", "驯兽"],
  "bgName": "平民英雄",
  "equipLetter": "A",
  "charName": "示例角色",
  "playerName": "玩家"
}
```

## 已有角色

```powershell
.\snode.cmd character list
.\snode.cmd character get <角色ID> --slot 1
.\snode.cmd character get <角色ID> --slot 1 --include-portrait
.\snode.cmd character update <角色ID> --draft <完整草稿ID> --slot 1
.\snode.cmd character profile <角色ID> --input .\profile.json --slot 1
.\snode.cmd character portrait <角色ID> --file .\avatar.png --slot 1
.\snode.cmd character delete <角色ID> --yes
.\snode.cmd character delete <角色ID> --yes --slot 2
```

`list` 按角色分组列出存档位。`get` 默认省略已保存头像的 Base64 数据，以 `portraitInfo` 返回 MIME 和字节数，避免单次查询输出数 MB；需要完整存档（例如备份）时加 `--include-portrait`。`update` 使用经创建校验的完整草稿重建角色，仅允许更新尚未升级的角色。`profile` 接受 JSON 对象，只能修改 `gender`、`age`、`height`、`weight`、`eye`、`skin`、`hair`、`story`、`personality`、`traits`、`ideals`、`bonds`、`flaws` 等资料文字；会同步创建记录，保留属性、装备、进度和头像。`portrait` 只更新指定存档的头像，支持不超过 3 MiB 的 PNG、JPEG、WebP 或 GIF 文件，保留其他角色数据。它返回图片的 MIME、字节数和 SHA-256，不输出整张图片。`delete` 默认删除该角色全部存档位；指定 `--slot` 只删除一个存档位。角色命令的 `--slot` 仅接受 1、2 或 3；漏填或填错会直接失败，避免误写其他存档。修改后若客户端停留在角色选择页或角色存档页，页面会刷新。

创建或重建角色时，自定义的 `traits` 文字优先于背景默认描述。运动员仍需选择偏好运动，但它不会被追加到自定义特性文字中。

## 覆盖约定

CLI 覆盖创建页八步中的卡片、展开详情、条件选择、购点、预览与保存规则。`options` 返回客户端当前步骤的 HTML 与文字，并用 `extras` 补充弹窗中的候选项；`show class --full` 覆盖创建页可打开的完整职业预览。页面中的图片可通过 `--include-source` 返回的资源路径定位。

规则数据仍由现有创建页提供。新增或调整创建选项时，应同时验证 CLI 的 `catalog`、`show`、`options`、`validate` 和 `preview` 输出。根目录 `斯诺德跑团/` 与 `electron-app/斯诺德跑团/` 需要按项目打包规则保持同步。

## 回归测试

测试会创建并删除一个测试角色。开发时先用独立的 Electron 用户数据目录启动应用，避免触碰日常存档：

```powershell
$env:SNODE_CLI_TEST = '1'
$env:SNODE_CLI_TEST_USER_DATA = '<测试目录>'
cd electron-app
pnpm start
```

在另一个终端把 `SNODE_CLI_CONNECTION` 指向 `<测试目录>/chargen-cli-connection.json`，然后运行：

```powershell
node scripts/test-snode-cli-e2e.mjs
node scripts/test-snode-cli-special.mjs
node scripts/test-snode-cli-coverage.mjs
node electron-app/sync-check.js
```

端到端测试检查草稿、校验、预览和角色增删改查；专项测试覆盖人类、龙裔与背景特殊选择；覆盖测试逐一读取全部职业、种族、背景及每个职业的完整预览。
