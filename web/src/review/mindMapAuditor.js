import { getInterrogationConfig } from './interrogationConfig'
// ReviewMind 思维导图学术审校与认知纠错引擎
// 负责与大模型（Gemini 1.5/2.0 Pro、DeepSeek-R1/V3、GPT-4o 等）交互
// 铁律：绝对禁止 AI 自动替学生代写补全子节点，仅提供 4 维严苛体检诊断与启发式自查问题

import { getJudgeAiConfig } from './handwritingJudge'
import { extractKnowledgeOutline } from '@/utils/mindMapKnowledgeExtractor'

export const AUDITOR_SYSTEM_PROMPT = `# Role: 思维导图学术审校与认知纠错考官

你负责对学生的思维导图进行严苛的学术与逻辑体检，挖掘深层认知盲区。

---

## 严苛教学铁律（核心原则）
1. **绝对禁止替学生代写、补充任何子节点**：学习必须由学生自己动脑完成。你必须只指出病因与思考方向，绝不可提供可直接复制粘贴的现成导图子分支。
2. **直击认知硬伤**：不讲客套闲聊废话，像高考阅卷组长或学术导师一样，冷峻、专业、一针见血。

---

## 4 维体检诊断模型
对导图的审查严格按照以下 4 类问题定位：
1. \`FACTUAL_ERROR\`（事实与定义硬伤）：定理、公式、参数、年代、因果机制存在客观科学错误。
2. \`HIERARCHY_INVERSION\`（层级倒置与逻辑越级）：并列关系被误归为从属，或个别特例被置于公理之上。
3. \`MISSING_PREREQUISITE\`（前提缺失与逻辑跳跃）：推导链条突兀跳跃，遗漏了核心成立边界（如“在惯性系中”、“必须在真空条件下”）。
4. \`CONFUSION_RISK\`（易混概念与伪等价）：将机理不同的相似概念画了等号（如把“内能”等同于“热量”，把“重力”等同于“万有引力”）。

---

## 输出规范（强制纯 JSON 格式）
必须且仅能输出一个合法的 JSON 对象，严禁包裹任何 Markdown 解释或多余字符：

{
  "summary": "一句话冷峻概括本次导图体检的整体质量与核心问题密度",
  "score": 85, // 0~100 综合逻辑分
  "issues": [
    {
      "node_id": "节点对应的 ID (如有)",
      "node_text": "节点显示的文本",
      "severity": "CRITICAL" | "WARNING" | "SUGGESTION", // 严重硬伤 / 逻辑缺陷 / 表达优化
      "category": "FACTUAL_ERROR" | "HIERARCHY_INVERSION" | "MISSING_PREREQUISITE" | "CONFUSION_RISK",
      "critique": "指出该节点的具体致命漏洞所在",
      "socratic_question": "抛出一道启发学生自查思考的问题，引导其自行修改导图"
    }
  ]
}`

export const INTERROGATION_SYSTEM_PROMPT = `# Role: 思维导图苏格拉底式高阶考官

你负责依据学生的思维导图知识大纲，针对关键节点发起深度口试拷问，考查其真实思维链路。

---

## 提问策略（三阶递进）
1. **溯源本质题 (essence)**：考查核心概念的内涵、外延与本质属性。
2. **逻辑推导题 (derivation)**：考查从上层节点推演至下层节点所依赖的中间逻辑链条。
3. **边界反例题 (counterexample)**：考查极限情境、反例辨析与易错陷阱。

---

## 铁律
严禁在题干中直接透露答案！提出富有思辨挑战性的情境问题，要求学生用自己的语言进行阐述推导。

---

## 输出规范（强制 JSON）
{
  "target_node_id": "考查的节点 ID",
  "target_node_text": "节点名称",
  "question_type": "essence" | "derivation" | "counterexample",
  "question": "具体的考查问题题干",
  "evaluation_criteria": "答题判定核心要点（仅供考官评估）"
}`
export const MEMORY_INTERROGATION_SYSTEM_PROMPT = `# Role: 高考直接主力军 · 思维导图原位遮盖考官 · 模式一【有什么、是什么】（清晰直问 · 绝不拓展）

你负责将学生的思维导图节点内容“遮盖”起来，贯彻“注重理解，只有理解了才能记忆住”理念，**只针对该被遮盖节点本身的内容**提出清晰、具体、直白的问题，考查【有什么】（要素/分类）与【是什么】（定义/原文/公式/结论）。

---

## 核心总原则（最高指导铁律）
1. **只考思维导图的内容，严禁过度拓展延伸**：
   - 被遮盖节点的原始内容（\`masked_content\`）就是这道题的唯一答案。
   - **绝对禁止**向外发散拓展导图里没有的知识点、**绝对禁止**编造无关背景或考乱七八糟的题外话！
   - 所有内容必须为高考服务，不需要复习、考察过度超纲（对高考没有帮助的内容）。
2. **保证问题的清晰性与针对性（确保学生一眼看明白考的什么）**：
   - 题干必须直接、明确、简练，清楚指明是在问导图哪个父分支下的哪项内容（例如“在【父节点】分支下，进行该过程的具体场所是什么？”）。
   - **严禁堆砌晦涩模糊的套话**（禁止使用“请阐述其核心内涵属性与本质特征”这种空洞套话）。
   - 若同级有多个兄弟节点，请结合父子路径与兄弟节点的区别明确提问焦点，避免与兄弟节点混淆（但**绝不能在题干中直接剧透答案核心词**）。
3. **生僻难写易错字精准提取**：
   - 仅当被遮盖内容包含古诗文名句或笔画繁难易错字时，将难写字填入 \`difficult_chars\` 并设 \`has_difficult_chars: true\`；其余情况设 \`has_difficult_chars: false\`，\`difficult_chars: []\`。

---

## 输出规范（强制纯 JSON 格式）
{
  "target_node_id": "考查的节点 ID",
  "target_node_text": "被遮盖节点定位名称",
  "dimension": "what" | "which",
  "dimension_name": "是什么" | "有什么",
  "aspect_subdivision": "简明的考查焦点（如：具体定义 / 核心要素 / 名句原句 / 适用条件）",
  "question": "清晰直白的提问题干（一眼看懂在问被遮盖节点的什么内容，绝不剧透答案、绝不拓展导图外知识）",
  "understanding_hint": "简短不剧透的作答范围提示（例如提示所属范围或字数）",
  "standard_answer": "原节点被遮盖的原始内容（100%忠实于导图）",
  "has_difficult_chars": false,
  "difficult_chars": [],
  "evaluation_criteria": "对照导图原节点的核对要点"
}`

