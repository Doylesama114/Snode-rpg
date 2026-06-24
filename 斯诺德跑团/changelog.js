// 斯诺德跑团 - 更新日志
var SNOWD_CHANGELOG = [

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
