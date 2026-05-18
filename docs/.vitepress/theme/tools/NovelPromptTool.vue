<script setup lang="ts">
import { ref, computed } from 'vue'

const GENRES = [
  { id: 'xuanhuan', label: '玄幻修仙', icon: '⚔️' },
  { id: 'dushi',   label: '都市重生', icon: '🏙️' },
  { id: 'xitong',  label: '系统流',   icon: '⚡' },
  { id: 'lishi',   label: '历史穿越', icon: '📜' },
  { id: 'yanqing', label: '言情甜宠', icon: '💕' },
  { id: 'lingyi',  label: '灵异悬疑', icon: '👻' },
  { id: 'wuxian',  label: '无限流',   icon: '🌀' },
  { id: 'erciyuan',label: '二次元同人',icon: '🌸' },
]

const PLATFORMS = [
  { id: 'general', label: '通用' },
  { id: 'qidian',  label: '起点男频' },
  { id: 'fanqie',  label: '番茄快节奏' },
  { id: 'jjwxc',   label: '晋江女频' },
]

const TABS = [
  { id: 'character', label: '人物卡' },
  { id: 'world',     label: '世界观' },
  { id: 'outline',   label: '大纲' },
  { id: 'chapter',   label: '章节扩写' },
  { id: 'polish',    label: '润色检查' },
] as const
type TabId = typeof TABS[number]['id']

const PLATFORM_PATCHES: Record<string, string> = {
  general: '',
  qidian: '\n\n【起点男频风格补丁】\n- 开头100字内必须有主角"开挂"或压制瞬间\n- 每章末尾给出明确升级/获得资源/打脸爽点\n- 情感描写不超过全章15%，主角说话有压迫感',
  fanqie: '\n\n【番茄快节奏补丁】\n- 每500字一个小悬念或反转\n- 句子短，段落短（每段不超5行）\n- 对话占比≥40%，主角解决问题要快不拖沓',
  jjwxc:  '\n\n【晋江女频甜宠补丁】\n- 细节描写男主动作/外貌（手指、侧脸），制造心动感\n- 必须有一个"心跳漏拍"的肢体或眼神接触\n- 女主必须有自己的判断和反击，不能纯依赖男主',
}

interface CharPreset  { name:string; age:string; gender:string; personality:string; background:string; desire:string; fear:string; habit:string; weakness:string }
interface WorldPreset { conflict:string; powerSystem:string; hook:string; forces:string; taboos:string }
interface GenrePreset { character: CharPreset; world: WorldPreset }