export const UNDERSTANDING_INTERROGATION_SYSTEM_PROMPT = `# Role: 高考理解后勤部 · 思维导图原位遮盖考官 · 模式二【为什么、为了什么】（精准因果直问 · 绝不拓展）

你负责将学生的思维导图节点内容“遮盖”起来，围绕【为什么】（原因/机理/依据）与【为了什么】（作用/目的/意义）两大维度，**只针对被遮盖节点本身在导图中的逻辑内容**发起清晰、具体的提问。

---

## 核心总原则（最高指导铁律）
1. **只考思维导图的内容，严禁过度拓展延伸**：
   - 被遮盖节点的原始内容（\`masked_content\`）就是这道题的唯一答案。
   - **绝对禁止**脱离导图向外发散、**绝对禁止**出导图里根本没有涉及的复杂大题或乱七八糟的内容！
   - 所有内容必须为高考服务，不需要复习、考察过度超纲（对高考没有帮助的内容）。
2. **保证问题的清晰性与针对性（确保学生一眼看明白考的什么）**：
   - 题干必须开门见山、直白好懂，让人一眼就知道要回答导图里哪一处的原因、作用或机理（禁止用“剖析引入该概念的工具价值与高考大题迁移破题”这类空洞绕口套话）。
   - 结合父节点路径与同级节点语境，清晰锁定唯一被遮盖的这一条节点内容，且**绝不在题干中剧透答案词**。
3. **纯思维作答**：免除手写练字，\`has_difficult_chars\` 固定为 false。

---

## 输出规范（强制纯 JSON 格式）
{
  "target_node_id": "考查的节点 ID",
  "target_node_text": "被遮盖节点定位名称",
  "dimension": "why" | "for_what",
  "dimension_name": "为什么" | "为了什么",
  "aspect_subdivision": "简明的理解考查焦点（如：产生原因 / 成立条件 / 核心作用 / 主要目的）",
  "question": "清晰直白的提问题干（一眼看懂在问被遮盖节点的什么原因/作用/机理，绝不剧透、绝不拓展导图外内容）",
  "understanding_hint": "简短不剧透的作答范围提示",
  "standard_answer": "原节点被遮盖的原始内容（100%忠实于导图）",
  "evaluation_criteria": "对照导图原节点逻辑要点的核对标准"
}`

export function parseModelJsonResponse(rawText) {
  if (!rawText) return null
  let cleaned = rawText.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '')
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '')
  }
  try {
    return JSON.parse(cleaned)
  } catch (e) {
    // 尝试正则截取合法 JSON 块
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch (err) { return null; }
    }
    return null
  }
}

/**
 * 执行思维导图学术审校与逻辑体检
 * @param {Object} rootNode 导图根节点
 * @param {Object} [options] 选项 { focusNodeId, customApiKey, customBaseUrl, customModel }
 */
export async function auditMindMap(rootNode, options = {}) {
  const outline = extractKnowledgeOutline(rootNode, {
    focusNodeId: options.focusNodeId,
    maxDepth: 6,
    includeIds: true
  })

  if (!outline) {
    throw new Error('当前思维导图大纲为空，请先绘制内容后再进行审校体检。')
  }

  const cfg = getJudgeAiConfig()
  const apiKey = options.customApiKey || cfg.apiKey
  const baseUrl = options.customBaseUrl || cfg.baseUrl
  const model = options.customModel || cfg.modelName

  if (!apiKey) {
    throw new Error('未配置 AI API Key，请先在设置中填入 API 密钥（支持 Gemini、DeepSeek、OpenAI 等）。')
  }

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`

  const userPrompt = `请对以下思维导图进行严苛学术审校与逻辑体检（严格执行四维体检与禁止代写铁律）：\n\n\`\`\`markdown\n${outline}\n\`\`\``

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: AUDITOR_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AI 请求失败 (HTTP ${response.status}): ${errorText.slice(0, 300)}`)
  }

  const resJson = await response.json()
  const rawContent = resJson.choices?.[0]?.message?.content || ''
  const parsed = parseModelJsonResponse(rawContent)

  if (!parsed || !Array.isArray(parsed.issues)) {
    throw new Error('模型返回的数据格式不符合审校结构，请重试或更换模型。')
  }

  return parsed
}

/**
 * 自动生成苏格拉底深度考题
 */
export async function generateSocraticQuiz(rootNode, options = {}) {
  const outline = extractKnowledgeOutline(rootNode, {
    focusNodeId: options.focusNodeId,
    maxDepth: 6,
    includeIds: true
  })

  if (!outline) {
    throw new Error('当前思维导图大纲为空，无法出题。')
  }

  const cfg = getJudgeAiConfig()
  const apiKey = options.customApiKey || cfg.apiKey
  const baseUrl = options.customBaseUrl || cfg.baseUrl
  const model = options.customModel || cfg.modelName

  if (!apiKey) {
    throw new Error('未配置 AI API Key，请先配置。')
  }

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`

  const userPrompt = `根据以下思维导图的核心概念，出一道最具深度与思辨性的考题（题型偏好：${options.questionType || '综合'}）：\n\n\`\`\`markdown\n${outline}\n\`\`\``

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: INTERROGATION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`考题生成失败 (HTTP ${response.status}): ${errorText.slice(0, 300)}`)
  }

  const resJson = await response.json()
  const rawContent = resJson.choices?.[0]?.message?.content || ''
  return parseModelJsonResponse(rawContent)
}


