// ReviewMind AI 深度拷问系统规则与工作流配置中心
// 开放规则填写、工作流程编排与人工自定义规则注入

const CONFIG_STORAGE_KEY = 'MIND_MAP_INTERROGATION_CUSTOM_RULES'

export const DEFAULT_INTERROGATION_CONFIG = {
  // 1. 考官核心提示词与规则（用户可在此基础上人工追加或自由修改）
  memoryCustomRules: `1. 注重理解：出题必须先从上下文语境、逻辑关系或意境设问，以理解驱动记忆；
2. 生僻字精准提取：仅当考查内容涉及古诗文名句、笔画繁难生僻字时，才将其提取到 difficult_chars 供手写练字；
3. 普通概念与英语作文素材：严禁要求手写，保持轻快高效。`,

  understandingCustomRules: `1. 四维透视认知模型：围绕【有哪些、是什么、为什么、为了什么】发起深度复盘；
2. 严禁剧透答案，直击思维链条与因果机制；
3. 全键盘思维推导，完全免除手写板，专注思维严密性。`,

  // 2. 自定义学科/场景附加指令（如：“高考语文强化古文翻译与通假字”、“高考英语注重同义替换与从句”）
  customExtraInstructions: '',

  // 3. 工作流程编排选项
  workflow: {
    requireUnderstandingFirst: true, // 内容记忆模式：先考意境/逻辑理解，再引导回忆背诵
    tianzigeDifficultCharsOnly: true, // 仅易错难写字激活数位板田字格手写
    allowMentalAnswer: true, // 允许心中默答（看答案自评）
    defaultAnswerType: 'mental', // 默认作答偏好：'mental' (心中默答) | 'text' (键盘打字)
    autoFlipNodeOnPass: true, // 答对或看答案后，导图对应节点自动翻牌变绿显示标准答案
    understandingDimensions: ['which', 'what', 'why', 'for_what'] // 内容理解模式激活的维度
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