const PRESETS: Record<string, GenrePreset> = {
  xuanhuan: {
    character: {
      name:'林尘', age:'19', gender:'男',
      personality:'克制、记仇、对陌生人过分客气（反差：表面温和，心里在记账）',
      background:'12岁时亲眼看着姐姐被宗门献祭，从此对"献祭"二字过敏，独自修行6年',
      desire:'找到让姐姐活回来的办法，哪怕代价是自己的元神',
      fear:'变成当年那些"为了大义"牺牲他姐姐的人',
      habit:'口头禅"行。"和"——倒也不必。"，习惯用句号结尾，少用感叹号',
      weakness:'记仇但不擅长表达，极度孤立；过于压抑导致关键时刻判断力失误',
    },
    world: {
      conflict:'千年前封印的魔尊苏醒，主角是唯一能再次封印之人，但封印需以元神为代价',
      powerSystem:'修仙九境：练气（凡人寿）→ 筑基（300年）→ 金丹（800年）→ 元婴（2000年）→ 化神（5000年）→ 合体 → 大乘 → 渡劫 → 仙人',
      hook:'每次境界突破主角元神减少一分；他必须在"变强"和"保命"之间走钢丝，且知道自己终将走向消亡',
      forces:'1. 昆仑正道联盟（九大宗门，道貌岸然）\n2. 血海魔宗（反派大本营，内部分裂）\n3. 散修联盟（中立，主角早期依托）',
      taboos:'1. 任何修士不得直入昆仑墟，违者天罚加身\n2. 元神受损者每境界突破折寿百年\n3. 魔气入体永不可祛除，唯有善行积功德抵消',
    },
  },
  dushi: {
    character: {
      name:'林溪', age:'17（重生后）', gender:'男',
      personality:'表面普通学生，内心冷静果断，绝不滥用先知优势',
      background:'前世28岁被资本绞杀，临死前悔恨未保住家人；重生回2008年9月，带着10年记忆',
      desire:'用前世记忆保住家人，同时在缝隙里完成资本布局',
      fear:'蝴蝶效应失控；或被人发现"重生者"身份',
      habit:'很少解释行动理由，给人"直觉准"的神秘感；说话简短，行动派',
      weakness:'对家人的执念会影响理性判断；前世阴影让他不信任任何人',
    },
    world: {
      conflict:'重生2008年互联网创业前夜，拥有10年先知记忆（只到2018年），必须在窗口期完成布局',
      powerSystem:'无超能力，主角优势纯靠信息差和前世经验（增强现实感，不破坏逻辑）',
      hook:'先知记忆只到2018年，之后一片空白；2018年发生了什么导致他前世死亡？',
      forces:'1. 资本方（前世对手，现在可合作或绕开）\n2. 家庭（核心保护对象）\n3. 创业伙伴（信任边界：谁在前世背叛了他）',
      taboos:'1. 不能改变历史大事件，否则蝴蝶效应失控\n2. 先知记忆只到2018年，不能透支\n3. 不能暴露"重生者"身份',
    },
  },
  xitong: {
    character: {
      name:'陈默', age:'22', gender:'男',
      personality:'懒散表面、精明内核、表面咸鱼实则极度认真',
      background:'刚被女友甩、被公司裁员，人生最低谷时绑定系统，第一个任务就是"追回前任"',
      desire:'用系统逆袭，证明自己不是废物；顺便搞清楚系统的真实目的',
      fear:'系统消失；或发现自己只是系统的工具人',
      habit:'经常和系统对话，语气随意，带着吐槽意味；情绪外露，比较接地气',
      weakness:'依赖系统导致自主性弱；容易因为任务奖励而做出不符价值观的事',
    },
    world: {
      conflict:'系统绑定初期只提供"签到+任务"，但任务难度越来越高，且隐藏着更大的阴谋',
      powerSystem:'积分系统：完成任务获积分 → 积分兑换技能/物品；惩罚机制：失败扣寿命/属性',
      hook:'系统每月1号有"隐藏BOSS"刷新，击败可获稀有奖励，但惩罚是"系统重置一次"——强迫主角面对失去一切的恐惧',
      forces:'1. 系统（最大谜团，帮手还是操控者）\n2. 其他系统宿主（竞争/合作）\n3. 试图消灭所有宿主的神秘组织',
      taboos:'1. 任务失败扣寿命，不能无脑尝试\n2. 部分任务有道德代价\n3. 不能对外透露系统存在',
    },
  },
  lishi: {
    character: {
      name:'顾行之', age:'24', gender:'男',
      personality:'冷静理智、学术范、说话逻辑严密，偶有古人看不懂的现代金句',
      background:'现代历史系研究生，因意外穿越到明嘉靖三十一年，变成一个秀才身份',
      desire:'在不改变大历史走向的前提下，让自己认识的每个人活得更好',
      fear:'因蝴蝶效应改变历史，导致认识的"好人"没法出生',
      habit:'遇到问题先分析利弊，与古人争论时不自觉用现代思维，被认为"奇人"',
      weakness:'总想按"已知结果"行动，但现实往往偏移历史，知识是枷锁',
    },
    world: {
      conflict:'嘉靖三十一年，倭寇侵扰浙江。主角知道戚继光最终必胜，但在等待过程中无数无辜百姓会死',
      powerSystem:'无超能力，主角优势是现代知识（医学/军事/历史先知），但知识越多责任越重',
      hook:'主角知道历史，却无法改变重大事件，只能"优化执行过程"——每次看着本可避免的死亡发生，道德压力极大',
      forces:'1. 戚继光麾下武将（历史英雄，主角辅助方向）\n2. 腐败官员（阻力，但不能简单消灭）\n3. 倭寇（有普通日本平民被裹挟其中）',
      taboos:'1. 不能杀害历史上有明确记载的人物\n2. 不能公开展示"来自未来"的知识\n3. 历史必须按大方向走，主角只能在缝隙里活动',
    },
  },
  yanqing: {
    character: {
      name:'沈若兮', age:'26', gender:'女',
      personality:'清冷理智、独立，表面淡漠，内心细腻敏感（反差：越在乎越冷漠）',
      background:'原生家庭不幸，从小学会不依赖任何人；现在是独立设计师，刚接受家族联姻安排',
      desire:'在联姻关系中保持自我，不被感情裹挟失去独立性',
      fear:'再次因为信任他人而受伤，再次变成"需要被保护的人"',
      habit:'说话直接，不兜圈子，情绪不外露；用工作和忙碌来逃避情感',
      weakness:'防御心太强主动拒绝一切美好；刀子嘴豆腐心但从不承认',
    },
    world: {
      conflict:'家族联姻，女主必须与陌生男主同住，两人签了"分房AA不秀恩爱"的夫妻协议',
      powerSystem:'现代都市，无超能力，核心冲突来自人物内心和关系张力',
      hook:'男主在协议上签字时表面淡定，内心旁白："那就让你心甘情愿撕协议。"——读者知道他的目标，女主不知道',
      forces:'1. 两个家族（联姻背景，有隐藏利益纠葛）\n2. 男主的前任（制造误会的工具人）\n3. 女主闺蜜（推动女主正视情感）',
      taboos:'1. 禁止"霸道总裁壁咚"等老套情节\n2. 女主不能主动示弱求救\n3. 感情推进必须基于真实相处，不能突然升温',
    },
  },
  lingyi: {
    character: {
      name:'方瑜', age:'29', gender:'男',
      personality:'冷静克制、职业感强，不轻易相信超自然',
      background:'殡仪馆化妆师。一次意外工伤后开始"看见死者的最后一刻"；认为是神经损伤幻觉，直到发现幻觉全部成真',
      desire:'搞清楚能力的来源，同时帮助无法安息的死者',
      fear:'有一天"看见"自己的死亡',
      habit:'用殡仪馆从业者视角描述一切：冷静、精准、偶有黑色幽默；对死亡的态度比普通人淡定',
      weakness:'能力随负面情绪增强，越恐惧看到的越清晰，形成恶性循环',
    },
    world: {
      conflict:'每个案件表面是意外死亡，背后有未解的人性故事。主线谜题：方瑜的能力来源是什么？',
      powerSystem:'"死亡回放"：触碰死者遗物，看到死者最后5分钟的主观视角；代价：每次使用后头痛+失眠加重',
      hook:'第一个案件的死者，在"最后5分钟"里看向了某栋楼的18楼——那里站着方瑜认识的人',
      forces:'1. 殡仪馆同事（知道他有异能的唯一人，半信半疑）\n2. 刑警（合作/对立，用非常规线索）\n3. 死者家属（受益方或隐藏嫌疑人）',
      taboos:'1. 能力只能"看"不能改变死亡\n2. 不能主动寻找案件，只能处理进馆的死者\n3. 每次使用都有代价，最终会导致失明？',
    },
  },
  wuxian: {
    character: {
      name:'秦野', age:'28', gender:'男',
      personality:'沉着、经验主义者、用数据和规律做决策，绝不赌运气',
      background:'刑警，被一桩冤案逼到走投无路的边缘，被主神系统选中的瞬间正是他准备自我了断时',
      desire:'回去证明自己的清白，找到当年冤案背后的真相',
      fear:'在副本里死去，真相永远无人知晓',
      habit:'在副本里用刑警思维分析所有NPC，把剧情当案件处理；对其他轮回者不轻易信任',
      weakness:'职业习惯让他过于理性，在需要"相信他人"的节点上总是失误',
    },
    world: {
      conflict:'主神系统编号7726，每30天进入一个副本，副本内死亡=现实死亡。主线：谁创造了系统，目的是什么',
      powerSystem:'积分系统：通关获得积分 → 兑换血脉/功法/物品；但每个兑换都有隐藏代价（心魔、属性绑定）',
      hook:'主角在第一个副本发现，某个NPC的口头禅和冤案中死去的目击证人一模一样——副本是随机的吗？',
      forces:'1. 友好型轮回者（知识共享，利益冲突时会翻脸）\n2. 对立型轮回者（刷分机器，不在乎副本里的"人"）\n3. 神秘的系统管理者（给任务但从不露面）',
      taboos:'1. 副本内死亡=现实死亡，无复活道具\n2. 每次兑换有隐藏代价，不可逆\n3. 主神空间里轮回者互相伤害=强制删除',
    },
  },
  erciyuan: {
    character: {
      name:'苏音', age:'20', gender:'男',
      personality:'沉默寡言、观察力强，表面冷漠内心极度敏感',
      background:'OC角色，能力"红楼一梦"——让目标进入梦境重温人生最痛苦的瞬间；被认为是危险人物',
      desire:'搞清楚能力的来源；以及为什么他从记事起就不会做梦',
      fear:'有一天把自己困进别人的梦里出不来',
      habit:'少说话多观察；行动前在脑子里推演三遍；遇到强者好奇心大于恐惧',
      weakness:'能力是双刃剑，使用时自己也会看到目标的痛苦记忆，积累心理创伤',
    },
    world: {
      conflict:'穿插于原作时间线的缝隙中；主角能力对强者来说极度危险，必须隐藏或面对后果',
      powerSystem:'"红楼一梦"：让目标进入自身记忆最痛处；持续时间=目标心理强度；代价=主角同步承受目标痛苦',
      hook:'故事开头：苏音被原作角色发现了能力，对方的反应出乎意料——不是逃跑，而是主动要求体验',
      forces:'1. 原作正派（信任需要建立）\n2. 原作反派（理解但不接受其手段）\n3. 原作中立人物（最危险，因为不可预测）',
      taboos:'1. 不能改变原作重大事件\n2. 能力使用对主角有心理代价，不可滥用\n3. 对原作角色要尊重性格，不能OOC',
    },
  },
}