/**
 * 自动生成【内容记忆模式】考题（以理解促记忆，提取难写生僻字）
 */
export async function generateMemoryQuiz(rootNode, options = {}) {
  const outline = extractKnowledgeOutline(rootNode, {
    focusNodeId: options.focusNodeId,
    maxDepth: 6,
    includeIds: true
  })

  if (!outline) {
    throw new Error('当前思维导图大纲为空，无法出题。')
  }

  const cfg = getJudgeAiConfig()
  const apiKey = options.customApiKey || cfg.apiKey
  const baseUrl = options.customBaseUrl || cfg.baseUrl
  const model = options.customModel || cfg.modelName

  if (!apiKey) {
    throw new Error('未配置 AI API Key，请先配置。')
  }

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`

  const userPrompt = `请根据以下思维导图节点及其子节点，出一道【注重理解、以理解促记忆】的记忆性考查题（若含古诗文难写易错字，精准提取至 difficult_chars）：\n\n\`\`\`markdown\n${outline}\n\`\`\``

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: MEMORY_INTERROGATION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`记忆考题生成失败 (HTTP ${response.status}): ${errorText.slice(0, 300)}`)
  }

  const resJson = await response.json()
  const rawContent = resJson.choices?.[0]?.message?.content || ''
  return parseModelJsonResponse(rawContent)
}

/**
 * 自动生成【内容理解模式】考题（围绕 有哪些 / 是什么 / 为什么 / 为了什么 四维复盘）
 */
export async function generateUnderstandingQuiz(rootNode, options = {}) {
  const outline = extractKnowledgeOutline(rootNode, {
    focusNodeId: options.focusNodeId,
    maxDepth: 6,
    includeIds: true
  })

  if (!outline) {
    throw new Error('当前思维导图大纲为空，无法出题。')
  }

  const cfg = getJudgeAiConfig()
  const apiKey = options.customApiKey || cfg.apiKey
  const baseUrl = options.customBaseUrl || cfg.baseUrl
  const model = options.customModel || cfg.modelName

  if (!apiKey) {
    throw new Error('未配置 AI API Key，请先配置。')
  }

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`
  const dimension = options.dimension || 'what'
  const dimNames = {
    which: '【有哪些】(组成要素/分类分支/形态)',
    what: '【是什么】(本质定义/学科表述/概念边界)',
    why: '【为什么】(深层机理/因果推导/成立依据)',
    for_what: '【为了什么】(目的价值/解决什么问题/实际应用)'
  }
  const dimName = dimNames[dimension] || '【是什么】'

  const userPrompt = `请根据以下思维导图节点及其子节点，围绕维度 ${dimName}，出一道穿透性的深度理解考题：\n\n\`\`\`markdown\n${outline}\n\`\`\``

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: UNDERSTANDING_INTERROGATION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`理解考题生成失败 (HTTP ${response.status}): ${errorText.slice(0, 300)}`)
  }

  const resJson = await response.json()
  const rawContent = resJson.choices?.[0]?.message?.content || ''
  return parseModelJsonResponse(rawContent)
}


/**
 * 高考常考与古诗文必背易错繁难生僻字表
 */
export const GAOKAO_DIFFICULT_CHARS = [
  '舸', '舰', '鹜', '渚', '汀', '蜉', '蝣', '旌', '舳', '舻', '璧', '瑟', '峥', '嵘', '崔', '嵬',
  '喧', '豗', '砯', '崖', '巉', '樯', '橹', '黍', '潦', '骖', '騑', '闼', '皓', '魄', '棹', '徘',
  '徊', '愀', '溘', '羁', '辔', '暧', '墟', '榆', '柳', '呦', '衿', '契', '阔', '踯', '躅', '伶',
  '俜', '窈', '窕', '葳', '蕤', '玳', '瑁', '拊', '榻', '哽', '咽', '躞', '蹀', '髫', '龀', '伛',
  '偻', '携', '觥', '筹', '晦', '暝', '霏', '檮', '杌', '饕', '餮', '魑', '魅', '魍', '魉', '倜',
  '傥', '沆', '瀣', '窾', '坎', '铿', '锵', '磬', '鹘', '磔', '罅', '溯', '凭', '虚', '御'
]

