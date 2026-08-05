// 斯诺德跑团 - 更新日志
var SNOWD_CHANGELOG = [

  {
    version: '1.0.7177',
    date: '2026-08-05',
    changes: [
      '新增牧师神圣领域「无尽饥饿与吞噬之神」：18 项技能/专长接入职业页，chip/导航/搜索同步',
      'AI 顾问增强：神名与神圣领域问题可准确列出该领域全部技能，噬骸者等机制问答不再误报未收录或漏项'
    ]
  },


  {
    version: '1.0.7176',
    date: '2026-08-04',
    changes: [
      '修复：移动端 APK 资源包内的 bug 上报未接入自动汇总，现与网页/桌面统一上报到 OSS'
    ]
  },


  {
    version: '1.0.7175',
    date: '2026-08-04',
    changes: [
      'AI 反馈闭环：手机/网页/桌面点有用没用自动上报，FC 沉淀到 OSS，支持拉取汇总报告',
      'Bug 反馈自动汇总：全站注入顾问端点，bug 上报进 OSS，支持拉取汇总报告',
      '世界观抽象问题路由增强：环游旅行、值得去、神秘危险地方、饮食、祭拜等不再误入 general，饮食文化检索补齐别名',
      '多意图与矛盾意图检测：命中时引用基本规则第六条，引导用户先明确目标'
    ]
  },


  {
    version: '1.0.7174',
    date: '2026-08-03',
    changes: [
      '世界观检索增强：首都、王都、四境、城市与道路旅行关键词路由修复，路线问题不再误入车卡规划',
      '帮助页世界观部分标题样式修复：城市与城镇恢复小标题样式，宗教据点、所属领主等字段行不再被误判为标题',
      'AI 顾问抉择技能规则与多状态检索修复（德鲁伊定位术二选一、中毒与流血状态同时回答）'
    ]
  },


  {
    version: '1.0.7173',
    date: '2026-08-03',
    changes: [
      '修复移动端 AI 顾问流式回答偶发“服务流未正常结束”：服务端发送完成事件后延迟关闭连接，客户端自动回退非流式兜底',
      '修复快捷问题连续点击会拼接上一个问题：改为直接发送当前问题，上下文由会话历史携带',
      'AI 顾问悬浮球与 Bug 反馈按钮支持拖动，并默认靠边收起，鼠标悬停或点按侧边时展开'
    ]
  },


  {
    version: '1.0.7172',
    date: '2026-08-03',
    changes: [
      '修复移动端 AI 助理入口：APK 内悬浮球改用绝对 appassets 地址，避免相对路径解析异常导致 Not Found',
      '修复移动端卡牌游戏入口：网页/APK 部署后卡牌在顶层 poker-game，路径已更正',
      '启动台在 APK 内自动注入 base 标签，兜底帮助页与脚本等相对引用'
    ]
  },


  {
    version: '1.0.7171',
    date: '2026-08-03',
    changes: [
      '移动端 AI 助理：FC 接口地址自动下发（FC 部署后发布端点到 OSS，网页与 APK 构建自动读取）',
      '修复网页部署与 FC 端点发布的先后竞态：拉取结果增加 URL 校验，避免错误文本写入页面'
    ]
  },


  {
    version: '1.0.7170',
    date: '2026-08-03',
    changes: [
      '移动端 AI 助理上线：新增全屏顾问聊天页（流式回答、追问选项、有用/没用/复制、引用跳转、会话记忆）',
      '移动端全局悬浮球入口（手机网页与 APK 显示，桌面 Electron 保持原侧滑面板）',
      '新增阿里云函数计算后端：完整顾问管线 + SSE 流式响应，DeepSeek Key 仅保存在服务端',
      'APK 软键盘适配：聊天输入框随键盘上推'
    ]
  },


  {
    version: '1.0.7169',
    date: '2026-08-04',
    changes: [
      '世界观架构 docx 更新同步：帮助页世界观章节扩充（雷恩王国商业/律法/城市/冒险者公会等）',
      'AI 助理世界观资料库扩容（lore 索引 91 → 163 块），新增内容可查询'
    ]
  },


  {
    version: '1.0.7168',
    date: '2026-08-03',
    changes: [
      '职业页：修复起始特性与全部技能的描述/效果/升级文本错位（15 页 + 通用天赋树 + 牧师领域）',
      '修复创建页/面板中凶蛮打击的错误描述',
      '修复渲染器误删含「天赋树」的描述句与历史泄露内容'
    ]
  },


  {
    version: '1.0.7167',
    date: '2026-08-03',
    changes: [
      'AI 助理：引用兜底（无效引用自动修复/剔除，引用错误清零）',
      'AI 助理：评测矩阵扩至 44 用例，覆盖全职业与主要意图',
      'AI 助理：数值确定性工具（技能代价/负重/伤害期望）',
      'AI 助理：主动追问（缺职业/等级/风格时引导点选）',
      'AI 助理：回答反馈按钮（有用/没用/复制）与反馈导出',
      'AI 助理：性能优化（快路径扩展、build 回答 token 控制）与常见问题快捷入口'
    ]
  },


  {
    version: '1.0.7166',
    date: '2026-08-03',
    changes: [
      '启动台新增「自动更新」开关（默认开启）：关闭后不再自动检查更新',
      '桌面端关闭后跳过启动自动检查与下载安装；网页/移动端跳过打开与定时检查',
      '手动「检查更新 / 镜像更新」始终可用'
    ]
  },


  {
    version: '1.0.7165',
    date: '2026-08-03',
    changes: [
      'AI 助理：新增车卡推荐意图，模糊问题给出多职业/种族/背景的数据驱动推荐',
      'AI 助理：评测系统升级（golden 要点 + LLM 评分 + 引用校验），全量 19 用例通过',
      'AI 助理：组合推理与 AC 数值修复（形态补检/主题消歧/原始敏捷换算）'
    ]
  },


  {
    version: '1.0.7164',
    date: '2026-08-03',
    changes: [
      '角色面板：猎人守护技能/天赋学习联动，学习其一自动获得另一个，退学同步移除'
    ]
  },


  {
    version: '1.0.7163',
    date: '2026-08-03',
    changes: [
      'AI助理适配v4-flash：关闭默认思考、修复超时挂起、combat_math公式检索、规则类问题快路径',
      'AI资料库全量补齐：重建15个职业索引、牧师神圣领域273条、升级内容完整保留',
      'docx对比补齐：奇械师46个缺失技能、猎人守护天赋侧3条、治愈和弦恢复、升级子项51处',
      '通用天赋树抉择假条目15个清除',
      '回归测试扩至13用例全部通过'
    ]
  },


  {
    version: '1.0.7162',
    date: '2026-08-01',
    changes: [
      '德鲁伊野兽形态补全：新增黑豹/斑鹿/老鼠/野猪形态卡与3/5/8级升级内容'
    ]
  },


  {
    version: '1.0.7161',
    date: '2026-08-01',
    changes: [
      '桌面端仅保留每次启动自动检查更新，移除每4小时定时检查'
    ]
  },


  {
    version: '1.0.7160',
    date: '2026-08-01',
    changes: [
      '武僧移动端补回按阶位筛选的侧边栏导航抽屉'
    ]
  },


  {
    version: '1.0.7159',
    date: '2026-07-31',
    changes: [
      '术士混沌法术改为点数-效果对应表格展示（参照docx）'
    ]
  },


  {
    version: '1.0.7158',
    date: '2026-07-31',
    changes: [
      '修复职业页结构损坏：section嵌套/JSON泄露/术士错位，改用最小侵入的阶位标题方案'
    ]
  },


  {
    version: '1.0.7157',
    date: '2026-07-31',
    changes: [
      '修复职业页阶位标题与风格标题重复（圣骑士等），基于干净基线重建并合并萨满重复分区'
    ]
  },


  {
    version: '1.0.7156',
    date: '2026-07-31',
    changes: [
      '抉择技能提示全量补全（15职业+通用天赋树+神圣领域共396处）',
      '阶位大标题补全（德鲁伊/萨满/吟游诗人/猎人等）与视觉增强'
    ]
  },


  {
    version: '1.0.7155',
    date: '2026-07-31',
    changes: [
      '种族创建特性补全：斑猫人/豹兽人猫之迅疾豁免选择',
      '矮人锻造/半身人务农/地精化学/蛙人歌唱/翼空珠宝/牛头人威慑/人鱼歌唱等熟练授予',
      '木精灵攻击命中+1',
      '高等精灵法术命中+1',
      '龟人自定义专业',
      '卓尔毒刃改为占用技能栏上限'
    ]
  },


  {
    version: '1.0.7154',
    date: '2026-07-31',
    changes: [
      '修复APK图标显示为默认图标的问题（自适应图标前景配置）'
    ]
  },


  {
    version: '1.0.7153',
    date: '2026-07-31',
    changes: [
      'APK图标更换为封面设计（多密度+自适应图标）'
    ]
  },


  {
    version: '1.0.7152',
    date: '2026-07-31',
    changes: [
      'Android上传角色修复：文件选择器支持与content读取开启'
    ]
  },


  {
    version: '1.0.7151',
    date: '2026-07-31',
    changes: [
      '帮助页移动端排版优化（表格列宽收敛与横向滚动、长文本换行）'
    ]
  },


  {
    version: '1.0.7150',
    date: '2026-07-31',
    changes: [
      '全站移动端适配完善：职业页横向溢出与悬浮按钮重叠修复、提示浮层优化',
      '角色面板新增打开导出目录按钮（Android）'
    ]
  },


  {
    version: '1.0.7149',
    date: '2026-07-31',
    changes: [
      '角色面板移动端排版优化（信息区纵向布局/分栏堆叠/技能表行距与换行）'
    ]
  },


  {
    version: '1.0.7148',
    date: '2026-07-31',
    changes: [
      'Android APK调试诊断支持',
      '修复首页渲染问题排查'
    ]
  },


  {
    version: '1.0.7147',
    date: '2026-07-31',
    changes: [
      '新增Android手机版（APK+资源包自动更新）',
      '卡牌音乐wav转ogg大幅减小体积'
    ]
  },


  {
    version: '1.0.7146',
    date: '2026-07-31',
    changes: [
      '角色面板移动端优化：天赋树/技能表横向滚动修复'
    ]
  },


  {
    version: '1.0.7145',
    date: '2026-07-31',
    changes: [
      '职业页UX增强：滚动定位/回到顶部/搜索高亮/前置跳转/SP徽章/升级徽标/白底风格兜底'
    ]
  },


  {
    version: '1.0.7144',
    date: '2026-07-31',
    changes: [
      '职业页：起始特性补全风格色（docx底纹）+跨职业同名风格冲突修复'
    ]
  },


  {
    version: '1.0.7143',
    date: '2026-07-31',
    changes: [
      '职业页交互修复：类型头关键词筛选、右下角面板分组/搜索/计数、首页搜索file兼容+武僧脚本补齐'
    ]
  },


  {
    version: '1.0.7142',
    date: '2026-07-31',
    changes: [
      '职业页：14职业+通用天赋树+牧师神圣领域表格化（docx风格底纹、升级/描述/限制补齐、顺序对齐docx、缺失技能补全）'
    ]
  },


  {
    version: '1.0.7141',
    date: '2026-07-31',
    changes: [
      'xlsx导出：技能/风格格按职业底纹色+风格格居中'
    ]
  },


  {
    version: '1.0.7140',
    date: '2026-07-31',
    changes: [
      'xlsx导出：改版图纸区O172–192+同名技能查找+装备占位/H18/XP·SP+未持有栏位对角线划掉'
    ]
  },


  {
    version: '1.0.7139',
    date: '2026-07-31',
    changes: [
      '角色面板新增重新车卡另存为新角色',
      '创建时写入快照并预填向导',
      '上传与旧档无快照不可用'
    ]
  },


  {
    version: '1.0.7138',
    date: '2026-07-30',
    changes: [
      '修复xlsx导出丢失幸运探索行',
      '特性槽与模板对齐为6格',
      'set按列序插入且clear不invent'
    ]
  },


  {
    version: '1.0.7137',
    date: '2026-07-30',
  },


  {
    version: '1.0.7136',
    date: '2026-07-29',
    changes: [
      '修复技能栏未满却只能替换',
      '通用学习计入主职栏',
      '子职业xlsx回读不再截成一条'
    ]
  },


  {
    version: '1.0.7135',
    date: '2026-07-28',
    changes: [
      '卓尔精灵自动授予毒刃与制毒',
      '牧师创建必选神祇与属性',
      '魔契师创建必选契约宗主'
    ]
  },


  {
    version: '1.0.7134',
    date: '2026-07-28',
    changes: [
      '角色创建：法师学徒可选一二阶戏法2项',
      '公民基础/专业熟练分轨',
      '运动员偏好运动',
      '乐师乐器与赌具任选写入专业栏'
    ]
  },


  {
    version: '1.0.7133',
    date: '2026-07-28',
    changes: [
      '角色创建：人类中庸自由熟练度按属性分组展示，提升可读性'
    ]
  },


  {
    version: '1.0.7132',
    date: '2026-07-29',
    changes: [
      '升级选属性/熟练用即将升到等级的cap并静默落盘',
      '熟练键统一迁移并禁止写入通用黑洞',
      '固定熟练专长与真实熟练键选择',
      '弥补短板后续升级与旧档计数迁移',
      '通用天赋持之以恒/磨炼/耐性/工具载具钩子',
      '36个专长面板加成接线',
      '天赋额外槽生效且属性夹至20并旧档补发'
    ]
  },


  {
    version: '1.0.7131',
    date: '2026-07-28',
    changes: [
      '技能栏学习上限改用calcSkillSlots修复误报已满',
      '风格位src用职业名并跳过空串',
      '夜间模式XP/专长/子职业改用CSS变量',
      '创建页复合熟练项写入与表演-演奏展示修复'
    ]
  },


  {
    version: '1.0.7130',
    date: '2026-07-28',
    changes: [
      '修复xlsx导出ZIP CRC导致打开丢格/串字',
      '导出前清空技能装备特性残留格避免同名模板夹带',
      '创建/上传同名静默加数字后缀存档ID',
      '选择页与导出文件名用后缀、表内保留原名',
      'loadState先重置再赋值',
      '移除立绘体积上限'
    ]
  },


  {
    version: '1.0.7129',
    date: '2026-07-28',
    changes: [
      '帮助页新增规则/世界观全文检索：命中自动切页签并跳转，支持上一条下一条与关键词高亮'
    ]
  },


  {
    version: '1.0.7128',
    date: '2026-07-28',
    changes: [
      '帮助页再同步《冒险者基础规则》：缴械措辞收紧；其他规则扩至25条（新增射程/反应动作细则/掩体）；通用天赋树补充暂无战斗风格说明',
      '顾问 status_conditions 缴械与 rules_summary #s10 指针同步'
    ]
  },


  {
    version: '1.0.7127',
    date: '2026-07-27',
    changes: [
      '帮助页名望/声望改为表格展示并优化可读性（正负面配色、声望倾向标签）'
    ]
  },


  {
    version: '1.0.7126',
    date: '2026-07-27',
    changes: [
      '帮助页同步《冒险者基础规则》：新增名望/声望 #s9，其他规则扩至22条 #s10',
      '通用天赋树修复「哟吼船长的藏宝图」为五阶并修复 DOM 嵌套崩坏',
      '顾问抽取改读 help.html；rules_summary 补充名望/声望指针'
    ]
  },


  {
    version: '1.0.7125',
    date: '2026-07-27',
    changes: [
      '顾问问答接入世界观 L7 lore 知识库',
      '设定题意图 worldview_lore 检索',
      'sync/docx 同步写入 advisor/lore'
    ]
  },


  {
    version: '1.0.7124',
    date: '2026-07-27',
    changes: [
      '帮助页接入世界观架构（页内翻页）',
      '世界观 Web Speech 朗读（全文/章节/段落）',
      'sync_worldview_help.py 从 docx 同步并镜像'
    ]
  },


  {
    version: '1.0.7123',
    date: '2026-07-26',
    changes: [
      '修复牧师神圣领域子分支正文落入左侧导航列',
      '清理多余div并加固领域注入/校验'
    ]
  },


  {
    version: '1.0.7122',
    date: '2026-07-26',
    changes: [
      '猎人五阶9技能入库',
      '魔契师三阶补遗与五阶27技能',
      '牧师解锁战争与谋略之神圣领域'
    ]
  },


  {
    version: '1.0.7121',
    date: '2026-07-26',
    changes: [
      '修复启动台帮助点击变成下载',
      '帮助页改用ASCII路径help.html',
      'Electron拦截.html误下载并loadFile打开'
    ]
  },


  {
    version: '1.0.7120',
    date: '2026-07-26',
    changes: [
      '角色面板新增图纸专业槽位：固定20格、规则上限10+智力调整+独具匠心/手动加成',
      '学习含（图纸）能力不再占技能/天赋槽，旧存档自动迁移',
      'xlsx导出导入O210-O230图纸区',
      '帮助页同步基础规则其他规则（图纸等）',
      'T12回归测试'
    ]
  },


  {
    version: '1.0.7119',
    date: '2026-07-26',
    changes: [
      '修复CI electron-builder构建失败',
      '加固release.yml重试与windows-2022'
    ]
  },


  {
    version: '1.0.7118',
    date: '2026-07-26',
    changes: [
      '帮助页新增额外规则章节',
      '潜行跳远双持等七条补充裁定入库'
    ]
  },


  {
    version: '1.0.7117',
    date: '2026-07-26',
    changes: [
      '牧师页神圣领域神祇法表切换',
      '六神领域入库与锁定态',
      '筛选作用域按当前神祇面板'
    ]
  },


  {
    version: '1.0.7116',
    date: '2026-07-26',
    changes: [
      '战士武僧诗人法师docx内容同步',
      '法师新增约58技能与防范箭矢改名',
      '战士七阶10技能入库',
      '搜索索引与面板SKILL_DATA更新'
    ]
  },


  {
    version: '1.0.7115',
    date: '2026-07-26',
    changes: [
      '牧师/魔契师进阶按神祇宗主分节筛选',
      '修复详情按钮跨卡片错绑(影舞者等)',
      '分支校验脚本'
    ]
  },


  {
    version: '1.0.7114',
    date: '2026-07-26',
    changes: [
      '进阶详情嵌套技能按文档顺序渲染',
      '限制字段别名防拆卡',
      'verify覆盖能力/心得nested_skills'
    ]
  },


  {
    version: '1.0.7113',
    date: '2026-07-26',
    changes: [
      '已公布进阶docx一键入库49条',
      '跳过冰霜法师',
      'Advisor documented27→49',
      '途径页解锁查看详情'
    ]
  },


  {
    version: '1.0.7112',
    date: '2026-07-26',
    changes: [
      '修复武僧酒仙/凰火七阶侧栏跳转错位',
      '清理通用天赋树重复错误链接',
      '新增verify_class_nav_links校验'
    ]
  },


  {
    version: '1.0.7111',
    date: '2026-07-26',
    changes: [
      '暗红#851321归一为棕色',
      '全局搜索去掉暗红色板',
      'search-index重建'
    ]
  },


  {
    version: '1.0.7110',
    date: '2026-07-26',
    changes: [
      'docx非标准色归一:808080黑/F79646橙/FF66CC粉',
      '全局搜索与职业页色彩筛选合并',
      'search-index重建'
    ]
  },


  {
    version: '1.0.7109',
    date: '2026-07-25',
    changes: [
      '吟游诗人五阶入库(b-skill-120~149)',
      '通用extract/diff/apply管线',
      'search-index含五阶',
      '发版前验证流程写入文档'
    ]
  },


  {
    version: '1.0.7108',
    date: '2026-07-25',
    changes: [
      '首页全局搜索改用预构建索引可搜正文',
      '修复加载竞态与落地页锚点高亮',
      '搜索结果按职业分组紧凑展示并分页',
      '并行支持职业与色彩标识筛选'
    ]
  },


  {
    version: '1.0.7107',
    date: '2026-07-25',
    changes: [
      '术士混沌法术D100效果改为表格展示',
      '游荡者魔药风格重复三阶天赋树合并',
      '修复阶位解锁误显示花费99999(需99级)',
      '法师数字阶位6与多职起始特性type修正',
      '上传页不再免费赠送付费阶位',
      'T14/T15回归测试'
    ]
  },


  {
    version: '1.0.7106',
    date: '2026-07-25',
    changes: [
      '修复法师主职升级：带预知梦等tier天赋时claimed_levels未初始化导致等级不刷新',
      '新增ensureClaimedLevels兜底+T13回归测试'
    ]
  },


  {
    version: '1.0.7105',
    date: '2026-07-20',
    changes: [
      '修正通用天赋树阶位v2：猛火三元素+抉择M→五阶，伤害阈值→七阶'
    ]
  },


  {
    version: '1.0.7104',
    date: '2026-07-20',
    changes: [
      '修复通用天赋树阶位：17个错位天赋行移到正确四/五/六阶'
    ]
  },


  {
    version: '1.0.7103',
    date: '2026-07-18',
    changes: [
      '修复通用天赋树搜索功能：恢复丢失的filter.js/common.js/FilterController/nav脚本+</body></html>'
    ]
  },


  {
    version: '1.0.7102',
    date: '2026-07-17',
    changes: [
      '通用天赋树验证清理：删除遗留八墓村+触不可及(已从docx移除)'
    ]
  },


  {
    version: '1.0.7101',
    date: '2026-07-17',
    changes: [
      '通用天赋树补全：17新增天赋+4抉择M+19修正+颜色校准(真实docx色值)+恢复藏宝图+删除飓风专精'
    ]
  },


  {
    version: '1.0.7100',
    date: '2026-07-17',
    changes: [
      '通用天赋树docx同步：新增17天赋+8符文+重命名极速者+删除藏宝图'
    ]
  },


  {
    version: '1.0.7099',
    date: '2026-07-17',
    changes: [
      '圣骑士docx对照：力量祝福/英雄气概/智慧祝福描述修正（盟友/角色/FP4/施展条件-）'
    ]
  },


  {
    version: '1.0.7098',
    date: '2026-07-14',
    changes: [
      '人类角色创建页：自由熟练度选项补全50项（含运动/巧手/奥秘/知识/表演子项），修正显示格式为属性·大项-子项'
    ]
  },


  {
    version: '1.0.7097',
    date: '2026-07-10',
    changes: [
      '新增4张卡牌:鲁特琴/猫鼬神龛/挖掘/奇美拉',
      '卡池扩至152张',
      '引擎支持全局改费/随机牌库底/随机属性'
    ]
  },


  {
    version: '1.0.7096',
    date: '2026-07-09',
    changes: [
      '联机迭代3:贝壳速攻空槽部署',
      '联机检索多候选选牌UI',
      '联机酒馆回合结束酒水可选打出'
    ]
  },


  {
    version: '1.0.7095',
    date: '2026-07-09',
    changes: [
      '迭代3:贝壳速攻空槽部署',
      '检索多候选选牌UI',
      '酒馆回合结束酒水可选打出'
    ]
  },


  {
    version: '1.0.7094',
    date: '2026-07-09',
    changes: [
      '斯诺德对决：修复部署点选/额外槽/罗森弗斯首回合/重铸双换牌/费用上限6',
      '单机接入批次揭示(旗鱼/矮人烈酒)',
      '检索与部署引擎回归'
    ]
  },


  {
    version: '1.0.7093',
    date: '2026-07-09',
    changes: [
      '修复进阶页色彩标识按docx显示（每组一色一点）',
      '修复法师次级变形术描述与5级抉择排版'
    ]
  },


  {
    version: '1.0.7092',
    date: '2026-07-09',
    changes: [
      '检查更新失败自动切换国内镜像',
      '镜像更新全自动下载安装'
    ]
  },


  {
    version: '1.0.7091',
    date: '2026-07-09',
    changes: [
      'Advisor进阶库281条',
      'advancement_data与docx同步',
      '进阶同步手册更新'
    ]
  },


  {
    version: '1.0.7090',
    date: '2026-07-09',
    changes: [
      '修复OSS镜像feedUrl缺https导致镜像下载失败',
      'CI自动补全PUBLIC_BASE协议头'
    ]
  },


  {
    version: '1.0.7089',
    date: '2026-07-09',
    changes: [
      '进阶途径页从docx全量同步',
      '标识色彩三档展开',
      '字段改为标识'
    ]
  },


  {
    version: '1.0.7088',
    date: '2026-07-09',
    changes: [
      '国内镜像阿里云OSS',
      'release.yml mirror-oss',
      'Electron镜像下载优先OSS'
    ]
  },


  {
    version: '1.0.7087',
    date: '2026-07-09',
    changes: [
      'Advisor 5.0 batch23 Tier-B条件修饰符',
      'mergeTierBFromScan脚本',
      '语料+3皮匠/凶蛮/混乱箭',
      'Golden+CI batch22 must-pass'
    ]
  },


  {
    version: '1.0.7086',
    date: '2026-07-09',
    changes: [
      'Advisor 5.0 batch22 appliesTo+Tier-A收尾',
      '扫描v2.1优势/目标AC信号',
      '语料+3荒野医疗/独行伙伴/奥术矩阵',
      'Golden+CI batch21 must-pass'
    ]
  },


  {
    version: '1.0.7085',
    date: '2026-07-09',
    changes: [
      'Advisor 5.0 batch21 优势劣势+目标AC debuff',
      'hitRollModifier+targetAcModifier 引擎',
      '语料+3 力量报偿/辅助瞄准镜/腐蚀术',
      'Golden+CI batch20 must-pass'
    ]
  },


  {
    version: '1.0.7084',
    date: '2026-07-09',
    changes: [
      'Advisor 5.0 batch20 引擎requiresReaction',
      'Tier-A/B bulk语料23条'
    ]
  },


  {
    version: '1.0.7083',
    date: '2026-07-09',
    changes: [
      'Advisor 5.0 batch19 战斗修饰符扫描v2',
      'Tier A-D分级',
      'combat-modifiers-scan报告'
    ]
  },


  {
    version: '1.0.7082',
    date: '2026-07-09',
    changes: [
      'Advisor 5.0 batch18 扫描入库',
      'conditionalAcModifier',
      'build_review多职分组'
    ]
  },


  {
    version: '1.0.7081',
    date: '2026-07-09',
    changes: [
      'Advisor 5.0 batch17 条件熟练度修饰符',
      'hitViaProficiency',
      'L2 combat scan'
    ]
  },


  {
    version: '1.0.7080',
    date: '2026-07-09',
    changes: [
      'Advisor 5.0 batch16 战斗Phase5修饰符',
      'build_review无kit L2回退',
      'conditionalHitModifier'
    ]
  },


  {
    version: '1.0.7079',
    date: '2026-07-08',
    changes: [
      'Advisor 5.0 batch15 Build评价Tools层',
      'build_review意图拆分',
      'kit位阶内技能候选'
    ]
  },


  {
    version: '1.0.7078',
    date: '2026-07-08',
    changes: [
      'Advisor 5.0 batch14: 战斗Phase4 AC Buff+穿透射击',
      'validate-advisor-combat-modifiers',
      'audit 58条 golden 39条'
    ]
  },


  {
    version: '1.0.7077',
    date: '2026-07-08',
    changes: [
      'Advisor 5.0 batch13: 熟练路线泛化任意职业',
      'parseProficiencyTargetsFromQuery',
      'audit 55条 golden 36条'
    ]
  },


  {
    version: '1.0.7076',
    date: '2026-07-08',
    changes: [
      'Advisor 5.0 batch12: 战斗Phase3斧类暴击+瞄准射击+快照Buff',
      'audit 52条 golden 33条'
    ]
  },


  {
    version: '1.0.7075',
    date: '2026-07-08',
    changes: [
      'Advisor 5.0 batch11: 反馈闭环+CI收口',
      'advisor-feedback-export+validate-advisor-5-regression',
      'audit 49条'
    ]
  },


  {
    version: '1.0.7074',
    date: '2026-07-08',
    changes: [
      'Advisor 5.0 batch10: 起始装备/种族/背景bundle+快照AC联动',
      'audit 46条 golden 30条'
    ]
  },


  {
    version: '1.0.7073',
    date: '2026-07-08',
    changes: [
      'Advisor 5.0 batch6-9: 装备检索/购点升级/背景AC/熟练反查/战斗Phase2',
      'audit 43条 golden 27条'
    ]
  },


  {
    version: '1.0.7064',
    date: '2026-07-08',
    changes: [
      '诡术士别名解析',
      '剥离进阶名防术士误判',
      'base_class_pick',
      'scope mage-only说明'
    ]
  },


  {
    version: '1.0.7063',
    date: '2026-07-08',
    changes: [
      'Advisor 4.0 batch3: advisor-tools 路线骨架',
      'outlineGrowthRoadmap',
      'validate-advisor-tools'
    ]
  },


  {
    version: '1.0.7062',
    date: '2026-07-08',
    changes: [
      'Advisor 4.0 batch2: 会话目标隔离',
      'Golden CI',
      '未收录进阶闸门',
      'advancement_primary路由'
    ]
  },


  {
    version: '1.0.7061',
    date: '2026-07-08',
    changes: [
      'Advisor 4.0 batch1: 统一进阶解析',
      '飞贼路线主职推断',
      '成长路线作答契约',
      'L0/L3 brief'
    ]
  },


  {
    version: '1.0.7060',
    date: '2026-07-08',
    changes: [
      '通用 build_roadmap 替代 kit 硬编码',
      'L2 抽样+灵活 prompt',
      '仅作参考免责声明',
      '移除预设按钮'
    ]
  },


  {
    version: '1.0.7059',
    date: '2026-07-08',
    changes: [
      '魔剑士 kit 流派校正',
      '魔弹射手 build kit',
      'validate-advisor-build-kit',
      '子职动态 L2 层'
    ]
  },


  {
    version: '1.0.7058',
    date: '2026-07-08',
    changes: [
      '面板 build 评价统一 roadmap',
      'isPanelRoadmapQuery',
      'widget 魔剑士预设',
      'roadmap max_tokens 6144'
    ]
  },


  {
    version: '1.0.7057',
    date: '2026-07-08',
    changes: [
      'Advisor 3.0 build_roadmap 魔剑士 kit',
      '分阶段路线图 prompt',
      '面板快照缺口分析',
      'validate-advisor-roadmap'
    ]
  },


  {
    version: '1.0.7056',
    date: '2026-07-08',
    changes: [
      '顾问L6 build修复:嵌套熟练度+进阶≠兼职+技能位阶过滤'
    ]
  },


  {
    version: '1.0.7055',
    date: '2026-07-08',
    changes: [
      'Advisor 2.1会话闭环:创建页气泡入history+换存档reset+Planner缓存',
      'Advisor 2.0多职业catalog/full_list+多轮对话'
    ]
  },


  {
    version: '1.0.7054',
    date: '2026-07-08',
    changes: [
      'Build Advisor 2.0：多职业检索+catalog/full_list+多轮对话',
      '新增 advisor-planner/session 模块',
      '问答 Tab 新对话按钮'
    ]
  },


  {
    version: '1.0.7053',
    date: '2026-07-08',
    changes: [
      '斯诺德对决:修复103张卡牌费用/战力与xlsx颠倒',
      '双足飞龙3费7战'
    ]
  },


  {
    version: '1.0.7052',
    date: '2026-07-07',
    changes: [
      '奇械师顾问升full(Phase5收尾/14职业全full)'
    ]
  },


  {
    version: '1.0.7051',
    date: '2026-07-07',
    changes: [
      '魔契师顾问升full(warlock_skills/宗主五风格L5)'
    ]
  },


  {
    version: '1.0.7050',
    date: '2026-07-07',
    changes: [
      '吟游诗人顾问升full(bard_skills/五风格L5)'
    ]
  },


  {
    version: '1.0.7049',
    date: '2026-07-07',
    changes: [
      '武僧顾问升full(monk_skills/七风格L5)'
    ]
  },


  {
    version: '1.0.7048',
    date: '2026-07-07',
    changes: [
      '术士起始特性三项全得修正'
    ]
  },


  {
    version: '1.0.7047',
    date: '2026-07-07',
    changes: [
      '术士顾问升full(sorcerer_skills/潜能L5)'
    ]
  },


  {
    version: '1.0.7046',
    date: '2026-07-07',
    changes: [
      '萨满祭司顾问升full(shaman_skills/元素L5)'
    ]
  },


  {
    version: '1.0.7045',
    date: '2026-07-07',
    changes: [
      '德鲁伊顾问升full(druid_skills/自然法术L5)'
    ]
  },


  {
    version: '1.0.7044',
    date: '2026-07-07',
    changes: [
      '游荡者顾问升full(rogue_skills/奇袭魔药L5)'
    ]
  },


  {
    version: '1.0.7043',
    date: '2026-07-07',
    changes: [
      '圣骑士顾问升full(paladin_skills/光耀L5/5选2起手)'
    ]
  },


  {
    version: '1.0.7042',
    date: '2026-07-07',
    changes: [
      '牧师顾问升full(cleric_skills/神术L5/起手特性)'
    ]
  },


  {
    version: '1.0.7041',
    date: '2026-07-07',
    changes: [
      '猎人顾问升full(hunter_skills/L5/装备规则)',
      'batch14验证'
    ]
  },


  {
    version: '1.0.7040',
    date: '2026-07-07',
    changes: [
      '战士顾问升full(7039)',
      '蛮斗士顾问升full(7040)',
      'build-advisor-class-full与batch12/13'
    ]
  },


  {
    version: '1.0.7039',
    date: '2026-07-07',
    changes: [
      '战士顾问升full档(L2/L5/prompt)',
      '新增build-advisor-class-full.mjs',
      '7039批次验证'
    ]
  },


  {
    version: '1.0.7038',
    date: '2026-07-07',
    changes: [
      '顾问 Phase5 收尾：全量回归19项',
      'registry/rules_summary 5-complete',
      '修复 router 重导出'
    ]
  },


  {
    version: '1.0.7037',
    date: '2026-07-07',
    changes: [
      '顾问 Phase5：14职业档位checklist audit',
      'prompt硬规则(full/partial/奇械师)',
      '塑能路由修复'
    ]
  },


  {
    version: '1.0.7036',
    date: '2026-07-07',
    changes: [
      '顾问 Phase5：13职业 L5 class_tips 风格stub(90条)',
      '复杂职业车卡policy(奇械师/魔契师/术士/双关键属性)'
    ]
  },


  {
    version: '1.0.7035',
    date: '2026-07-07',
    changes: [
      '顾问 Phase5：advancement_details 27条进阶 documented',
      'L3 进阶库扩至65条',
      '检索/catalog 可答非法师进阶技能'
    ]
  },


  {
    version: '1.0.7034',
    date: '2026-07-07',
    changes: [
      '顾问 Phase5：全14职业实体卡',
      '起手套装A-D与装备规则',
      'proficiencies classSkillPick补全',
      '检索/实体百科可答起始装备'
    ]
  },


  {
    version: '1.0.7033',
    date: '2026-07-07',
    changes: [
      '吟游诗人魔契师Tier B',
      '全14职业L2检索完成'
    ]
  },


  {
    version: '1.0.7032',
    date: '2026-07-07',
    changes: [
      '牧师圣骑士游荡者德鲁伊萨满术士Tier B partial'
    ]
  },


  {
    version: '1.0.7031',
    date: '2026-07-07',
    changes: [
      '通用L2-class框架',
      '战士蛮斗士猎人武僧Tier B partial'
    ]
  },


  {
    version: '1.0.7030',
    date: '2026-07-07',
    changes: [
      '奇械师Tier B部分支持',
      'L2-artificer技能检索',
      'partial免责声明'
    ]
  },


  {
    version: '1.0.7021',
    date: '2026-07-07',
    changes: [
      'Build顾问：通用战斗小贴士池(universal_tips)',
      '各职业hints/tips空壳',
      '非法师检索不再注入法师L2技能'
    ]
  },


  {
    version: '1.0.7020',
    date: '2026-07-07',
    changes: [
      'Build顾问：全职业创建页陪跑(Tier C)',
      '新增class_registry与关键属性购点提示',
      '奇械师标注部分支持'
    ]
  },


  {
    version: '1.0.7013',
    date: '2026-07-07',
    changes: [
      'Build顾问：L1车卡禁止提及兼职与+6熟练门槛',
      '熟练度以创建页角色概览为权威数据源，修复顾问自行计数偏差'
    ]
  },


  {
    version: '1.0.7012',
    date: '2026-07-08',
    changes: [
      'Build顾问：选满起始特性/购点后强制评价当前选择',
      '熟练账本支持完整子项名与属性协同分析',
      '确认页填写故事/外貌后触发叙事简评；修复步骤变更不同步'
    ]
  },


  {
    version: '1.0.7011',
    date: '2026-07-08',
    changes: [
      'Build顾问：车卡熟练账本+分步陪跑策略(Phase4″)',
      '修正三项专精L1均获得；魔法学派创建页不配置',
      '起始特性选满后评价组合，不推销未选项；重复熟练冒泡提醒'
    ]
  },


  {
    version: '1.0.7010',
    date: '2026-07-08',
    changes: [
      'Build顾问：创建页陪跑(Phase4′)',
      '移除独立车卡Tab，悬浮球旁冒泡显示步骤推荐',
      '点击冒泡查看完整回答；顾问只推荐不替用户填表'
    ]
  },


  {
    version: '1.0.7009',
    date: '2026-07-07',
    changes: [
      'Build顾问：实体索引+检索增强(Phase1-3)',
      '法师车卡向导Tab+背景grant校验(Phase4)',
      '向导导出/导入角色与创建页(Phase5)'
    ]
  },


  {
    version: '1.0.7008',
    date: '2026-07-08',
    changes: [
      '对决：修复篝火 roundEnd 战力加成被重算抹掉',
      '对决：修复兽栏/海港/旅馆额外槽无法部署（可点宿主本体）',
      '对决：回春术/箭袋/寒脊山脉等回合战力持久化一并修复'
    ]
  },


  {
    version: '1.0.7007',
    date: '2026-07-07',
    changes: [
      '帮助页升级规则表优化：加宽正文、头衔不换行、加成显示+1'
    ]
  },


  {
    version: '1.0.7006',
    date: '2026-07-07',
    changes: [
      '修复自动更新504：改用API+latest.yml替代GitHub HTML解析',
      'GitHub失败自动回退Gitee'
    ]
  },


  {
    version: '1.0.7005',
    date: '2026-07-07',
    changes: [
      '修复色彩标识#851321显示为无色名称',
      'Build顾问回答改为流式输出'
    ]
  },


  {
    version: '1.0.7004',
    date: '2026-07-07',
    changes: [
      '修复Build顾问fetch is not defined（Electron22 Node16兼容）'
    ]
  },


  {
    version: '1.0.7003',
    date: '2026-07-07',
    changes: [
      'CI Release内置DEEPSEEK_API_KEY(Secrets)',
      'advisor-env-bootstrap启动加载.env',
      '修复NSIS安装包Build顾问缺Key'
    ]
  },


  {
    version: '1.0.7002',
    date: '2026-07-07',
    changes: [
      '便携版内置Build顾问DeepSeek配置(熟人圈分发)',
      'embed-env-for-dist打包流程',
      'advisor-env多路径加载exe同目录.env'
    ]
  },


  {
    version: '1.0.7001',
    date: '2026-07-07',
    changes: [
      'Build Advisor法师顾问(Electron悬浮球+侧滑问答+进阶浏览)',
      'L0-L6知识库与DeepSeek接入',
      '角色快照进阶达标检测',
      '打包含advisor/scripts运行时'
    ]
  },


  {
    version: '1.0.6128',
    date: '2026-07-06',
    changes: [
      '修复单位装备槽:武器/防具独立extra slot',
      '短柄斧/三叉戟/板甲/渔网正确挂载显示',
      '宿主摧毁装备进弃牌堆',
      '禁止替换',
      '单机/联机/AI同步'
    ]
  },


  {
    version: '1.0.6127',
    date: '2026-07-06',
    changes: [
      '新增 xlsx_proficiency_export.js 统一 G 列熟练度导出',
      '上传页/创建页/角色面板共用 E 列标签映射',
      'panel_engine 复用共享模块',
      'tests T12 熟练度导出'
    ]
  },


  {
    version: '1.0.6124',
    date: '2026-07-06',
    changes: [
      '上传角色页接入26.06.30技能点(sp_points+color_marks)',
      '弹窗简化为经验值与技能点两栏',
      '旧xlsx U51颜色字串自动求和迁移',
      '角色创建页存档与导出同步'
    ]
  },


  {
    version: '1.0.6123',
    date: '2026-07-06',
    changes: [
      '修复学习技能面板法师塑能/咒法被拆成两组的问题',
      '统一技能风格命名(塑能风格→塑能)并规范化战士起始技能',
      'build_panel_skill_data与panel_engine增加canonicalSkillStyle'
    ]
  },


  {
    version: '1.0.6122',
    date: '2026-07-06',
    changes: [
      '修复xlsx导出4级特殊专长显示object Object',
      '修复运动员背景特性未导出',
      '三阶天赋行位上移并清空旧槽位',
      'tests扩展至92项'
    ]
  },


  {
    version: '1.0.6121',
    date: '2026-07-06',
    changes: [
      '优化角色面板技能点/色彩标识展示',
      '修复测试加点弹窗切换标识时自动关闭',
      '修复xlsx导出天赋按阶位填行错位',
      'tests扩展至90项'
    ]
  },


  {
    version: '1.0.6120',
    date: '2026-07-06',
    changes: [
      '修复xlsx导出：防具为对象时AC计算报错'
    ]
  },


  {
    version: '1.0.6119',
    date: '2026-07-06',
    changes: [
      '修复兼职熟练度判定：多属性/多技能求和，战士力量或敏捷条件',
      '修复xlsx导出：CompressionStream不可用时回退未压缩存储',
      'xlsx导出失败弹窗显示具体错误原因',
      '角色面板移除导入/导出全部存档按钮',
      '导出xlsx按钮移至学习技能旁',
      'tests扩展至84项'
    ]
  },


  {
    version: '1.0.6118',
    date: '2026-07-06',
    changes: [
      '角色面板26.06.30技能点与色彩标识系统(sp_points+color_marks+无色/炫彩wildcard)',
      '移除旧14色SP弹窗',
      '学习/卸载/替换流程接入payForSkill',
      'tests扩展至75项',
      '技能标识授予效果由DM桌面团结算(面板待办)'
    ]
  },


  {
    version: '1.0.6117',
    date: '2026-07-06',
    changes: [
      '修复学习技能面板通用天赋树按阶位分组(重建panel_data时恢复tier)'
    ]
  },


  {
    version: '1.0.6116',
    date: '2026-07-06',
    changes: [
      'JSON同步写入field_runs与description_entries彩色元数据',
      '角色面板技能详情/预览支持彩色●标识',
      '新增build_panel_skill_data.py从职业JSON重建panel_data.js'
    ]
  },


  {
    version: '1.0.6115',
    date: '2026-07-05',
    changes: [
      'Bug反馈按钮恢复右侧居中，避免与启动台/筛选面板重叠'
    ]
  },


  {
    version: '1.0.6114',
    date: '2026-07-05',
    changes: [
      '修复技能描述内联色彩标识●未着色（如冥想●/●/●）',
      '全职业页重新同步 docx 彩色 runs',
      '新增 scan_plain_dots 与 run_all_class_syncs 脚本'
    ]
  },


  {
    version: '1.0.6113',
    date: '2026-07-05',
    changes: [
      '职业页：新增悬浮筛选面板(关键词+色彩标识)',
      '职业页：技能卡片注入 data-tags/data-marks 筛选属性'
    ]
  },


  {
    version: '1.0.6112',
    date: '2026-07-05',
    changes: [
      '职业页：修复德鲁伊棕熊形态数据块缺失',
      '职业页：修复圣骑士驱邪术/特殊专长隐伏者与随手投掷描述污染',
      '职业页：修复战士瞄准射击天赋树 boilerplate',
      'Bug反馈：修复浏览器端 ntfy 请求头编码错误'
    ]
  },


  {
    version: '1.0.6111',
    date: '2026-07-05',
    changes: [
      '联机：短柄斧/三叉戟宿主部署可选目标',
      '联机：激励乐章/速攻法术揭示与D6加成修复',
      '联机：广播历史跨回合保留'
    ]
  },


  {
    version: '1.0.6110',
    date: '2026-07-05',
    changes: [
      '技能树同步至26.06.30最新技能标识规则(费用→标识)',
      '13个基础职业+通用天赋树+特殊专长HTML/JSON/FX已更新',
      '新增职业页同步脚本与同步手册'
    ]
  },


  {
    version: '1.0.6109',
    date: '2026-07-05',
    changes: [
      '牌局显示己方/对手费用与总战力',
      '顶部状态栏与玩家面板同步展示'
    ]
  },


  {
    version: '1.0.6108',
    date: '2026-07-05',
    changes: [
      'BGM(HALL1/Battle1/END1)循环+设置页音量滑条默认70%',
      '联机房主手动开始',
      '对手手牌仅显示数量',
      '牌局页滚动修复'
    ]
  },


  {
    version: '1.0.6107',
    date: '2026-07-05',
    changes: [
      '联机大厅移除配置服务器按钮',
      '服务器地址自动检测连接'
    ]
  },


  {
    version: '1.0.6106',
    date: '2026-07-05',
    changes: [
      '卡组构筑筛选侧栏默认收起',
      '音效全局降低10dB(snd.js+sound.ts)'
    ]
  },


  {
    version: '1.0.6105',
    date: '2026-07-05',
    changes: [
      '手牌悬停右键显示卡牌效果详情',
      'AI对手区域默认展开',
      'AI场上卡牌可查看详情'
    ]
  },


  {
    version: '1.0.6104',
    date: '2026-07-05',
    changes: [
      'CC0样本音效替换跑团UI合成(snd.js+audio/ui)',
      '卡组编辑加入移出保存错误音效',
      '跑团与扑克共用_snowd_mute',
      'sound-manifest与audio-licenses文档'
    ]
  },


  {
    version: '1.0.6103',
    date: '2026-07-05',
    changes: [
      '筛选展开按钮上移避开通用Bug按钮'
    ]
  },


  {
    version: '1.0.6102',
    date: '2026-07-05',
    changes: [
      '卡组筛选改悬浮窗',
      '滚动可用',
      '可收起'
    ]
  },


  {
    version: '1.0.6101',
    date: '2026-07-05',
    changes: [
      '卡组构筑筛选侧栏',
      '类别属性关键词',
      '费用战力排序'
    ]
  },


  {
    version: '1.0.6100',
    date: '2026-07-05',
    changes: [
      '卡组构筑右键加入',
      '15张校验',
      '进局拦截'
    ]
  },


  {
    version: '1.0.6099',
    date: '2026-07-05',
    changes: [
      '联机大厅显示卡组名称',
      '联机大厅可切换已保存卡组栏位'
    ]
  },


  {
    version: '1.0.6098',
    date: '2026-07-05',
    changes: [
      '恢复米色背景主题',
      '保留新UI组件布局'
    ]
  },


  {
    version: '1.0.6097',
    date: '2026-07-05',
    changes: [
      '深色牌桌UI重构(P0-P4)',
      '单机/联机共用GameCard与ActionDock',
      '对手区可折叠',
      '主页/卡组/大厅统一暗色主题'
    ]
  },


  {
    version: '1.0.6096',
    date: '2026-07-05',
    changes: [
      '揭示阶段费用不足退回手牌时不退还费用'
    ]
  },


  {
    version: '1.0.6095',
    date: '2026-07-05',
    changes: [
      '修复AI揭示时机',
      '联机延迟揭示与按序费用结算',
      '费用不足退回手牌'
    ]
  },


  {
    version: '1.0.6094',
    date: '2026-07-05',
    changes: [
      '修复出牌后仍可重铸',
      '统一战力计算含额外槽位',
      '回合过渡期间禁止决策'
    ]
  },


  {
    version: '1.0.6093',
    date: '2026-07-05',
    changes: [
      '广播下拉面板与历史记录',
      '法师塔每回合额外魔法战术'
    ]
  },


  {
    version: '1.0.6092',
    date: '2026-07-05',
    changes: [
      '海洋德鲁伊回合开始效果',
      '出牌重铸返回选择',
      '海港可部署帆船'
    ]
  },


  {
    version: '1.0.6091',
    date: '2026-07-05',
    changes: [
      '卡组管理:命名栏位保存与切换(最多10套)',
      '旧账户自动迁移为默认卡组'
    ]
  },


  {
    version: '1.0.6090',
    date: '2026-07-05',
    changes: [
      '修复AI揭示动画前过早清除隐藏牌导致卡背消失'
    ]
  },


  {
    version: '1.0.6089',
    date: '2026-07-05',
    changes: [
      '修复单机AI隐藏牌在对应部署槽显示卡背而非空槽'
    ]
  },


  {
    version: '1.0.6088',
    date: '2026-07-05',
    changes: [
      '摧毁动画(闪红碎裂空槽弹跳)',
      '选格/选目标脉冲与非法点击shake',
      '回合阶段横幅',
      '场上战力数字变化脉冲'
    ]
  },


  {
    version: '1.0.6087',
    date: '2026-07-05',
    changes: [
      'P0抽牌动画与战斗飘字(战力/费用/摧毁)',
      'P1战术淡出与QuickPlay缩入宿主',
      'P1重铸换牌飞行动画',
      '联机动画队列与短暂状态滞后',
      '音效待定见ANIMATION_TODO'
    ]
  },


  {
    version: '1.0.6086',
    date: '2026-07-05',
    changes: [
      '联机飞牌/翻牌动画',
      '单机AI揭示翻转'
    ]
  },


  {
    version: '1.0.6085',
    date: '2026-07-05',
    changes: [
      '炉石式出牌/重铸飞牌动画',
      '首页设置页可跳过动画'
    ]
  },


  {
    version: '1.0.6084',
    date: '2026-07-05',
    changes: [
      '单机3/4人局改为单列滚动布局，每行一个AI场地'
    ]
  },


  {
    version: '1.0.6083',
    date: '2026-07-05',
    changes: [
      '场上卡牌悬停详情自动吸附视口内',
      '卡组页进入即可见148张卡池',
      '最后一回合场地已满禁止重铸、战术牌直出逻辑',
      '单机决策按钮布局优化'
    ]
  },


  {
    version: '1.0.6082',
    date: '2026-07-05',
    changes: [
      'ESC replace直达启动台',
      '修复单机部署后无法结束回合',
      '场上卡牌悬停/点击查看效果',
      '单机开局人数选择面板'
    ]
  },


  {
    version: '1.0.6081',
    date: '2026-07-05',
    changes: [
      '修复单机部署格点击无效',
      '卡组页滚动与自动保存',
      '2-4人牌桌滚动布局',
      '联机3+人准备/决策逻辑'
    ]
  },


  {
    version: '1.0.6080',
    date: '2026-07-05',
    changes: [
      '卡组管理页148张卡池替换与详情弹窗',
      'ESC按层级返回而非浏览器历史'
    ]
  },


  {
    version: '1.0.6079',
    date: '2026-07-05',
    changes: [
      '修复Electron启动台斯诺德对决链接白屏(chrome-error)'
    ]
  },


  {
    version: '1.0.6078',
    date: '2026-07-05',
    changes: [
      '斯诺德对决已完成，用户可进行游戏测试逻辑是否正确',
      '首页米色背景/卡组按钮仅留首页',
      '全量验证脚本verify-full.mjs'
    ]
  },


  {
    version: '1.0.6077',
    date: '2026-07-04',
    changes: [
      '5E终批: 旗鱼/矮人烈酒结构化 148/148完成'
    ]
  },


  {
    version: '1.0.6076',
    date: '2026-07-04',
    changes: [
      'P0盖牌批次引擎: resolveRevealBatch/batchHighestFreeDeploy/矮人烈酒机制'
    ]
  },


  {
    version: '1.0.6075',
    date: '2026-07-04',
    changes: [
      '5D:14张P1卡结构化(箭袋至冰锥术)'
    ]
  },


  {
    version: '1.0.6074',
    date: '2026-07-04',
    changes: [
      'P1机制引擎:充能/scry/回春/封锁/出牌限制/分支/复制/牺牲'
    ]
  },


  {
    version: '1.0.6073',
    date: '2026-07-04',
    changes: [
      '5C:急先锋·罗森弗斯 autoEnterFromZone',
      '巨鹏 absorbLeftPlayerUnit',
      '走私船 stashHandUnderSelf'
    ]
  },


  {
    version: '1.0.6072',
    date: '2026-07-04',
    changes: [
      '征募官',
      '强盗',
      '攀爬工具'
    ]
  },


  {
    version: '1.0.6071',
    date: '2026-07-04',
    changes: [
      '雪怪',
      '寒铁虎',
      '间歇泉'
    ]
  },


  {
    version: '1.0.6070',
    date: '2026-07-04',
    changes: [
      '牛头人勇士',
      '火蜥蜴',
      '雪狼'
    ]
  },


  {
    version: '1.0.6069',
    date: '2026-07-04',
    changes: [
      '温馨的旅馆',
      '哥布林杂兵',
      '狂战士'
    ]
  },


  {
    version: '1.0.6068',
    date: '2026-07-04',
    changes: [
      '卡牌效果批次4X',
      '板甲/三叉戟/攀岩爱好者',
      '宿主部署加成'
    ]
  },


  {
    version: '1.0.6067',
    date: '2026-07-04',
    changes: [
      '卡牌效果批次4W',
      '洋葱/渔网/短柄斧',
      'deployOnHostOnly扩展'
    ]
  },


  {
    version: '1.0.6066',
    date: '2026-07-04',
    changes: [
      '卡牌效果批次4V',
      '玉米/胡萝卜/卷心菜',
      'deployOnHostOnly引擎'
    ]
  },


  {
    version: '1.0.6065',
    date: '2026-07-04',
    changes: [
      '卡牌效果批次4U',
      '红宝石/蓝宝石/绿宝石',
      'setPowerIfFieldKeyword+HandNames'
    ]
  },


  {
    version: '1.0.6064',
    date: '2026-07-04',
    changes: [
      '卡牌效果批次4T',
      '食人魔/纪念照/金矿',
      'unplayable+onGameEnd引擎'
    ]
  },


  {
    version: '1.0.6063',
    date: '2026-07-04',
    changes: [
      '卡牌效果批次4S:礁石/兽栏/荒野',
      'crossPlayerDeploy跨玩家部署引擎'
    ]
  },


  {
    version: '1.0.6062',
    date: '2026-07-04',
    changes: [
      '卡牌效果批次4R:搬运工/锻炉/贫民窟',
      'deployFromHand+onReforge+debuffAheadPlayers'
    ]
  },


  {
    version: '1.0.6061',
    date: '2026-07-04',
    changes: [
      '卡牌效果批次4Q:蛮斗士/蛇颈龙/仲夏节庆典',
      'grantUntargetable+requireNoTacticsInDeck'
    ]
  },


  {
    version: '1.0.6060',
    date: '2026-07-04',
    changes: [
      '卡牌效果批次4P:武僧/溪流/帆船',
      'playRequirement+searchFromHandOrDeck+triggerPlayedCardType'
    ]
  },


  {
    version: '1.0.6059',
    date: '2026-07-04',
    changes: [
      '斯诺德对决4O：猎人/游客/药剂师',
      'grantTacticPlayFree/modifyPowerByUniqueAttributes',
      'test-4o 9/9'
    ]
  },


  {
    version: '1.0.6058',
    date: '2026-07-04',
    changes: [
      '斯诺德对决4N：奴隶/蔓生怪/珊瑚元素',
      'conditionalPlayCost/requireAllFieldAttributes',
      'test-4n 9/9'
    ]
  },


  {
    version: '1.0.6057',
    date: '2026-07-04',
    changes: [
      '斯诺德对决4M：萨满祭司/珍珠商人/海港',
      'grantAttributePlayBonus/setD6MinForCardName/createSlot',
      'test-4m 13/13'
    ]
  },


  {
    version: '1.0.6056',
    date: '2026-07-04',
    changes: [
      '斯诺德对决部署引擎：额外槽位规则',
      'grantAttributePlayBonus/setD6MinForCardName',
      'test-deploy-engine 18/18'
    ]
  },


  {
    version: '1.0.6055',
    date: '2026-07-04',
    changes: [
      '卡牌效果4L：海葵/翻车鱼/拾贝鱼人',
      '引擎countMatchingFieldCards+buffPlayedCard'
    ]
  },


  {
    version: '1.0.6054',
    date: '2026-07-04',
    changes: [
      '卡牌效果4K：奶牛/螃蟹/退役老兵',
      '引擎requireFieldName+条件自增'
    ]
  },


  {
    version: '1.0.6053',
    date: '2026-07-04',
    changes: [
      '引擎债：环境摧毁/最后一轮限制/unitPlayPowerBonus清除',
      '游戏结束固定浮层返回按钮',
      '场上卡牌悬停效果详情'
    ]
  },


  {
    version: '1.0.6052',
    date: '2026-07-04',
    changes: [
      '卡牌效果4J：海鸥/精准射击/气泡酒',
      '引擎 stealCard+destroy+grantUnitPlayBonus'
    ]
  },


  {
    version: '1.0.6051',
    date: '2026-07-04',
    changes: [
      '卡牌效果4I：葡萄酒商人/魔法飞弹/暴徒',
      '引擎 targetLeftPlayer+noHigherPowerUnitOnField'
    ]
  },


  {
    version: '1.0.6050',
    date: '2026-07-04',
    changes: [
      '卡牌效果4H：酒吧女招待/杂货铺/燃烧之手',
      '引擎 searchEachKeyword+debuffOpponentHand'
    ]
  },


  {
    version: '1.0.6049',
    date: '2026-07-04',
    changes: [
      '卡牌效果4G：贝壳/晴天/沙滩'
    ]
  },


  {
    version: '1.0.6048',
    date: '2026-07-04',
    changes: [
      '卡牌效果4F：吟游诗人/风笛/激励乐章',
      '单机round触发修复'
    ]
  },


  {
    version: '1.0.6047',
    date: '2026-07-04',
    changes: [
      '卡牌效果4E：季风modifyPlayCost/篝火roundEnd/垂钓客d6Min'
    ]
  },


  {
    version: '1.0.6046',
    date: '2026-07-04',
    changes: [
      '4D: 德鲁伊/射击俱乐部/寒脊山脉 roundStart/End',
      'applyRoundEffect 引擎'
    ]
  },


  {
    version: '1.0.6045',
    date: '2026-07-04',
    changes: [
      '4C: 休憩曲/祈福/炎炎夏日 onDeploy',
      '战术牌 deploy 流程修复'
    ]
  },


  {
    version: '1.0.6044',
    date: '2026-07-04',
    changes: [
      '4B: 收获日/雷云召来/报警机器人 onReveal',
      '4A: 野猪/见习冒险者/农田/铁匠铺',
      '阶段0: card-seed 148张同步'
    ]
  },


  {
    version: '1.0.6042',
    date: '2026-07-04',
    changes: [
      'batch 2: generic onOtherPlay handler + 3 element cards (水元素/火元素/土元素)'
    ]
  },


  {
    version: '1.0.6041',
    date: '2026-07-04',
    changes: [
      'effect batch 1: modifyPower conversion 8 cards (狗头人冒险者/棕熊/圣洁骑士/森林/大海/荒野/蓝焰术/气泡酒) + engine 单位 handler'
    ]
  },


  {
    version: '1.0.6040',
    date: '2026-07-04',
    changes: [
      'engine upgrade #6: stealPower + stealCard',
      '野猪人劫匪 + 海鸥 (all 6 engine upgrades complete)'
    ]
  },


  {
    version: '1.0.6039',
    date: '2026-07-04',
    changes: [
      'engine upgrade #5: rollD6 utility + 4 D6 cards (垂钓客/贝壳/吟游诗人/激励乐章)'
    ]
  },


  {
    version: '1.0.6039',
    date: '2026-07-04',
    changes: [
      'engine upgrade #5: rollD6 utility + 4 D6 cards (垂钓客/贝壳/吟游诗人/激励乐章)'
    ]
  },


  {
    version: '1.0.6038',
    date: '2026-07-04',
    changes: [
      'engine upgrade #4: triggerRoundEffects roundStart/roundEnd',
      '16 card timing fixes (arrow/quiver, seaweed, druid, fisherman, ocean druid, fire lizard, minotaur, vanguard, shooting club, astral tower, geyser — roundStart',
      'campfire, tavern, cozy inn, frost mountain, rejuvenation — roundEnd)'
    ]
  },


  {
    version: '1.0.6037',
    date: '2026-07-04',
    changes: [
      'engine upgrade #3 complete: deploy-onto-card + all 15 quickPlay cards (37/151, 24.5%)'
    ]
  },


  {
    version: '1.0.6035',
    date: '2026-07-03',
    changes: [
      'engine upgrade #3c: returnToDeckBottom + setNextUnitAttribute + markOpponentHand',
      'cards: 奥术箭 + 元素墙 + 牛奶 + 创造水源 + 火焰箭 (31/151, 20.5%)'
    ]
  },


  {
    version: '1.0.6034',
    date: '2026-07-03',
    changes: [
      'engine upgrade #3b: reduceUnitPower + discardOpponentHand',
      'cards: 急速射击 + 奇袭 (26/151)'
    ]
  },


  {
    version: '1.0.6034',
    date: '2026-07-03',
    changes: [
      'engine upgrade #3b: reduceUnitPower + discardOpponentHand',
      'cards: 急速射击 + 奇袭 (26/151)'
    ]
  },


  {
    version: '1.0.6033',
    date: '2026-07-03',
    changes: [
      'engine upgrade #3a: quickPlay gate + restoreEnergy + modifyPowerByName',
      'cards: 活力药水 + 真气波 (24/151)'
    ]
  },


  {
    version: '1.0.6032',
    date: '2026-07-02',
    changes: [
      '修复——返回启动台左上角+gameOver退出+多人退出'
    ]
  },


  {
    version: '1.0.6031',
    date: '2026-07-02',
    changes: [
      '引擎升级#2——检索/抽牌(searchDeck)+4卡转换'
    ]
  },


  {
    version: '1.0.6030',
    date: '2026-07-02',
    changes: [
      '引擎升级#1——属性匹配(targetAttributes)+5卡转换'
    ]
  },


  {
    version: '1.0.6025',
    date: '2026-07-02',
    changes: [
      '效果第3批收尾——剩余conditional卡待引擎升级后实现'
    ]
  },


  {
    version: '1.0.6024',
    date: '2026-07-02',
    changes: [
      '效果3d——4张createSlot(摄像机/鲈鱼/酒馆/法师塔)'
    ]
  },


  {
    version: '1.0.6023',
    date: '2026-07-02',
    changes: [
      '效果3c——集群战术/蓝焰术onReveal'
    ]
  },


  {
    version: '1.0.6022',
    date: '2026-07-02',
    changes: [
      '效果3b——摧毁引擎+护甲药水+力场波'
    ]
  },


  {
    version: '1.0.6021',
    date: '2026-07-01',
    changes: [
      '斯诺德对决大部分功能实现但未测试，用户可以测试并提出反馈意见，以及151张卡牌的效果只实现了部分，请等待后续更新'
    ]
  },


  {
    version: '1.0.6020',
    date: '2026-07-01',
    changes: [
      '效果3a——沙滩碉堡protect'
    ]
  },


  {
    version: '1.0.6019',
    date: '2026-07-01',
    changes: [
      '效果2d——马车+海藻简单名称匹配'
    ]
  },


  {
    version: '1.0.6018',
    date: '2026-07-01',
    changes: [
      '效果2c——复合关键词引擎+蜥蜴人勇士+森林'
    ]
  },


  {
    version: '1.0.6017',
    date: '2026-07-01',
    changes: [
      '效果2b-落魄男爵stackable计数+引擎修复+Playwright验证'
    ]
  },


  {
    version: '1.0.6016',
    date: '2026-07-01',
    changes: [
      '效果框架——条件自改战力(狗头人冒险者/圣洁骑士)'
    ]
  },


  {
    version: '1.0.6015',
    date: '2026-07-01',
    changes: [
      '效果第1批——6张modifyPower结构化(元素/大海/热带鱼/挤奶工)'
    ]
  },


  {
    version: '1.0.6014',
    date: '2026-07-01',
    changes: [
      '联机grid布局+最终轮限制+负数能量框架'
    ]
  },


  {
    version: '1.0.6013',
    date: '2026-07-01',
    changes: [
      '账号系统+151卡池+自定义牌组+注册/组牌UI'
    ]
  },


  {
    version: '1.0.7000',
    date: '2026-07-01',
    changes: [
      '账号系统+151卡池+自定义牌组+SQLite数据库+注册/组牌UI'
    ]
  },


  {
    version: '1.0.6012',
    date: '2026-07-01',
    changes: [
      '单机模式加入数选择器2/3/4'
    ]
  },


  {
    version: '1.0.6011',
    date: '2026-07-01',
    changes: [
      '修复lobby人数显示/2→maxPlayers动态'
    ]
  },


  {
    version: '1.0.6010',
    date: '2026-07-01',
    changes: [
      'N-player架构——3-4人支持+grid布局+最终轮限制'
    ]
  },


  {
    version: '1.0.6008',
    date: '2026-06-30',
    changes: [
      '彻底移除首页bg-cover残留'
    ]
  },


  {
    version: '1.0.6007',
    date: '2026-06-30',
    changes: [
      'UI修复——首页纯色背景+战力颜色可读+重铸溢出'
    ]
  },


  {
    version: '1.0.6006',
    date: '2026-06-30',
    changes: [
      '修复解散房间leaveRoom未解构'
    ]
  },


  {
    version: '1.0.6005',
    date: '2026-06-30',
    changes: [
      '修复——退出/解散/返回启动台/ESC快捷键/多人缩放'
    ]
  },


  {
    version: '1.0.6004',
    date: '2026-06-30',
    changes: [
      '修复联机页白色文字在cream背景下不可见'
    ]
  },


  {
    version: '1.0.6003',
    date: '2026-06-30',
    changes: [
      '修复自动更新版本号+hash路由白屏'
    ]
  },


  {
    version: '1.0.6002',
    date: '2026-06-30',
    changes: [
      '修复Electron file://白屏——hash路由+去除crossorigin'
    ]
  },


  {
    version: '1.0.6001',
    date: '2026-06-30',
    changes: [
      'poker-game集成——斯诺德对决+联机对战+风格统一+缩放修复'
    ]
  },


  {
    version: '1.0.5186',
    date: '2026-06-29',
    changes: [
      '火焰四阶4技能docx对照——熔岩喷溅+火焰新星+火镰图腾+余烬抗性'
    ]
  },


  {
    version: '1.0.5185',
    date: '2026-06-29',
    changes: [
      '火焰全13技能费用颜色还原docx真值——修正此前脚本误提取错误'
    ]
  },


  {
    version: '1.0.5184',
    date: '2026-06-29',
    changes: [
      '火焰一阶3处修正——空白位置+费用色同步docx'
    ]
  },


  {
    version: '1.0.5183',
    date: '2026-06-29',
    changes: [
      '萨满祭司火焰三阶4技能docx对照修正——费用色/距离/时长/疲劳同步'
    ]
  },


  {
    version: '1.0.5182',
    date: '2026-06-29',
    changes: [
      '萨满祭司火焰二阶5技能docx对照修正——费用色/距离/时长/描述同步'
    ]
  },


  {
    version: '1.0.5181',
    date: '2026-06-24',
    changes: [
      '退出取消保存显式跳转'
    ]
  },


  {
    version: '1.0.5180',
    date: '2026-06-24',
    changes: [
      '兼职熟练度Math.max→求和'
    ]
  },


  {
    version: '1.0.5179',
    date: '2026-06-24',
    changes: [
      '种族体型选择器:中型+2HP'
    ]
  },


  {
    version: '1.0.5178',
    date: '2026-06-24',
    changes: [
      '兼职熟练度去重+豁免排除'
    ]
  },


  {
    version: '1.0.5177',
    date: '2026-06-24',
    changes: [
      '兼职熟练度检测_underAttr未赋值_pv修复'
    ]
  },


  {
    version: '1.0.5176',
    date: '2026-06-24',
    changes: [
      'chooseAttr修复:finalizeLevelUp→applyLevelUp'
    ]
  },


  {
    version: '1.0.5175',
    date: '2026-06-24',
    changes: [
      '升级流程state.profs空引用阻塞修复'
    ]
  },


  {
    version: '1.0.5174',
    date: '2026-06-24',
    changes: [
      '特殊专长选择关闭后允许重试'
    ]
  },


  {
    version: '1.0.5173',
    date: '2026-06-24',
    changes: [
      'xlsx豁免导出复合key修复'
    ]
  },


  {
    version: '1.0.5172',
    date: '2026-06-24',
    changes: [
      'CLS_OVERRIDE补全豁免字段修复游荡者等职业'
    ]
  },


  {
    version: '1.0.5171',
    date: '2026-06-24',
    changes: [
      '人类自由熟练度过滤大类仅显示子项'
    ]
  },


  {
    version: '1.0.5170',
    date: '2026-06-24',
    changes: [
      'F2快捷键清理卡死overlay应急修复'
    ]
  },


  {
    version: '1.0.5169',
    date: '2026-06-24',
    changes: [
      '语言选择器暗色模式视觉反馈修复'
    ]
  },


  {
    version: '1.0.5168',
    date: '2026-06-24',
    changes: [
      '存档页+选择页单项删除按钮(含确认)'
    ]
  },


  {
    version: '1.0.5167',
    date: '2026-06-24',
    changes: [
      '学习技能面板二次打开修复:style.display残留'
    ]
  },


  {
    version: '1.0.5166',
    date: '2026-06-24',
    changes: [
      'saveCharacter天赋判断增强:SKILL_TIER查表+预知梦等已知天赋硬编码'
    ]
  },


  {
    version: '1.0.5165',
    date: '2026-06-24',
    changes: [
      'xlsx装备导出修正:写入I列标签+K列物品名'
    ]
  },


  {
    version: '1.0.5164',
    date: '2026-06-24',
    changes: [
      '测试加点悬浮面板:XP/SP加减按钮+数值输入+点击外部关闭'
    ]
  },


  {
    version: '1.0.5163',
    date: '2026-06-24',
    changes: [
      '属性豁免布尔改数值(0无/1+有)+渲染显示数字+导出正确值'
    ]
  },


  {
    version: '1.0.5162',
    date: '2026-06-24',
    changes: [
      'autoCalcStyles风格递增修复(4格全满才跳过)'
    ]
  },


  {
    version: '1.0.5161',
    date: '2026-06-24',
    changes: [
      'xlsx导出起始特性补全字段+SKILL_DATA回退查表'
    ]
  },


  {
    version: '1.0.5160',
    date: '2026-06-24',
    changes: [
      'xlsx导出豁免false不填+装备写入单元格'
    ]
  },


  {
    version: '1.0.5159',
    date: '2026-06-24',
    changes: [
      '面板熟练项暗色模式CSS变量适配'
    ]
  },


  {
    version: '1.0.5158',
    date: '2026-06-24',
    changes: [
      '页面切换overlay清理防止文本框无法交互'
    ]
  },


  {
    version: '1.0.5157',
    date: '2026-06-23',
    changes: [
      '角色创建页悬浮概览面板(职业/种族/属性/HP-FP/熟练项来源)+语言选择器视觉反馈+职业切换起始特性重置+CLS_OVERRIDE全14职业公式对照REF_CLASSES修正+人类自由熟练度BG_SKILL_MAP匹配修复+xlsx导出背景熟练项补全'
    ]
  },


  {
    version: '1.0.5156',
    date: '2026-06-23',
    changes: [
      '电子更新检查修复:版本号同步'
    ]
  },


  {
    version: '1.0.5155',
    date: '2026-06-23',
    changes: [
      'xlsx导出修复(背景字段G15+H16-30补全+E列标签解析写入熟练值+ArrayBuffer有效性检查+EOCD保护)',
      '人类种族中庸特性自由熟练度选择UI',
      '萨满祭司起始特性+风暴一二三阶+火焰一阶共28技能docx对照修正',
      'skill_effects萨满祭司录入'
    ]
  },


  {
    version: '1.0.5154',
    date: '2026-06-23',
    changes: [
      '圣骑士全职业docx对照修正完成:惩戒(14)+守护(13)+圣洁(13)+热诚(14)+起始特性(5)共59技能',
      '费用dot颜色+持续时间+描述逐段对比全流程修正',
      'skill_effects录入',
      'nav补链'
    ]
  },


  {
    version: '1.0.5153',
    date: '2026-06-22',
    changes: [
      '术士职业技能树全流程完成：起始特性3技能+一~五阶42技能docx对照修正，含Phase2B JSON同步+Phase5 skill_effects新建；修复魔力恩赐/魔力萦绕数据污染'
    ]
  },


  {
    version: '1.0.5152',
    date: '2026-06-22',
    changes: [
      '修复附魔六阶8技能在section修复时被截断丢失——从data JSON批量重建'
    ]
  },


  {
    version: '1.0.5151',
    date: '2026-06-22',
    changes: [
      '修复法师8风格section全部位于content区外导致被导航遮挡——起始特性未正确关闭'
    ]
  },


  {
    version: '1.0.5150',
    date: '2026-06-22',
    changes: [
      '法师职业技能树全8风格docx对照修正完成：塑能/咒法/预言/防护/附魔/死灵/幻术/变化共约300+技能，含Phase1B新建附魔六阶9技能+幻术五阶8技能+幻术六阶7技能+变化一~四阶78技能；修复6处导航section错位；新增工作规则§7.7 §7.8、SKILL.md §E导航验证强制规则；修复战士天鹅湖之匕data-search污染'
    ]
  },


  {
    version: '1.0.5141',
    date: '2026-06-21',
    changes: [
      '修复法师附魔六阶section错位导致导航跳转异常；修复战士天鹅湖之匕data-search属性被HTML污染'
    ]
  },


  {
    version: '1.0.5140',
    date: '2026-06-21',
    changes: [
      '法师职业树附魔风格全六阶技能文本修正与补充；修复附魔前四阶data JSON同步遗漏(活灵术施展时间)；附魔五阶八技能全流程完成(HTML+JSON+skill_effects+线上验证)；附魔六阶九技能从docx全新创建(HTML+nav+data+fx+线上验证)'
    ]
  },


  {
    version: '1.0.5135',
    date: '2026-06-17',
    changes: [
      '对照docx全面修正战士全7风格109技能HTML字段(92处错误+109处去重)+结构化JSON'
    ]
  },


  {
    version: '1.0.5136',
    date: '2026-06-18',
    changes: [
      '对照docx全面修正法师塑能风格62技能HTML字段+去重',
      '对照docx全面修正法师咒法风格43技能HTML字段+去重',
      '新增法师塑能六阶/咒法六阶技能HTML（原缺失）',
      '法师skill_effects结构化JSON同步至113技能',
      '修正skill_effects中sp颜色名称对齐panel_engine.js（青→蓝/蓝→浅色共52处）',
      'SKILL.md工作流完善：Phase 1B整阶缺失处理+Phase 2B数据JSON同步+颜色验证脚本'
    ]
  },


  {
    version: '1.0.5134',
    date: '2026-06-17',
    changes: [
      '镜像下载升级为镜像自动更新——Electron内走generic feed自动下载安装'
    ]
  },


  {
    version: '1.0.5133',
    date: '2026-06-17',
    changes: [
      '优化镜像下载为智能获取——自动拉取最新exe直链并触发下载（无需访问GitHub页面）'
    ]
  },


  {
    version: '1.0.5132',
    date: '2026-06-17',
    changes: [
      '恢复镜像下载按钮——替代Gitee为GitHub Releases直链（jsDelivr CDN加速可用）'
    ]
  },


  {
    version: '1.0.5131',
    date: '2026-06-17',
    changes: [
      '对照docx修正吟游诗人四阶全5风格23处字段错误(舒缓6+灵动3+诙谐7+集中7)'
    ]
  },


  {
    version: '1.0.5130',
    date: '2026-06-16',
    changes: [
      '对照docx修正吟游诗人四阶技能——飞鹰颂+风精灵之爪+士气如虹+潮汐进行曲+防护箭矢共9处字段错误'
    ]
  },


  {
    version: '1.0.5129',
    date: '2026-06-16',
    changes: [
      '对照docx修正吟游诗人防护箭矢——持续时间立即→1轮、距离12米→自身、补描述段落'
    ]
  },


  {
    version: '1.0.5128',
    date: '2026-06-16',
    changes: [
      '清除UTF-8 BOM修复CI构建JSON parse失败'
    ]
  },


  {
    version: '1.0.5127',
    date: '2026-06-16',
    changes: [
      '移除武僧金刚震+酒即大道大量污染(玄武式/磐石功/凰火风格/我心如火等误混入)'
    ]
  },


  {
    version: '1.0.5126',
    date: '2026-06-16',
    changes: [
      '对照docx修正战士逆境强化——施展时间1动作→-、施展距离近战→自身'
    ]
  },


  {
    version: '1.0.5125',
    date: '2026-06-16',
    changes: [
      '对照docx重构术士瞬刻时机+修复四阶技能被吞(补4个缺失skill article+4个nav链接)'
    ]
  },


  {
    version: '1.0.5124',
    date: '2026-06-16',
    changes: [
      '对照docx优化魔契师恩赐·契约强化——补前置条件/关键词+段落拆分+移除邪念风格污染'
    ]
  },


  {
    version: '1.0.5123',
    date: '2026-06-16',
    changes: [
      '对照docx重构魔契师谜巢描述——单段大文本拆分为5段+补缺失关键词字段'
    ]
  },


  {
    version: '1.0.5122',
    date: '2026-06-16',
    changes: [
      '修复魔契师奇术+活灵术描述污染(对照docx移除误混入的二阶天赋树内容)'
    ]
  },


  {
    version: '1.0.5121',
    date: '2026-06-16',
    changes: [
      '修复角色创建页8处熟练度=1硬编码为累加(||0)+1，解决职业+背景同熟练项不叠加为+2的bug'
    ]
  },


  {
    version: '1.0.5120',
    date: '2026-06-15',
    changes: [
      '修复14个职业进阶页60张无详情数据但仍显示可解锁的进阶卡片(detail-btn→locked-btn)'
    ]
  },


  {
    version: '1.0.5119',
    date: '2026-06-15',
    changes: [
      '修正v1.0.5118错误——回退data-search修复，改用docx原文件对照重新修正5职业120处施展时间(萨满35+吟游诗人43+蛮斗士18+猎人21+圣骑士3)'
    ]
  },


  {
    version: '1.0.5118',
    date: '2026-06-15',
    changes: [
      '批量修正5职业103处施展时间(萨满28+吟游诗人39+猎人19+蛮斗士14+圣骑士3)对照data-search修正'
    ]
  },


  {
    version: '1.0.5117',
    date: '2026-06-15',
    changes: [
      '角色面板学习技能弹窗修复+ESC返回快捷键+保存前提示+去重导出xlsx'
    ]
  },


  {
    version: '1.0.5116',
    date: '2026-06-14',
    changes: [
      '圣骑士23技能施展时间/距离/FP对照docx批量修正'
    ]
  },


  {
    version: '1.0.5115',
    date: '2026-06-14',
    changes: [
      '合并游荡者魔药风格重复三阶section+移除抉择污染'
    ]
  },


  {
    version: '1.0.5114',
    date: '2026-06-14',
    changes: [
      '修复角色面板学习技能弹窗不显示(CSS ID选择器优先)'
    ]
  },


  {
    version: '1.0.5113',
    date: '2026-06-14',
    changes: [
      '首页全局搜索支持通用天赋树(新增JSON+适配fields/flavor结构)'
    ]
  },


  {
    version: '1.0.5112',
    date: '2026-06-14',
    changes: [
      '清理武僧枪影如林·极+三昧护心内嵌酒仙/锋岚风格污染文本'
    ]
  },


  {
    version: '1.0.5111',
    date: '2026-06-14',
    changes: [
      '武僧12处技能费用颜色修正(描述定位docx含金刚震/神龙摆尾/金刚怒目等)'
    ]
  },


  {
    version: '1.0.5110',
    date: '2026-06-14',
    changes: [
      '移除奇袭/魅影/狂妄/魔药一阶nav中不属于该风格的抉择技能'
    ]
  },


  {
    version: '1.0.5109',
    date: '2026-06-14',
    changes: [
      '修复游荡者22处等级描述加粗(当你的游荡者等级达到模式)'
    ]
  },


  {
    version: '1.0.5108',
    date: '2026-06-14',
    changes: [
      '修复游荡者货币为王2处等级描述缺加粗class=field'
    ]
  },


  {
    version: '1.0.5107',
    date: '2026-06-14',
    changes: [
      '补回游荡者魔药风格三阶nav缺失链接(交互式验证17/17通过)'
    ]
  },


  {
    version: '1.0.5106',
    date: '2026-06-14',
    changes: [
      '游荡者内容结构归位修正(6个孤儿section正确嵌套无多余闭合)'
    ]
  },


  {
    version: '1.0.5105',
    date: '2026-06-14',
    changes: [
      '游荡者内容结构归位(孤儿section并入父风格)'
    ]
  },


  {
    version: '1.0.5104',
    date: '2026-06-14',
    changes: [
      '游荡者全面重构——8处污染清理+通用→妙手+导航重排+裸点修复'
    ]
  },


  {
    version: '1.0.5103',
    date: '2026-06-13',
    changes: [
      '修复游荡者11个技能费用点数错误(对照docx) + 魔药风格导航顺序修正 + 定时检查更新'
    ]
  },


  {
    version: '1.0.5102',
    date: '2026-06-13',
    changes: [
      '修复58个进阶卡片data-adv-name错配导致详情显示错误职业内容'
    ]
  },


  {
    version: '1.0.5101',
    date: '2026-06-13',
    changes: [
      '批量解锁57个已公布但标记为未解锁的进阶职业'
    ]
  },


  {
    version: '1.0.5100',
    date: '2026-06-13',
    changes: [
      '修复角色面板技能列表详情按钮无响应(showSkillDetail缺失showSkillPreview调用)'
    ]
  },


  {
    version: '1.0.599',
    date: '2026-06-13',
    changes: [
      '角色面板暗色模式全面修复(panel.css+panel_engine.js)'
    ]
  },


  {
    version: '1.0.598',
    date: '2026-06-13',
    changes: [
      '角色创建页暗色模式全面修复'
    ]
  },


  {
    version: '1.0.597',
    date: '2026-06-13',
    changes: [
      '修复守护骑士advancement_details含耀阳德鲁伊技能表(光斑跃迁/天火坠临/永昼形态)'
    ]
  },


  {
    version: '1.0.596',
    date: '2026-06-13',
    changes: [
      '修复术士天赐神通描述(拆分5个level_upgrades)+暗色主题chip标签color修正'
    ]
  },


  {
    version: '1.0.595',
    date: '2026-06-13',
    changes: [
      '修复6个特殊专长技能点颜色错误(对照docx):绿拇指/质朴/共享钱袋/技能点礼包/龙棋选手/创伤后成长'
    ]
  },


  {
    version: '1.0.594',
    date: '2026-06-13',
    changes: [
      '修复自动更新版本号不一致导致检查更新失效(bump v1.0.592→594)'
    ]
  },


  {
    version: '1.0.593',
    date: '2026-06-13',
    changes: [
      '拆分斯诺德大师为独立特殊专长：修复特别彩蛋误吞并问题'
    ]
  },


  {
    version: '1.0.592',
    date: '2026-06-13',
    changes: [
      '启动台新增⌨快捷键帮助按钮'
    ]
  },


  {
    version: '1.0.591',
    date: '2026-06-13',
    changes: [
      '术士混沌法术level_upgrades拆分为3条独立段落'
    ]
  },


  {
    version: '1.0.590',
    date: '2026-06-13',
    changes: [
      '术士混沌法术D100表格+描述补全(从docx)'
    ]
  },


  {
    version: '1.0.589',
    date: '2026-06-13',
    changes: [
      '武僧全技能dot数量+颜色完整从docx同步修正'
    ]
  },


  {
    version: '1.0.588',
    date: '2026-06-13',
    changes: [
      '武僧全技能dot费用从docx同步修正(41处)'
    ]
  },


  {
    version: '1.0.587',
    date: '2026-06-13',
    changes: [
      '武僧全技能40处费用点数/颜色从docx同步修正'
    ]
  },


  {
    version: '1.0.586',
    date: '2026-06-13',
    changes: [
      '修复首页搜索快捷键数据加载问题'
    ]
  },


  {
    version: '1.0.585',
    date: '2026-06-13',
    changes: [
      '修复ESC快捷键拦截逻辑'
    ]
  },


  {
    version: '1.0.584',
    date: '2026-06-13',
    changes: [
      '快捷键系统:ESC返回+Space搜索+/聚焦+?帮助面板'
    ]
  },


  {
    version: '1.0.583',
    date: '2026-06-12',
    changes: [
      '修复暗色模式下style/tier区域仍为米白色'
    ]
  },


  {
    version: '1.0.582',
    date: '2026-06-12',
    changes: [
      '子页面黑夜模式toggle按钮注入+comprehensive html.dark样式规则'
    ]
  },


  {
    version: '1.0.581',
    date: '2026-06-12',
    changes: [
      '武僧点穴手技能点费用修正(3→2匹配docx)'
    ]
  },


  {
    version: '1.0.580',
    date: '2026-06-12',
    changes: [
      '全职业236处FP值从docx同步',
      '40处技能点费用修正(HTML同步)'
    ]
  },


  {
    version: '1.0.579',
    date: '2026-06-12',
    changes: [
      '法师全部167技能疲劳值从docx同步修正',
      '暗色模式全站主题初始化(snd.js+common.js)',
      '面板sd变量名修复'
    ]
  },


  {
    version: '1.0.578',
    date: '2026-06-12',
    changes: [
      '修复面板sd变量未定义导致技能详情点击无反应',
      '暗色模式修复为全站生效(snd.js+common.js主题初始化)'
    ]
  },


  {
    version: '1.0.577',
    date: '2026-06-11',
    changes: [
      '全职业页tooltip>字符修复全局验证通过(16页)',
      '武器熟练度系统优化(hasChoice修复+WEAPON_SPEC_BONUSES内联)'
    ]
  },


  {
    version: '1.0.576',
    date: '2026-06-09',
    changes: [
      '武器熟练度系统(CLASS_WEAPON_PROFS+面板展示+武器专精选择器)',
      '武器分类标签完善(剑/斧/锤/长柄/弓箭/简易/火器/法器)',
      '新增猎刀武器'
    ]
  },


  {
    version: '1.0.575',
    date: '2026-06-09',
    changes: [
      '修复tooltip嵌套span导致详情描述出现>字符',
      '暗色模式选择器修复'
    ]
  },


  {
    version: '1.0.574',
    date: '2026-06-09',
    changes: [
      '修复color-mix浏览器兼容性问题(adv-link按钮消失)'
    ]
  },


  {
    version: '1.0.573',
    date: '2026-06-09',
    changes: [
      '修复html.dark逗号选择器泄漏到亮色模式(帮助页标题变灰等)',
      '充能音效松手停止修复',
      'snd.js语法修复'
    ]
  },


  {
    version: '1.0.572',
    date: '2026-06-09',
    changes: [
      '通用天赋树手风琴导航+阶点弹跳动画+面板弹窗入场+空状态友好化',
      '暗色模式手动切换☀️🌙+空装备槽占位+学习面板搜索防抖',
      '进阶卡片金光扫过+彩虹火焰+碎镜边框特效',
      '个性背景选1修复+面板特殊选项显示',
      '按钮涟漪+上传区光晕+字体微调+首页搜索结果滑入+帮助页平滑滚动',
      'ZzFX音效引擎(点击/悬停/充能/阶点/切换)'
    ]
  },


  {
    version: '1.0.571',
    date: '2026-06-08',
    changes: [
      'CSS变量体系+shared.css消除重复',
      '全站fadeInUp入场动画+技能卡片悬停',
      '暗色模式支持(prefers-color-scheme)',
      '14职业技能页独立配色',
      '帮助页粘性目录+滚动进度条',
      '进阶页技能卡片格式重构(article.skill)',
      'nav-drawer修复(transform包含块)'
    ]
  },


  {
    version: '1.0.570',
    date: '2026-06-08',
    changes: [
      '血族智力+1修正(同步xlsx源文件)',
      '全30种族属性与xlsx逐一比对确认一致',
      '同步electron-app副本'
    ]
  },


  {
    version: '1.0.569',
    date: '2026-06-07',
    changes: [
      '修复tooltip范围：限制在.detail描述区域，不再匹配导航标题'
    ]
  },


  {
    version: '1.0.568',
    date: '2026-06-07',
    changes: [
      '全职业关键词tooltip系统上线：异常状态30+关键词100+定义，桌面hover+移动端长按查看，141条完整字典覆盖31个页面'
    ]
  },


  {
    version: '1.0.567',
    date: '2026-06-07',
    changes: [
      '帮助页兼职规则完善：新增不可兼职列、职业兼容性矩阵、附赠职业说明'
    ]
  },


  {
    version: '1.0.566',
    date: '2026-06-07',
    changes: [
      '国内镜像按钮暂不可用：Gitee文件大小限制导致exe无法上传，寻找替代方案中'
    ]
  },


  {
    version: '1.0.565',
    date: '2026-06-03',
    changes: [
      '修复Gitee镜像：上传全部yml文件(含latest.yml)，exe超时延长至900s+3次重试'
    ]
  },


  {
    version: '1.0.564',
    date: '2026-06-03',
    changes: [
      '装备系统重构：物品对象化({item,weight})，I列分区分类(武器/防具/背包/腰包/杂物)，S列重量读取，面板渲染兼容，AC计算修复'
    ]
  },


  {
    version: '1.0.563',
    date: '2026-06-03',
    changes: [
      '修复Gitee国内镜像同步：API token改为form字段传递，重复release复用，大文件best-effort上传'
    ]
  },


  {
    version: '1.0.562',
    date: '2026-06-03',
    changes: [
      '修复CI构建：electron-builder.yml移除不兼容的GH_TOKEN宏，CI通过action-gh-release发布'
    ]
  },


  {
    version: '1.0.561',
    date: '2026-06-03',
    changes: [
      'GitHub更新检查403修复：electron-builder publish添加GH_TOKEN认证，更新错误信息增加友好提示引导用户使用国内镜像'
    ]
  },


  {
    version: '1.0.560',
    date: '2026-06-02',
    changes: [
      '上传角色页全面重构：修复xlsx解析20+bug(背景/子职业/等级/天赋/SP/故事/属性)；角色面板联动修复(autoCalc保护)；风格系统修正(通用不作为风格,保留xlsx原始风格)；Playwright E2E验证3角色全通过'
    ]
  },


  {
    version: '1.0.559',
    date: '2026-06-02',
    changes: [
      '修复移动端导航栏挤压内容bug(选择器从.class-view.active改为全局main/nav)',
      '移动端抽屉重设计(集成搜索+筛选+全新触控UI+左滑动画)'
    ]
  },


  {
    version: '1.0.558',
    date: '2026-06-02',
    changes: [
      '移除首页空抽屉导航',
      '优化移动端抽屉内链接字号与触控目标'
    ]
  },


  {
    version: '1.0.557',
    date: '2026-06-02',
    changes: [
      '恢复移动端悬浮目录导航：32个技能页+首页+特殊专长 全部添加悬浮☰按钮+抽屉导航；修复术士.html截断问题'
    ]
  },


  {
    version: '1.0.556',
    date: '2026-06-02',
    changes: [
      '修复术士起始特性：自动获得全部3个起始特性而无需手动选择'
    ]
  },


  {
    version: '1.0.555',
    date: '2026-06-02',
    changes: [
      '种族卡片显示全部特性名称而非仅显示前2项+计数徽章'
    ]
  },


  {
    version: '1.0.554',
    date: '2026-06-02',
    changes: [
      '背景特殊选择项补充：侍僧神祇/侦探联系渠道/骗子偏好骗局/职业杀手任务渠道/教授学术领域 +4个新数据字段 +UI选择器 +审查页 +xlsx导出'
    ]
  },


  {
    version: '1.0.553',
    date: '2026-06-01',
    changes: [
      '全站移动端响应式优化:panel.css三断点适配+8个角色页移动样式+职业页微调'
    ]
  },


  {
    version: '1.0.552',
    date: '2026-06-01',
    changes: [
      '新增特殊专长页面:从docx提取98项特殊专长+搜索高亮闪烁+首页入口'
    ]
  },


  {
    version: '1.0.551',
    date: '2026-06-01',
    changes: [
      '捉虫按钮移至页面右侧中间位置，避免与右下角按钮重叠'
    ]
  },


  {
    version: '1.0.550',
    date: '2026-06-01',
    changes: [
      '语言系统更新至18种语言:30种族映射+翼空族通用语可选',
      '修复saveCharacter中RACE_LANGS数组变异bug'
    ]
  },


  {
    version: '1.0.549',
    date: '2026-06-01',
    changes: [
      '首页全局搜索高亮修复(selector错配)',
      '新增空搜索结果提示',
      '清理common.css重复CSS',
      'electron-app首页同步全局搜索功能',
      '新增debug-journal.md和debug-snode skill'
    ]
  },


  {
    version: '1.0.548',
    date: '2026-06-01',
    changes: [
      '更新日志关闭按钮移至弹窗右上角(修复主源文件)'
    ]
  },


  {
    version: '1.0.547',
    date: '2026-06-01',
    changes: [
      '更新日志关闭按钮移至弹窗右上角'
    ]
  },


  {
    version: '1.0.546',
    date: '2026-06-01',
    changes: [
      '修复魔契师51处数据错误:清理29处垃圾文本+补充22个天赋技能缺失描述'
    ]
  },


  {
    version: '1.0.545',
    date: '2026-06-01',
    changes: [
      '魔契师数据全面更新:4风格含秘术116技能',
      'REF_CLASSES字段修正+key_attr→魅力',
      'REF_SUBCLASS_REQS attrs修复',
      '28技能费用颜色docx校正',
      '描述/升级文本技能点颜色修正',
      '错别字魔契约师→魔契师'
    ]
  },


  {
    version: '1.0.543',
    date: '2026-06-01',
    changes: [
      '首次安装可自选是否创建桌面快捷方式'
    ]
  },


  {
    version: '1.0.542',
    date: '2026-06-01',
    changes: [
      '修复静默安装(NSIS customInit /S)',
      '修复GitHub Pages部署(改用actions/deploy-pages)'
    ]
  },


  {
    version: '1.0.541',
    date: '2026-06-01',
    changes: [
      '修复更新静默安装(quitAndInstall改为true)',
      '修复GitHub Pages未开启问题'
    ]
  },


  {
    version: '1.0.540',
    date: '2026-06-01',
    changes: [
      '修复更新日志停止在v1.0.535',
      '修复GitHub Pages部署(加入index.html)',
      '修复bump-version.js自动同步changelog.js'
    ]
  },


  {
    version: '1.0.539',
    date: '2026-06-01',
    changes: [
      '安装器可选安装目录',
      '更新完全静默无弹窗',
      'Cloudflare Pages国内镜像站点',
      'index.html自动跳转启动台'
    ]
  },


  {
    version: '1.0.538',
    date: '2026-06-01',
    changes: [
      '更新全部md文档到v1.0.537状态'
    ]
  },


  {
    version: '1.0.537',
    date: '2026-06-01',
    changes: [
      'Gitee mirror新增上传latest.yml'
    ]
  },


  {
    version: '1.0.536',
    date: '2026-06-01',
    changes: [
      '修复bump-version.js changelog写入匹配条件(= [)'
    ]
  },

  {
    version: '1.0.535',
    date: '2026-06-01',
    changes: [
      '修复CN镜像Gitee用户名(Doylesama114→007)'
    ]
  },
  {
    version: '1.0.534',
    date: '2026-06-01',
    changes: [
      '修复CN镜像按钮被Electron拦截(白名单加gitee.com)'
    ]
  },
  {
    version: '1.0.533',
    date: '2026-06-01',
    changes: [
      '修复changelog.js双括号语法错误导致按钮无响应',
      '修复bump-version注入逻辑'
    ]
  },
  {
    version: '1.0.532',
    date: '2026-06-01',
    changes: [
      '修复浏览器XHR Title头含中文报错'
    ]
  },
  {
    version: '1.0.531',
    date: '2026-06-01',
    changes: [
      '修复IPC发送Bug时Title头含中文报错'
    ]
  },
  {
    version: '1.0.530',
    date: '2026-06-01',
    changes: [
      '捉虫按钮改用IPC桥接(main进程发网络请求)',
      '发送按钮内联反馈(替代alert)'
    ]
  },

  {
    version: '1.0.529',
    date: '2026-06-01',
    changes: [
      '捉虫按钮完全改用createElement+addEventListener'
    ]
  },

  {
    version: '1.0.528',
    date: '2026-06-01',
    changes: [
      '捉虫发送按钮改用内联onclick事件修复'
    ]
  },

  {
    version: '1.0.527',
    date: '2026-06-01',
    changes: [
      '捉虫按钮改用弹窗替代prompt修复点击无反应',
      '更新日志自动追加功能'
    ]
  },

  {
    version: '1.0.520',
    date: '2026-06-01',
    changes: [
      '🐛 Bug反馈按钮改用邮件方式（更稳定）',
      '⚡ 自动更新改为静默安装，无需用户操作',
      '📋 新增更新日志弹窗',
      '🌐 新增国内镜像加速下载',
    ]
  },
  {
    version: '1.0.514',
    date: '2026-06-01',
    changes: [
      '🔧 修复自动更新文件名不匹配问题',
      '📦 改用 NSIS 安装器格式',
      '🤖 新增 bump-version.js 一键版本号同步',
    ]
  },
  {
    version: '1.0.510',
    date: '2026-06-01',
    changes: [
      '🔄 修复 app-update.yml 缺失问题',
      '➕ 新增 publish 配置',
    ]
  },
  {
    version: '1.0.56',
    date: '2026-05-31',
    changes: [
      '📁 核心文件直接提交到 electron-app',
      '🛠 修复打包时使用旧文件的问题',
    ]
  },
  {
    version: '1.0.54',
    date: '2026-05-31',
    changes: [
      '⚡ Electron IPC 自动更新 + 下载完成自动重启',
      '🐛 启动台版本号显示 + 检查更新反馈',
    ]
  },
];