const selectedGenre   = ref('xuanhuan')
const selectedPlatform = ref('general')
const activeTab = ref<TabId>('character')
const copied = ref(false)
const presetLoaded = ref('')

// Character tab
const cName        = ref(''), cAge   = ref(''), cGender = ref('男')
const cPersonality = ref(''), cBg    = ref('')
const cDesire      = ref(''), cFear  = ref('')
const cHabit       = ref(''), cWeak  = ref('')

// World tab
const wConflict = ref(''), wPower  = ref('')
const wHook     = ref(''), wForces = ref(''), wTaboos = ref('')

// Outline tab
const oWords   = ref('100万')
const oCharSum = ref(''), oWorldSum = ref(''), oVillain = ref('')

// Chapter tab
const chWords = ref('3000'), chPoint = ref(''), chLast = ref('')

// Polish tab
const polContent = ref('')

function loadPreset() {
  const p = PRESETS[selectedGenre.value]
  if (!p) return
  if (activeTab.value === 'character') {
    const c = p.character
    cName.value = c.name; cAge.value = c.age; cGender.value = c.gender
    cPersonality.value = c.personality; cBg.value = c.background
    cDesire.value = c.desire; cFear.value = c.fear
    cHabit.value = c.habit; cWeak.value = c.weakness
  } else if (activeTab.value === 'world') {
    const w = p.world
    wConflict.value = w.conflict; wPower.value = w.powerSystem
    wHook.value = w.hook; wForces.value = w.forces; wTaboos.value = w.taboos
  }
  presetLoaded.value = `已载入「${GENRES.find(g=>g.id===selectedGenre.value)?.label}」示例`
  setTimeout(() => presetLoaded.value = '', 2000)
}