/**
 * 精准检测文本中包含的高考易错生僻字
 */
export function detectDifficultChars(text) {
  if (!text || typeof text !== 'string') return []
  const found = []
  for (const char of text) {
    if (GAOKAO_DIFFICULT_CHARS.includes(char) && !found.includes(char)) {
      found.push(char)
    }
  }
  return found
}

/**
 * 本地确定性构建【挖空设问思维导图】(Quiz Mind Map Tree)
 * 100% 忠实保留用户真实思维导图层级，去答案化变设问，并注入细分考查方向与视觉进度样式
 */
/**
 * 过滤 HTML 标签与富文本标签，保证题干与导图文本纯净
 */
const HTML_TAG_REGEX = /<(?:\/?[a-zA-Z][a-zA-Z0-9:-]*|!--)[\s\S]*?>/g

export function stripHtml(text) {
  if (!text || typeof text !== 'string') return ''
  let res = text
  for (let i = 0; i < 3; i++) {
    const prev = res
    res = res
      .replace(HTML_TAG_REGEX, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
      .replace(HTML_TAG_REGEX, '')
    if (res === prev) break
  }
  return res.replace(/\s+/g, ' ').trim()
}

/**
 * 识别节点文本中自然存在的 "标签：内容" 结构（如 "定义：..."、"公式：F=ma"）
 * 用于原位遮盖时保留清晰的题目提示前缀，只遮盖冒号后的核心答案
 */
export function extractNodeMaskInfo(rawText) {
  const clean = stripHtml(rawText || '')
  const colonMatch = clean.match(/^([^：:]{1,18})[：:]\s*(.+)$/)
  if (colonMatch) {
    const prefix = colonMatch[1].trim()
    const rest = colonMatch[2].trim()
    if (!/^https?$/i.test(prefix) && !/^\d+$/.test(prefix) && rest.length > 0) {
      return {
        hasSlotLabel: true,
        slotLabel: prefix,
        maskedContent: rest,
        fullContent: clean
      }
    }
  }
  return {
    hasSlotLabel: false,
    slotLabel: '',
    maskedContent: clean,
    fullContent: clean
  }
}

export function buildQuizMindMapTree(rootNodeData, options = {}) {
  if (!rootNodeData || !rootNodeData.data) {
    throw new Error('当前思维导图大纲为空，无法构建考查导图。')
  }

  const cloned = JSON.parse(JSON.stringify(rootNodeData))
  const mode = options.mode || 'memory'
  const focusNodeId = options.focusNodeId || null

  let targetRoot = cloned
  if (focusNodeId) {
    const findNode = (node) => {
      if (!node) return null
      const id = node.data?.uid || node.data?.id
      if (id === focusNodeId) return node
      for (const child of node.children || []) {
        const found = findNode(child)
        if (found) return found
      }
      return null
    }
    const foundSub = findNode(cloned)
    if (foundSub) {
      targetRoot = foundSub
    }
  }

  let quizIndex = 0

  const traverse = (node, path = [], siblingIndex = 1, siblingCount = 1, siblingTexts = []) => {
    if (!node || !node.data) return
    node.data.expand = true
    // 强制清洗富文本 HTML 标签，保证纯文本呈现
    const rawText = stripHtml(node.data.text || '')
    const currentPath = [...path, rawText]
    const children = node.children || []
    const isLeaf = children.length === 0

    // 清除富文本标志，避免 simple-mind-map 用 HTML 渲染污染节点
    delete node.data.richText
    node.data.resetRichText = true
    if (node.data.generalization) {
      delete node.data.generalization.richText
      node.data.generalization.resetRichText = true
      node.data.generalization.expand = true
      node.data.generalization.text = stripHtml(node.data.generalization.text || '')
    }

    if (isLeaf && rawText.length > 0 && !rawText.startsWith('❓')) {
      const qIndex = quizIndex++
      const parentName = path.length > 0 ? stripHtml(path[path.length - 1]) : '核心考点'
      const breadcrumb = path.map(p => stripHtml(p)).join(' ➔ ') || '主干知识网络'
      const maskInfo = extractNodeMaskInfo(rawText)
      const noteText = stripHtml(node.data.note || '')

      let dimension = 'what'
      let dimension_name = '是什么'
      let aspect_subdivision = ''
      let question_title = ''
      let understanding_hint = ''
      let hasDifficult = false
      let diffChars = []

      const targetDisplayText = maskInfo.hasSlotLabel
        ? `${parentName} ➔ ${maskInfo.slotLabel}`
        : (siblingCount > 1 ? `${parentName}（第 ${siblingIndex}/${siblingCount} 项）` : parentName)

      const maskedDisplayLabel = maskInfo.hasSlotLabel
        ? `${maskInfo.slotLabel}：______`
        : (siblingCount > 1
            ? `第${siblingIndex}/${siblingCount}项已遮盖 · ${rawText.length}字`
            : `已遮盖 · ${rawText.length}字`)

      const siblingHint = siblingCount > 1 ? `同级第 ${siblingIndex} 项（共 ${siblingCount} 项），` : ''

      if (mode === 'memory') {
        diffChars = detectDifficultChars(rawText)
        hasDifficult = diffChars.length > 0

        if (maskInfo.hasSlotLabel) {
          dimension = 'what'
          dimension_name = '是什么'
          aspect_subdivision = `导图原位遮盖 · 「${maskInfo.slotLabel}」内容还原`
          question_title = `在导图【${breadcrumb}】中，被遮盖节点「${maskInfo.slotLabel}」的具体内容是什么？（约 ${maskInfo.maskedContent.length} 字）`
          understanding_hint = `位于【${breadcrumb}】${siblingHint}仅回忆「${maskInfo.slotLabel}」被遮盖的原文内容，不拓展导图外知识。`
        } else if (hasDifficult || (/[一-龥]{8,}/.test(rawText) && /[，。！？；、]/.test(rawText))) {
          dimension = 'what'
          dimension_name = '是什么'
          aspect_subdivision = hasDifficult ? '导图原句默写 · 含易错生僻字检查' : '导图原文/要点精准还原'
          question_title = `请回忆并补全导图【${breadcrumb}】中${siblingCount > 1 ? `第 ${siblingIndex} 项` : '当前'}被遮盖的原文内容（约 ${rawText.length} 字）。`
          understanding_hint = `位于【${breadcrumb}】${siblingHint}紧扣导图原内容作答${hasDifficult ? '，注意笔画繁难生僻字' : ''}。`
        } else if (rawText.includes('、') || rawText.includes('/')) {
          dimension = 'which'
          dimension_name = '有什么'
          aspect_subdivision = '导图原位遮盖 · 并列要素还原'
          question_title = `在导图【${breadcrumb}】分支下，${siblingCount > 1 ? `第 ${siblingIndex} 个` : '当前'}被遮盖节点写明了哪些具体要素？（约 ${rawText.length} 字）`
          understanding_hint = `位于【${breadcrumb}】${siblingHint}仅列出该被遮盖节点原本记录的内容。`
        } else {
          dimension = 'what'
          dimension_name = '是什么'
          aspect_subdivision = '导图原位遮盖 · 节点内容回忆'
          question_title = `请回忆导图【${breadcrumb}】下${siblingCount > 1 ? `第 ${siblingIndex} 个` : '当前'}被遮盖节点的具体内容是什么？（约 ${rawText.length} 字）`
          understanding_hint = `位于【${breadcrumb}】${siblingHint}仅回忆该被遮盖节点本身的内容，不考导图外拓展知识。`
        }
      } else {
        const isWhy = /原因|成因|因为|由于|机理|依据|条件|规律|推导/.test(maskInfo.slotLabel + rawText)
        const isForWhat = /为了|目的|作用|意义|价值|解决/.test(maskInfo.slotLabel + rawText)
        if (isForWhat && !isWhy) {
          dimension = 'for_what'
          dimension_name = '为了什么'
          aspect_subdivision = maskInfo.hasSlotLabel ? `导图原位遮盖 · 「${maskInfo.slotLabel}」作用/目的` : '导图原位遮盖 · 作用与目的复盘'
          question_title = maskInfo.hasSlotLabel
            ? `在导图【${breadcrumb}】中，关于「${maskInfo.slotLabel}」被遮盖的作用、目的或意义是什么？（约 ${maskInfo.maskedContent.length} 字）`
            : `请结合导图【${breadcrumb}】，说明${siblingCount > 1 ? `第 ${siblingIndex} 个` : '当前'}被遮盖节点写明的作用、目的或意义是什么？（约 ${rawText.length} 字）`
          understanding_hint = `位于【${breadcrumb}】${siblingHint}只围绕该被遮盖节点记录的作用/目的作答，不拓展导图外内容。`
        } else {
          dimension = 'why'
          dimension_name = '为什么'
          aspect_subdivision = maskInfo.hasSlotLabel ? `导图原位遮盖 · 「${maskInfo.slotLabel}」原因/机理` : '导图原位遮盖 · 原因与依据复盘'
          question_title = maskInfo.hasSlotLabel
            ? `在导图【${breadcrumb}】中，关于「${maskInfo.slotLabel}」被遮盖的原因、条件或核心结论是什么？（约 ${maskInfo.maskedContent.length} 字）`
            : `请结合导图【${breadcrumb}】，回答${siblingCount > 1 ? `第 ${siblingIndex} 个` : '当前'}被遮盖节点所说明的原因、依据或结论内容（约 ${rawText.length} 字）。`
          understanding_hint = `位于【${breadcrumb}】${siblingHint}只紧扣该被遮盖节点本身的内容作答，不拓展导图外知识。`
        }
      }

      node.data.isQuestion = true
      node.data.quizIndex = qIndex
      node.data.target_node_id = node.data.uid || node.data.id || `quiz_node_${qIndex}`
      node.data.status = 'pending'
      node.data.dimension = dimension
      node.data.dimension_name = dimension_name
      node.data.aspect_domain = breadcrumb
      node.data.aspect_subdivision = aspect_subdivision
      node.data.target_node_text = targetDisplayText
      node.data.masked_label = maskedDisplayLabel
      node.data.slot_label = maskInfo.slotLabel
      node.data.sibling_index = siblingIndex
      node.data.sibling_count = siblingCount
      node.data.sibling_context = siblingTexts
      node.data.node_note = noteText
      node.data.question_title = question_title
      node.data.understanding_hint = understanding_hint
      node.data.standard_answer = rawText
      node.data.has_difficult_chars = hasDifficult
      node.data.difficult_chars = diffChars
      node.data.evaluation_criteria = `对照导图原节点内容核对：${rawText}`

      // 视觉进度初始状态：黄色待考查，原位遮盖提示，纯文本无任何 HTML 标签
      node.data.text = `❓ [${maskedDisplayLabel}] (${qIndex + 1})`
      node.data.fillColor = '#fefce8'
      node.data.borderColor = '#eab308'
      node.data.borderWidth = 2
      node.data.color = '#854d0e'
    } else {
      if (node === targetRoot) {
        node.data.text = `${rawText} [${mode === 'memory' ? '原位遮盖记忆' : '原位遮盖理解'}]`
      } else {
        node.data.text = rawText
      }
    }

    const childTexts = children.map(c => stripHtml(c?.data?.text || '')).filter(Boolean)
    children.forEach((child, idx) => {
      traverse(child, currentPath, idx + 1, children.length, childTexts)
    })
  }

  traverse(targetRoot, [], 1, 1, [])

  if (quizIndex === 0) {
    const rawRootText = stripHtml(targetRoot.data.text || '')
    const maskLabel = `内容已遮盖 · ${rawRootText.length}字`
    delete targetRoot.data.richText
    targetRoot.data.resetRichText = true
    targetRoot.data.expand = true
    targetRoot.data.isQuestion = true
    targetRoot.data.quizIndex = 0
    targetRoot.data.target_node_id = targetRoot.data.uid || targetRoot.data.id || 'quiz_node_0'
    targetRoot.data.status = 'pending'
    targetRoot.data.dimension = mode === 'memory' ? 'what' : 'why'
    targetRoot.data.dimension_name = mode === 'memory' ? '是什么' : '为什么'
    targetRoot.data.aspect_domain = '核心知识网络'
    targetRoot.data.aspect_subdivision = '导图原位遮盖 · 单节点内容还原'
    targetRoot.data.target_node_text = rawRootText
    targetRoot.data.masked_label = maskLabel
    targetRoot.data.slot_label = ''
    targetRoot.data.sibling_index = 1
    targetRoot.data.sibling_count = 1
    targetRoot.data.sibling_context = []
    targetRoot.data.question_title = `请回忆当前导图核心节点被遮盖的内容（约 ${rawRootText.length} 字）。`
    targetRoot.data.understanding_hint = '仅回忆该被遮盖节点本身记录的内容。'
    targetRoot.data.standard_answer = rawRootText
    targetRoot.data.evaluation_criteria = `对照导图原节点内容核对：${rawRootText}`
    targetRoot.data.text = `❓ [${maskLabel}] (1)`
    targetRoot.data.fillColor = '#fefce8'
    targetRoot.data.borderColor = '#eab308'
    targetRoot.data.borderWidth = 2
    targetRoot.data.color = '#854d0e'
  }

  return { root: targetRoot }
}

/**
 * 基于思维导图由大模型生成原位遮盖精准考题导图树
 * 铁律：只考思维导图的内容！对节点内容原位遮盖后清晰直接提问，严禁过度拓展延伸和考乱七八糟内容
 */
export async function generateQuizMindMapTree(rootNodeData, options = {}) {
  const baseResult = buildQuizMindMapTree(rootNodeData, options)
  const treeRoot = baseResult.root

  const questionNodes = []
  const collectNodes = (node) => {
    if (!node || !node.data) return
    if (node.data.isQuestion) {
      questionNodes.push(node)
    }
    for (const child of node.children || []) {
      collectNodes(child)
    }
  }
  collectNodes(treeRoot)

  if (questionNodes.length === 0) {
    return baseResult
  }

  const cfg = getJudgeAiConfig()
  const apiKey = options.customApiKey || cfg.apiKey
  const baseUrl = options.customBaseUrl || cfg.baseUrl
  const model = options.customModel || cfg.modelName

  if (!apiKey) {
    return {
      ...baseResult,
      aiGenerated: false,
      aiNotice: '当前未配置 AI API Key，已启用本地原位遮盖直问模型。在 API 配置中填入密钥可由 AI 优化提问清晰度。'
    }
  }

  const outline = extractKnowledgeOutline(rootNodeData, {
    focusNodeId: options.focusNodeId,
    maxDepth: 6,
    includeIds: true
  })

  const mode = options.mode || 'memory'
  const interrogationCfg = getInterrogationConfig()
  const customRules = mode === 'memory'
    ? interrogationCfg.memoryCustomRules
    : interrogationCfg.understandingCustomRules
  const extraInstructions = interrogationCfg.customExtraInstructions || ''

  const baseSystemPrompt = mode === 'memory'
    ? MEMORY_INTERROGATION_SYSTEM_PROMPT
    : UNDERSTANDING_INTERROGATION_SYSTEM_PROMPT

  const systemPrompt = `${baseSystemPrompt}

---

## 附加用户定制规则：
${customRules}
${extraInstructions ? `\n附加要求：${extraInstructions}` : ''}

---

## 批量出题输出规范（必须严格输出合法的纯 JSON 格式）
你必须且仅能输出一个 JSON 对象，结构如下：
{
  "questions": [
    {
      "target_node_id": "对应考查节点的 ID",
      "target_node_text": "被遮盖节点定位名称（纯文本）",
      "dimension": "what" | "which" | "why" | "for_what",
      "dimension_name": "是什么" | "有什么" | "为什么" | "为了什么",
      "aspect_subdivision": "简明的考查焦点（5~12字，如：具体作用 / 核心定义 / 成立条件 / 名句补全）",
      "question": "清晰直白的问题（只问该节点被遮盖的原始内容，让人一眼看懂考什么；绝不拓展导图外内容，绝不剧透答案核心词）",
      "understanding_hint": "简短不剧透的作答范围提示（例如提示所属类别或字数）",
      "standard_answer": "原节点被遮盖的原始内容（原封不动保留 masked_content）",
      "has_difficult_chars": false,
      "difficult_chars": [],
      "evaluation_criteria": "对照导图原节点的核对要点"
    }
  ]
}`

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`
  let anyAiSuccess = false
  let lastError = null

  // 分批处理最多 45 个节点（每批 15 个），确保大分支每个被遮盖节点都能得到清晰精准提问
  const maxTotalNodes = Math.min(questionNodes.length, 45)
  for (let start = 0; start < maxTotalNodes; start += 15) {
    const batchNodes = questionNodes.slice(start, start + 15)
    const targetNodesPayload = batchNodes.map((qNode, idx) => {
      return {
        index: start + idx + 1,
        target_node_id: qNode.data.target_node_id || qNode.data.uid || qNode.data.id || `node_${start + idx}`,
        path: stripHtml(qNode.data.aspect_domain || ''),
        slot_label: qNode.data.slot_label || '',
        sibling_position: qNode.data.sibling_count > 1
          ? `第 ${qNode.data.sibling_index} 项（同级共 ${qNode.data.sibling_count} 项）`
          : '唯一子节点',
        sibling_titles_context: Array.isArray(qNode.data.sibling_context) ? qNode.data.sibling_context : [],
        node_note: qNode.data.node_note || '',
        masked_content: stripHtml(qNode.data.standard_answer || '')
      }
    })

    const userPrompt = `请严格阅读以下思维导图大纲，并针对清单中的每个被遮盖节点编写一道**清晰、直白、只考该节点本身内容**的问题：

【重要要求】：
1. **只考思维导图的内容**：每个节点的 \`masked_content\` 就是这道题的唯一答案，**绝对不要拓展衍生导图外的知识，不要考乱七八糟的内容**。
2. **让人看明白考什么**：题干要简洁直白，利用 \`path\`、\`slot_label\` 和同级兄弟节点信息 \`sibling_titles_context\` 明确区分提问对象（避免同级多个节点问得一模一样让人分不清），但**不要把答案核心词直接写在题干里**。
3. **不要堆砌空洞套话**：比如不要写“请深入剖析其本质属性与工具价值及大题破题”。

### 思维导图大纲（仅供参考上下级结构，不可拓展超纲）：
\`\`\`markdown
${outline}
\`\`\`

### 被遮盖节点清单（本批 ${batchNodes.length} 个）：
${JSON.stringify(targetNodesPayload, null, 2)}
`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 40000)

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errText = await response.text()
        console.warn('AI 出题接口响应异常:', errText)
        lastError = `AI 服务返回 HTTP ${response.status}`
        continue
      }

      const resJson = await response.json()
      const rawContent = resJson.choices?.[0]?.message?.content || ''
      const parsed = parseModelJsonResponse(rawContent)

      const aiList = Array.isArray(parsed)
        ? parsed
        : (parsed?.questions && Array.isArray(parsed.questions) ? parsed.questions : null)

      if (aiList && aiList.length > 0) {
        anyAiSuccess = true
        for (let i = 0; i < batchNodes.length; i++) {
          const qNode = batchNodes[i]
          const qNodeId = qNode.data.target_node_id || qNode.data.uid || qNode.data.id
          const originalAnswer = stripHtml(qNode.data.standard_answer || '')

          const aiMatch = aiList.find(item => item.target_node_id && (item.target_node_id === qNodeId || item.target_node_id === qNode.data.uid)) ||
            aiList[i]

          if (aiMatch && aiMatch.question) {
            qNode.data.question_title = stripHtml(aiMatch.question)
            if (aiMatch.understanding_hint) {
              qNode.data.understanding_hint = stripHtml(aiMatch.understanding_hint)
            }
            // 铁律：standard_answer 始终忠实保留导图原节点文本，不被 AI 篡改扩写
            if (!originalAnswer && aiMatch.standard_answer) {
              qNode.data.standard_answer = stripHtml(aiMatch.standard_answer)
            }
            if (aiMatch.aspect_subdivision) {
              qNode.data.aspect_subdivision = stripHtml(aiMatch.aspect_subdivision)
            }
            if (aiMatch.evaluation_criteria) {
              qNode.data.evaluation_criteria = stripHtml(aiMatch.evaluation_criteria)
            }
            if (aiMatch.dimension && ['what', 'which', 'why', 'for_what'].includes(aiMatch.dimension)) {
              qNode.data.dimension = aiMatch.dimension
              const dimMap = { what: '是什么', which: '有什么', why: '为什么', for_what: '为了什么' }
              qNode.data.dimension_name = dimMap[aiMatch.dimension] || qNode.data.dimension_name
            }
            if (mode === 'memory' && typeof aiMatch.has_difficult_chars === 'boolean') {
              const validChars = Array.isArray(aiMatch.difficult_chars)
                ? aiMatch.difficult_chars.filter(c => typeof c === 'string' && c.length === 1 && originalAnswer.includes(c))
                : []
              qNode.data.difficult_chars = validChars
              qNode.data.has_difficult_chars = validChars.length > 0
            }
            qNode.data.ai_generated = true
          }
        }
      }
    } catch (e) {
      console.warn('AI 生成导图题目发生异常，已保留本地原位遮盖直问模型:', e)
      lastError = e.message
    }
  }

  return {
    ...baseResult,
    aiGenerated: anyAiSuccess,
    ...(lastError && !anyAiSuccess ? { aiError: lastError } : {})
  }
}