function showChangelog(showLatest) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;overflow-y:auto';
  
  var modal = document.createElement('div');
  modal.style.cssText = 'background:#fffdf8;border-radius:12px;padding:24px 28px;max-width:520px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 16px 48px rgba(0,0,0,0.2);font-family:"Microsoft YaHei",sans-serif;color:#1f2522';

  var html = '<h2 style="margin:0 0 4px;font-size:22px">📋 更新日志</h2>';
  html += '<div style="font-size:13px;color:#69706b;margin-bottom:16px">斯诺德跑团 · 版本历史</div>';

  for (var i = 0; i < SNOWD_CHANGELOG.length; i++) {
    var v = SNOWD_CHANGELOG[i];
    var isNew = showLatest && i === 0;
    html += '<div style="background:'+(isNew?'#f6f4ef':'#fff')+';border:1px solid '+(isNew?'#a46d1f':'#d8d2c4')+';border-radius:8px;padding:14px 16px;margin-bottom:10px">';
    html += '<div style="font-size:16px;font-weight:bold;color:'+(isNew?'#a46d1f':'#1f2522')+'">v' + v.version + (isNew?' <span style="font-size:12px;color:#c62828">🆕 最新</span>':'') + '</div>';
    html += '<div style="font-size:12px;color:#69706b;margin-bottom:8px">' + v.date + '</div>';
    for (var j = 0; j < v.changes.length; j++) {
      html += '<div style="font-size:14px;line-height:1.8;color:#1f2522">' + v.changes[j] + '</div>';
    }
    html += '</div>';
  }

  // 右上角关闭按钮（插入到弹窗内部标题之前）
  html = html.replace('<h2 style="margin:0 0 4px;font-size:22px">📋 更新日志</h2>',
    '<button id="_clog_close" style="position:absolute;top:14px;right:16px;width:32px;height:32px;border:none;background:#f6f4ef;border-radius:50%;cursor:pointer;font-size:18px;line-height:1;color:#69706b;display:flex;align-items:center;justify-content:center;transition:all 0.15s;z-index:1" onmouseover="this.style.background=\'#d8d2c4\';this.style.color=\'#c62828\'" onmouseout="this.style.background=\'#f6f4ef\';this.style.color=\'#69706b\'">✕</button>\n  <h2 style="margin:0 0 4px;font-size:22px">📋 更新日志</h2>');

  modal.innerHTML = html;
  modal.style.position = 'relative';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById('_clog_close').onclick = function(e) { e.stopPropagation(); overlay.remove(); };
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
}