function clearTab() {
  if (activeTab.value === 'character') {
    cName.value = ''; cAge.value = ''; cGender.value = '男'
    cPersonality.value = ''; cBg.value = ''; cDesire.value = ''
    cFear.value = ''; cHabit.value = ''; cWeak.value = ''
  } else if (activeTab.value === 'world') {
    wConflict.value = ''; wPower.value = ''; wHook.value = ''
    wForces.value = ''; wTaboos.value = ''
  } else if (activeTab.value === 'outline') {
    oWords.value = '100万'; oCharSum.value = ''; oWorldSum.value = ''; oVillain.value = ''
  } else if (activeTab.value === 'chapter') {
    chWords.value = '3000'; chPoint.value = ''; chLast.value = ''
  } else {
    polContent.value = ''
  }
}

const genreLabel = computed(() => GENRES.find(g => g.id === selectedGenre.value)?.label ?? '')
const patch = computed(() => PLATFORM_PATCHES[selectedPlatform.value] ?? '')

const generatedPrompt = computed((): string => {
  const g = genreLabel.value

  if (activeTab.value === 'character') {
    const lines: string[] = []
    lines.push(`你是一位资深网络小说编辑，请为以下设定生成一张完整的主角人物卡。\n`)
    lines.push(`题材类型：${g}`)
    if (cName.value)        lines.push(`主角姓名：${cName.value}`)
    if (cAge.value)         lines.push(`年龄：${cAge.value}`)
    if (cGender.value)      lines.push(`性别：${cGender.value}`)
    if (cPersonality.value) lines.push(`\n核心性格（含反差点）：${cPersonality.value}`)
    if (cBg.value)          lines.push(`\n成长背景与创伤事件：${cBg.value}`)
    if (cDesire.value)      lines.push(`\n核心欲望（驱动主角的动力）：${cDesire.value}`)
    if (cFear.value)        lines.push(`\n核心恐惧（最害怕失去/变成什么）：${cFear.value}`)
    if (cHabit.value)       lines.push(`\n口头禅/说话习惯：${cHabit.value}`)
    if (cWeak.value)        lines.push(`\n性格弱点（让读者共情的缺陷）：${cWeak.value}`)
    lines.push(`\n请输出：\n1. 完整人物卡（可直接粘贴给AI写作的格式）\n2. 3个"角色会在什么情况下打破原则"的场景钩子\n3. 与配角的关系网设计建议（3个配角定位）`)
    return lines.join('\n')
  }

  if (activeTab.value === 'world') {
    const lines: string[] = []
    lines.push(`你是一位资深${g}网文编辑，请基于以下要素生成完整的世界观设定文档。\n`)
    if (wConflict.value) lines.push(`主要矛盾/故事核心：${wConflict.value}`)
    if (wPower.value)    lines.push(`\n力量体系：${wPower.value}`)
    if (wHook.value)     lines.push(`\n独特钩子（让读者追更的核心设定）：${wHook.value}`)
    if (wForces.value)   lines.push(`\n主要势力：\n${wForces.value}`)
    if (wTaboos.value)   lines.push(`\n世界禁忌/规则：\n${wTaboos.value}`)
    lines.push(`\n请输出：\n1. 世界背景（300字内）\n2. 完整力量体系（各境界一句话简述+寿元/代价）\n3. 主要势力介绍（各50字）\n4. 禁忌规则（每条说明其戏剧功能）\n5. 关键历史事件时间线（至少3个节点，每个30字）`)
    return lines.join('\n')
  }

  if (activeTab.value === 'outline') {
    const words = oWords.value || '100万'
    const lines: string[] = []
    lines.push(`帮我设计一部${words}字${g}网文的三幕式大纲。\n`)
    if (oCharSum.value)  lines.push(`主角设定摘要：${oCharSum.value}`)
    if (oWorldSum.value) lines.push(`\n世界观核心：${oWorldSum.value}`)
    if (oVillain.value)  lines.push(`\n主要反派设定：${oVillain.value}`)
    lines.push(`\n第一幕（约${words === '50万' ? '5万' : '20万'}字）— 立人物+立小目标：\n- 第一章钩子（前1000字结尾的具体悬念，不能是抽象的"接下来会怎样"）\n- 主角第一次展现核心性格的场景\n- 第一个可在10万字内完成的小目标\n\n第二幕（约${words === '50万' ? '35万' : '80万'}字）— 升级+反派进逼+道德困境：\n- 5个升级节点（每个20万字左右一个大爆点）\n- 主反派登场时机与"对照映射"（反派与主角的相似之处）\n- 最低谷：主角几乎成为"他最害怕的那种人"的时刻\n\n第三幕（约${words === '50万' ? '10万' : '20万'}字）— 弧光闭环：\n- 终极对决（不仅是物理对决，更是道德选择）\n- 主角弧光完成（性格如何成长）\n- 结局后的5年番外钩子\n\n每个节点80-150字描述。`)
    return lines.join('\n')
  }

  if (activeTab.value === 'chapter') {
    const words = chWords.value || '3000'
    const lines: string[] = []
    lines.push(`[人物卡]\n（请粘贴你的人物卡到此处）\n\n[本章节点]\n${chPoint.value || '（请填写本章在大纲中的位置和任务）'}`)
    if (chLast.value) lines.push(`\n[上章末尾200字]\n${chLast.value}`)
    lines.push(`\n写作要求：\n- 字数：${words}字\n- 题材：${g}\n- 视角：第三人称限知，贴近主角内心，禁止上帝视角\n- 本章必须包含：\n  1. 开头300字内重新确立"本章悬念"，同时给出新钩子\n  2. 至少一段200+字的动作或对话高潮\n  3. 结尾200字必须是悬念或情绪高点\n- 禁止：\n  - 大段心理独白（超5行直接拆成动作+对话）\n  - 纯环境描写超过3句\n  - 角色说话过于文雅（除非角色设定如此）\n\n请直接输出章节正文，不需要解释思路。`)
    return lines.join('\n') + patch.value
  }

  if (activeTab.value === 'polish') {
    return `请检查以下章节内容并修改：\n\n[章节正文]\n${polContent.value || '（请粘贴章节内容）'}\n\n[人物卡参考]\n（请粘贴人物卡）\n\n检查清单：\n1. 角色性格是否与人物卡一致？（重点检查说话方式：句长、语气词、句末标点）\n2. 是否有逻辑漏洞？（时间线、能力使用是否超出当前境界）\n3. 节奏问题：超过3句的纯景物/纯心理描写标出位置\n4. 重复用词（同一段内出现3次以上的词）\n5. AI味关键词检查：宛如、仿佛、似乎、不由得、微微、轻轻（每处标出）\n\n输出：\n- 修改版正文（可直接复制粘贴的版本）\n- 修改清单（每条不超20字）\n- AI味评分（1-10，10最严重）+ 3条具体降味建议`
  }

  return ''
})