/**
 * 针对当前单个被遮盖导图节点，由 AI 用更清晰直白的问法重新表述问题
 * 铁律：只考该节点原内容，绝不拓展导图外内容，绝不更改原标准答案
 */
export async function regenerateSingleQuestionWithAi(questionData, mapOutline = '', options = {}) {
  const cfg = getJudgeAiConfig()
  const apiKey = options.customApiKey || cfg.apiKey
  const baseUrl = options.customBaseUrl || cfg.baseUrl
  const model = options.customModel || cfg.modelName

  if (!apiKey) {
    throw new Error('未配置 AI API Key，请先在 API 配置中填入密钥')
  }

  const mode = options.mode || 'memory'
  const interrogationCfg = getInterrogationConfig()
  const customRules = mode === 'memory'
    ? interrogationCfg.memoryCustomRules
    : interrogationCfg.understandingCustomRules
  const extraInstructions = interrogationCfg.customExtraInstructions || ''

  const basePrompt = mode === 'memory'
    ? MEMORY_INTERROGATION_SYSTEM_PROMPT
    : UNDERSTANDING_INTERROGATION_SYSTEM_PROMPT

  const originalAnswer = stripHtml(questionData.standard_answer || '')
  const siblingCtx = Array.isArray(questionData.sibling_context) ? questionData.sibling_context : []

  const systemPrompt = `${basePrompt}

---

## 附加用户定制规则：
${customRules}
${extraInstructions ? `\n附加要求：${extraInstructions}` : ''}

## 单题清晰改写输出规范（纯 JSON）：
{
  "target_node_id": "${questionData.target_node_id || ''}",
  "target_node_text": "${stripHtml(questionData.target_node_text || '')}",
  "dimension": "${questionData.dimension || 'what'}",
  "dimension_name": "${questionData.dimension_name || '是什么'}",
  "aspect_subdivision": "简明的考查焦点",
  "question": "针对同一被遮盖节点原内容、换一种更清晰直白的提问表述（只考导图原内容，绝不拓展延伸，绝不剧透答案）",
  "understanding_hint": "简短不剧透的作答范围提示",
  "standard_answer": "原节点被遮盖的原始内容（原封不动保留原内容）",
  "has_difficult_chars": false,
  "difficult_chars": [],
  "evaluation_criteria": "对照导图原节点的核对要点"
}`

  const userPrompt = `请针对下面这一个被遮盖的思维导图节点，换一种**更清晰直白、一眼看明白考什么**的问法重新提问（严格只考节点原内容，绝不过度拓展延伸）：

- 导图路径：${stripHtml(questionData.aspect_domain || '核心网络')}
- 定位名称：${stripHtml(questionData.target_node_text || '')}
${questionData.slot_label ? `- 节点前缀标签：${stripHtml(questionData.slot_label)}
` : ''}${questionData.sibling_count > 1 ? `- 同级位置：第 ${questionData.sibling_index} 项（共 ${questionData.sibling_count} 项），同级兄弟节点：${JSON.stringify(siblingCtx)}
` : ''}- 被遮盖的原节点内容（即唯一标准答案）：${originalAnswer}
- 上一次的提问：${stripHtml(questionData.question || '')}
${mapOutline ? `
### 导图上下级参考：
\`\`\`markdown
${mapOutline}
\`\`\`
` : ''}`

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 35000)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    }),
    signal: controller.signal
  })
  clearTimeout(timeoutId)

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`AI 服务返回 HTTP ${response.status}: ${errText.slice(0, 200)}`)
  }

  const resJson = await response.json()
  const rawContent = resJson.choices?.[0]?.message?.content || ''
  const parsed = parseModelJsonResponse(rawContent)
  if (!parsed || !parsed.question) {
    throw new Error('AI 未能返回有效的题目结构，请重试')
  }

  const validDiffChars = (mode === 'memory' && Array.isArray(parsed.difficult_chars))
    ? parsed.difficult_chars.filter(c => typeof c === 'string' && c.length === 1 && originalAnswer.includes(c))
    : (questionData.difficult_chars || [])

  return {
    ...questionData,
    target_node_text: stripHtml(parsed.target_node_text || questionData.target_node_text),
    dimension: parsed.dimension || questionData.dimension,
    dimension_name: parsed.dimension_name || questionData.dimension_name,
    aspect_subdivision: stripHtml(parsed.aspect_subdivision || questionData.aspect_subdivision),
    question: stripHtml(parsed.question),
    understanding_hint: stripHtml(parsed.understanding_hint || ''),
    // 保真：若原节点有答案，始终保留原节点内容作为唯一标准答案
    standard_answer: originalAnswer || stripHtml(parsed.standard_answer || ''),
    evaluation_criteria: stripHtml(parsed.evaluation_criteria || questionData.evaluation_criteria),
    has_difficult_chars: mode === 'memory' ? (validDiffChars.length > 0) : false,
    difficult_chars: mode === 'memory' ? validDiffChars : [],
    ai_generated: true
  }
}
