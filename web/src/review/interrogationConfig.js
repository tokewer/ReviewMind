// ReviewMind AI 深度拷问系统规则与工作流配置中心
// 开放规则填写、工作流程编排与人工自定义规则注入

const CONFIG_STORAGE_KEY = 'MIND_MAP_INTERROGATION_CUSTOM_RULES'

export const DEFAULT_INTERROGATION_CONFIG = {
  // 1. 考官核心提示词与规则（用户可在此基础上人工追加或自由修改）
  // 核心最高指导原则：所有内容必须为高考服务，不需要复习、考察过度超纲（对高考没有帮助的内容）
  memoryCustomRules: `1. 核心定位：模式一聚焦【有什么、是什么】（高考直接主力军，卷面直接考查、直接拿分）；
2. 原位遮盖直问铁律：只考思维导图的内容！将导图节点内容遮盖起来后，直接针对该被遮盖内容本身提问，严禁过度拓展延伸、严禁考导图外乱七八糟的内容；
3. 清晰性与针对性：题干必须直白清晰，让人一眼看明白考的是哪一项内容，不堆砌模糊套话，不与同级兄弟节点混淆；
4. 高考导向铁律：所有内容必须为高考服务，不需要复习、考察过度超纲（对高考没有帮助的内容）；
5. 考查重点：精准还原被遮盖节点的【有什么】（要素清单）与【是什么】（定义、概念、原文名句、公式表述）；
6. 难写字精准提取：仅当考查内容涉及古诗文名句、笔画繁难生僻字时，才将其提取到 difficult_chars 供手写练字；普通概念免除手写。`,

  understandingCustomRules: `1. 核心定位：模式二聚焦【为什么、为了什么】（高考理解后勤部，深度理解大题后盾）；
2. 原位遮盖直问铁律：只考思维导图的内容！对被遮盖节点内容严格保真提问，严禁脱离导图向外发散拓展或考无关题外话；
3. 清晰性与针对性：紧扣导图层级因果关系，直白点明究竟在问该节点的什么【为什么】（原因/机理）或【为了什么】（作用/目的），确保一看就懂考什么；
4. 高考导向铁律：所有内容必须为高考服务，不需要复习、考察过度超纲（对高考没有帮助的内容）；
5. 严禁剧透答案，全键盘思维推导与心中默答，完全免除手写板。`,

  // 2. 自定义学科/场景附加指令
  customExtraInstructions: '只考思维导图的内容！对节点内容原位遮盖后清晰直接提问，严禁过度拓展延伸和考乱七八糟的无关内容；所有内容必须为高考服务，不需要复习、考察过度超纲（对高考没有帮助的内容）。',

  // 3. 工作流程编排选项
  workflow: {
    requireUnderstandingFirst: true, // 内容记忆模式：先考意境/逻辑理解，再引导回忆背诵
    tianzigeDifficultCharsOnly: true, // 仅易错难写字激活数位板田字格手写
    allowMentalAnswer: true, // 允许心中默答（看答案自评）
    defaultAnswerType: 'mental', // 默认作答偏好：'mental' (心中默答) | 'text' (键盘打字)
    autoFlipNodeOnPass: true, // 答对或看答案后，导图对应节点自动翻牌变绿显示标准答案
    memoryDimensions: ['what', 'which'], // 模式 1 考察维度：有什么、是什么（高考直接主力军）
    understandingDimensions: ['why', 'for_what'] // 模式 2 考察维度：为什么、为了什么（高考理解后勤部）
  }
}

/**
 * 读取当前存储的规则与工作流配置
 */
export function getInterrogationConfig() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CONFIG_STORAGE_KEY) : null
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_INTERROGATION_CONFIG))
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_INTERROGATION_CONFIG,
      ...parsed,
      workflow: {
        ...DEFAULT_INTERROGATION_CONFIG.workflow,
        ...(parsed.workflow || {})
      }
    }
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_INTERROGATION_CONFIG))
  }
}

/**
 * 保存用户自定义的规则与工作流配置
 */
export function saveInterrogationConfig(cfg) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg))
    }
    return true
  } catch (e) {
    return false
  }
}

/**
 * 恢复为官方推荐默认规则与工作流
 */
export function resetInterrogationConfig() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(CONFIG_STORAGE_KEY)
    }
    return JSON.parse(JSON.stringify(DEFAULT_INTERROGATION_CONFIG))
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_INTERROGATION_CONFIG))
  }
}