const charCount = computed(() => generatedPrompt.value.length)
const tokenEst  = computed(() => Math.ceil(charCount.value / 3.5))

async function copy() {
  if (!generatedPrompt.value) return
  await navigator.clipboard.writeText(generatedPrompt.value)
  copied.value = true
  setTimeout(() => copied.value = false, 1500)
}

const canLoadPreset = computed(() => activeTab.value === 'character' || activeTab.value === 'world')
</script>

<template>
  <div class="nt">

    <!-- Genre -->
    <div class="section">
      <div class="section-hdr">
        <span class="lbl">小说题材</span>
      </div>
      <div class="chips">
        <button
          v-for="g in GENRES" :key="g.id"
          :class="['chip', selectedGenre === g.id && 'chip-active']"
          @click="selectedGenre = g.id"
        >{{ g.icon }} {{ g.label }}</button>
      </div>
    </div>

    <!-- Platform -->
    <div class="section">
      <div class="section-hdr">
        <span class="lbl">目标平台</span>
        <span class="hint">（影响章节扩写风格补丁）</span>
      </div>
      <div class="chips">
        <button
          v-for="p in PLATFORMS" :key="p.id"
          :class="['chip', selectedPlatform === p.id && 'chip-active']"
          @click="selectedPlatform = p.id"
        >{{ p.label }}</button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-row">
      <div class="tabs">
        <button
          v-for="t in TABS" :key="t.id"
          :class="['tab-btn', activeTab === t.id && 'tab-active']"
          @click="activeTab = t.id"
        >{{ t.label }}</button>
      </div>
      <div class="tab-actions">
        <span v-if="presetLoaded" class="notice">✓ {{ presetLoaded }}</span>
        <button v-if="canLoadPreset" class="btn btn-ghost btn-sm" @click="loadPreset">
          载入「{{ genreLabel }}」示例
        </button>
        <button class="btn btn-ghost btn-sm" @click="clearTab">清空</button>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">

      <!-- 人物卡 -->
      <template v-if="activeTab === 'character'">
        <div class="grid-2">
          <div class="field">
            <label class="lbl">主角姓名</label>
            <input v-model="cName" class="inp" placeholder="如：林尘、沈若兮" />
          </div>
          <div class="field">
            <label class="lbl">年龄</label>
            <input v-model="cAge" class="inp" placeholder="如：19、17（重生后）" />
          </div>
          <div class="field">
            <label class="lbl">性别</label>
            <select v-model="cGender" class="inp sel">
              <option>男</option>
              <option>女</option>
              <option>不限</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label class="lbl">核心性格 <span class="hint">（3个关键词，含至少1个反差点）</span></label>
          <textarea v-model="cPersonality" class="inp" rows="2" placeholder="如：克制、记仇、对陌生人过分客气（反差：表面温和，心里在记账）" />
        </div>
        <div class="field">
          <label class="lbl">成长背景与创伤事件 <span class="hint">（具体事件，100字内）</span></label>
          <textarea v-model="cBg" class="inp" rows="3" placeholder="12岁时亲眼看着姐姐被宗门献祭，从此对「献祭」二字过敏..." />
        </div>
        <div class="grid-2">
          <div class="field">
            <label class="lbl">核心欲望 <span class="hint">（驱动主角的动力）</span></label>
            <textarea v-model="cDesire" class="inp" rows="2" placeholder="找到让姐姐活回来的办法，哪怕代价是元神..." />
          </div>
          <div class="field">
            <label class="lbl">核心恐惧 <span class="hint">（最害怕失去/变成什么）</span></label>
            <textarea v-model="cFear" class="inp" rows="2" placeholder="变成当年那些「为了大义」牺牲他姐姐的人..." />
          </div>
        </div>
        <div class="field">
          <label class="lbl">口头禅/说话习惯 <span class="hint">（具体到语气词、句式偏好）</span></label>
          <input v-model="cHabit" class="inp" placeholder="口头禅「行。」，习惯用句号结尾，少用感叹号，体现压抑感..." />
        </div>
        <div class="field">
          <label class="lbl">性格弱点 <span class="hint">（让读者共情的缺陷，性格层面而非能力层面）</span></label>
          <textarea v-model="cWeak" class="inp" rows="2" placeholder="记仇但不擅长表达，导致人际关系极度孤立..." />
        </div>
      </template>

      <!-- 世界观 -->
      <template v-else-if="activeTab === 'world'">
        <div class="field">
          <label class="lbl">主要矛盾/故事核心</label>
          <textarea v-model="wConflict" class="inp" rows="2" placeholder="千年前封印的魔尊苏醒，主角是唯一能再次封印之人，但封印需以元神为代价..." />
        </div>
        <div class="field">
          <label class="lbl">力量体系 <span class="hint">（各阶段一句话描述）</span></label>
          <textarea v-model="wPower" class="inp" rows="3" placeholder="修仙九境：练气（凡人寿）→ 筑基（300年）→ 金丹（800年）→ 元婴（2000年）..." />
        </div>
        <div class="field">
          <label class="lbl">独特钩子 <span class="hint">（让读者追更的核心设定约束）</span></label>
          <textarea v-model="wHook" class="inp" rows="2" placeholder="每次境界突破主角元神减少一分，他必须在「变强」和「保命」之间走钢丝..." />
        </div>
        <div class="grid-2">
          <div class="field">
            <label class="lbl">主要势力 <span class="hint">（3-5个，每行一个）</span></label>
            <textarea v-model="wForces" class="inp" rows="4" placeholder="1. 昆仑正道（九大宗门，道貌岸然）&#10;2. 血海魔宗（反派大本营，内部分裂）&#10;3. 散修联盟（中立，主角早期依托）" />
          </div>
          <div class="field">
            <label class="lbl">世界禁忌/规则 <span class="hint">（增加戏剧张力的约束）</span></label>
            <textarea v-model="wTaboos" class="inp" rows="4" placeholder="1. 任何修士不得直入昆仑墟，违者天罚加身&#10;2. 元神受损者每境界突破折寿百年&#10;3. 魔气入体永不可祛除" />
          </div>
        </div>
      </template>

      <!-- 大纲 -->
      <template v-else-if="activeTab === 'outline'">
        <div class="field">
          <label class="lbl">目标字数</label>
          <select v-model="oWords" class="inp sel" style="max-width:160px">
            <option>50万</option>
            <option>100万</option>
            <option>150万</option>
            <option>200万+</option>
          </select>
        </div>
        <div class="field">
          <label class="lbl">主角设定摘要 <span class="hint">（从人物卡复制核心内容粘贴到此）</span></label>
          <textarea v-model="oCharSum" class="inp" rows="3" placeholder="主角姓名、性格、核心欲望、恐惧..." />
        </div>
        <div class="field">
          <label class="lbl">世界观核心 <span class="hint">（从世界观文档摘取主要矛盾和力量体系）</span></label>
          <textarea v-model="oWorldSum" class="inp" rows="3" placeholder="力量体系名称、核心矛盾、独特钩子..." />
        </div>
        <div class="field">
          <label class="lbl">主要反派设定</label>
          <textarea v-model="oVillain" class="inp" rows="2" placeholder="反派的动机、与主角的对照关系（好的反派是主角的镜像）..." />
        </div>
      </template>

      <!-- 章节扩写 -->
      <template v-else-if="activeTab === 'chapter'">
        <div class="field">
          <label class="lbl">目标字数</label>
          <select v-model="chWords" class="inp sel" style="max-width:160px">
            <option>1500</option>
            <option>2000</option>
            <option>2500</option>
            <option>3000</option>
            <option>4000</option>
            <option>5000</option>
          </select>
        </div>
        <div class="field">
          <label class="lbl">本章节点描述 <span class="hint">（本章在大纲中的位置和任务）</span></label>
          <textarea v-model="chPoint" class="inp" rows="3" placeholder="第15章：主角在宗门试炼中遭人陷害，被迫当众展示真实实力，触怒师兄，埋下第一个仇恨伏笔..." />
        </div>
        <div class="field">
          <label class="lbl">上章末尾200字 <span class="hint">（保证衔接自然，可选）</span></label>
          <textarea v-model="chLast" class="inp" rows="3" placeholder="粘贴上一章的最后200字，确保新章节自然衔接..." />
        </div>
        <div v-if="selectedPlatform !== 'general'" class="patch-preview">
          <span class="lbl">平台风格补丁预览</span>
          <pre class="patch-pre">{{ patch }}</pre>
        </div>
      </template>

      <!-- 润色检查 -->
      <template v-else-if="activeTab === 'polish'">
        <div class="field">
          <label class="lbl">章节正文 <span class="hint">（粘贴需要润色的内容）</span></label>
          <textarea v-model="polContent" class="inp" rows="10" placeholder="粘贴你的章节内容到这里..." />
        </div>
        <div class="tip-box">
          <p class="tip-title">💡 AI味关键词参考（手改时重点关注）</p>
          <p class="tip-text">宛如、仿佛、似乎、不由得、微微、轻轻、不禁、登时、蓦然、刹那间、心中一动</p>
        </div>
      </template>

    </div>

    <!-- Output -->
    <div class="output-section">
      <div class="output-hdr">
        <span class="lbl" style="margin:0">生成的 Prompt</span>
        <span class="stats">{{ charCount }} 字符 · 约 {{ tokenEst }} tokens</span>
        <button class="btn btn-p btn-sm" @click="copy" :disabled="!generatedPrompt">
          {{ copied ? '✓ 已复制' : '复制 Prompt' }}
        </button>
      </div>
      <pre class="output-pre">{{ generatedPrompt || '（填写上方字段后自动生成 Prompt）' }}</pre>
    </div>

  </div>
</template>

<style scoped>
.nt { display:flex; flex-direction:column; gap:18px; }

.section { display:flex; flex-direction:column; gap:8px; }
.section-hdr { display:flex; align-items:center; gap:8px; }
.lbl { font-size:13px; color:var(--vp-c-text-2); font-weight:500; display:block; margin-bottom:4px; }
.hint { font-size:12px; color:var(--vp-c-text-3); font-weight:400; }

.chips { display:flex; gap:8px; flex-wrap:wrap; }
.chip { padding:6px 14px; border-radius:20px; font-size:13px; font-weight:500; cursor:pointer; border:1px solid var(--vp-c-divider); background:var(--vp-c-bg-soft); color:var(--vp-c-text-2); transition:all .15s; }
.chip:hover { border-color:var(--vp-c-brand-1); color:var(--vp-c-brand-1); }
.chip-active { background:var(--vp-c-brand-1); color:#fff; border-color:var(--vp-c-brand-1); }

.tabs-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; border-bottom:1px solid var(--vp-c-divider); padding-bottom:12px; }
.tabs { display:flex; gap:4px; flex-wrap:wrap; }
.tab-btn { padding:6px 16px; border-radius:6px; font-size:13px; font-weight:500; cursor:pointer; border:none; background:transparent; color:var(--vp-c-text-2); }
.tab-btn:hover { background:var(--vp-c-bg-soft); }
.tab-active { background:var(--vp-c-brand-soft); color:var(--vp-c-brand-1); font-weight:600; }
.tab-actions { display:flex; align-items:center; gap:8px; margin-left:auto; }
.notice { font-size:12px; color:#16a34a; white-space:nowrap; }

.tab-content { display:flex; flex-direction:column; gap:12px; }

.field { display:flex; flex-direction:column; }
.grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
@media (max-width: 600px) { .grid-2 { grid-template-columns:1fr; } }

.inp {
  background:var(--vp-c-bg-soft); border:1px solid var(--vp-c-divider);
  border-radius:8px; padding:10px 12px; font-size:14px; color:var(--vp-c-text-1);
  width:100%; box-sizing:border-box; resize:vertical; font-family:inherit; line-height:1.6;
}
.inp:focus { outline:none; border-color:var(--vp-c-brand-1); }
.sel { resize:none; cursor:pointer; }

.patch-preview { background:var(--vp-c-bg-soft); border:1px dashed var(--vp-c-divider); border-radius:8px; padding:10px 12px; }
.patch-pre { margin:4px 0 0; font-size:12px; white-space:pre-wrap; color:var(--vp-c-text-2); font-family:inherit; line-height:1.6; }

.tip-box { background:var(--vp-c-tip-soft, #f0f9ff); border:1px solid var(--vp-c-tip-1, #bae6fd); border-radius:8px; padding:10px 14px; }
.tip-title { font-size:13px; font-weight:600; color:var(--vp-c-text-1); margin:0 0 4px; }
.tip-text { font-size:13px; color:var(--vp-c-text-2); margin:0; line-height:1.7; }

.output-section { border:1px solid var(--vp-c-divider); border-radius:10px; overflow:hidden; }
.output-hdr { display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--vp-c-bg-soft); border-bottom:1px solid var(--vp-c-divider); flex-wrap:wrap; }
.stats { font-size:12px; color:var(--vp-c-text-3); margin-left:auto; white-space:nowrap; }
.output-pre { margin:0; padding:16px; font-size:13px; line-height:1.7; white-space:pre-wrap; word-break:break-word; color:var(--vp-c-text-1); background:var(--vp-c-bg); max-height:400px; overflow-y:auto; font-family:inherit; }

.btn { padding:6px 14px; border-radius:7px; font-size:13px; font-weight:500; cursor:pointer; border:none; }
.btn-p { background:var(--vp-c-brand-1); color:#fff; }
.btn-p:hover:not(:disabled) { background:var(--vp-c-brand-2); }
.btn-p:disabled { opacity:.5; cursor:not-allowed; }
.btn-ghost { background:transparent; border:1px solid var(--vp-c-divider); color:var(--vp-c-text-2); }
.btn-ghost:hover { border-color:var(--vp-c-brand-1); color:var(--vp-c-brand-1); }
.btn-sm { padding:4px 12px; font-size:12px; }
</style>
