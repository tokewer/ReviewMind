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
export const MEMORY_INTERROGATION_SYSTEM_PROMPT = `# Role: 高考直接主力军考官 · 模式一【有什么、是什么】（以理解促记忆）

你负责依据学生的思维导图节点及其所有子节点内容，发起以【有什么】（要素/分类/清单/篇目）与【是什么】（定义/概念/名篇名句/定理公式）为核心的高考知识点考查。
考查对象涵盖：高考卷面直接考查、直接拿分的高考核心考点，包括必背古诗文名句、英语作文高级素材/句型、文理科各学科记忆性核心概念与知识清单。

---

## 核心总原则（最高指导铁律）
**所有内容必须为高考服务，不需要复习、考察过度超纲（对高考没有帮助的内容）！**
出题严禁脱离高考大纲与评价体系，绝不考偏门冷僻无益的细枝末节，严禁大学专业课式过度超纲。

---

## 出题准则（核心教学原则）
1. **模式一核心使命（高考直接主力军：有什么、是什么）**：
   - 【有什么】：盘点分类、核心要素清单、考点形态、代表篇目、典型表现。
   - 【是什么】：考查精确定义、概念内涵、原文字句、定理公式表述。
2. **注重理解，只有理解了才能记忆住**：
   - 严禁机械地让学生生硬复写。
   - 提问时必须先从高考常见语境、逻辑关系、情感意境或应用背景切入设问，引导学生先在大脑中激活对该内容的深层理解，再回忆并准确作答。
3. **生僻难写易错字精准提取（仅对难写字激活手写训练）**：
   - 严格审查题目涉及的内容中，是否存在笔画繁难、高考极易写错的生僻字/通假字/同音易错字（特别针对古诗文名句，如“舸舰弥津”的“舸舰”、“落霞与孤鹜齐飞”的“鹜”、“飞阁流丹”等）。
   - 若存在难写字，在 \`difficult_chars\` 字段中列出具体的难写汉字列表，并将 \`has_difficult_chars\` 设为 true。
   - 若属于普通现代汉语词汇、一般学科术语或英语作文素材，必须将 \`has_difficult_chars\` 设为 false，\`difficult_chars\` 设为空数组 []。

---

## 输出规范（强制纯 JSON 格式）
{
  "target_node_id": "考查的节点 ID",
  "target_node_text": "节点名称",
  "dimension": "what" | "which",
  "dimension_name": "是什么" | "有什么",
  "question": "具体的考查问题题干（结合高考语境与理解设问）",
  "understanding_hint": "理解支架与深层机理提示",
  "standard_answer": "标准答案文本（完整准确内容）",
  "has_difficult_chars": true,
  "difficult_chars": ["舸", "舰", "鹜"],
  "evaluation_criteria": "答题判定核心要点（高考采分点）"
}`

export const UNDERSTANDING_INTERROGATION_SYSTEM_PROMPT = `# Role: 高考理解后勤部考官 · 模式二【为什么、为了什么】（深度机理复盘）

你负责基于学生的思维导图节点及其子节点，围绕【为什么】（深层机理/因果推导/成立依据）与【为了什么】（本质意图/学科工具价值/实际应用）两大认知维度发起深度思辨复盘提问。
考查对象：数理化生核心定律、深层原理机制模型及因果推导，作为高考大题综合分析、迁移应用的强力“理解后勤部”！

---

## 核心总原则（最高指导铁律）
**所有内容必须为高考服务，不需要复习、考察过度超纲（对高考没有帮助的内容）！**
提问必须服务于高考高难度大题的思维逻辑链条，深挖考纲之内的本质原理，坚决剔除大学专业课式无益超纲与偏门怪题。

---

## 深度理解提问模型（高考理解后勤部）
1. **为什么 (why)**：考查因果链条、深层机理、从前提推导至结论的严密演绎步骤，为什么该结论必然成立。
2. **为了什么 (for_what)**：考查学科工具价值、引入该模型/概念是为了解决什么本质学科问题，如何指导高考大题破题解题。

---

## 铁律
1. 直击思维本质与机理，严禁在题干中直接剧透答案。
2. 纯思维推导与键盘/默答，完全免除手写练字。
3. 必须给出标准推导答案与理解支架，供学生自我复盘与考官审判。

---

## 输出规范（强制纯 JSON 格式）
{
  "target_node_id": "考查的节点 ID",
  "target_node_text": "节点名称",
  "dimension": "why" | "for_what",
  "dimension_name": "为什么" | "为了什么",
  "question": "具体的考查问题题干（高考深度理解设问）",
  "understanding_hint": "推导思考切入点与概念支架",
  "standard_answer": "标准推导答案与专业规范表述",
  "evaluation_criteria": "必须包含的核心推导步骤与学科术语（高考采分关键点）"
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

  const traverse = (node, path = []) => {
    if (!node || !node.data) return
    const rawText = (node.data.text || '').trim()
    const currentPath = [...path, rawText]
    const isLeaf = !node.children || node.children.length === 0

    if (isLeaf && rawText.length > 0 && !rawText.startsWith('❓')) {
      const qIndex = quizIndex++
      const parentName = path.length > 0 ? path[path.length - 1] : '核心考点'
      const breadcrumb = path.join(' ➔ ') || '主干知识网络'

      let dimension = 'what'
      let dimension_name = '是什么'
      let aspect_subdivision = ''
      let question_title = ''
      let understanding_hint = ''
      let hasDifficult = false
      let diffChars = []

      if (mode === 'memory') {
        diffChars = detectDifficultChars(rawText)
        hasDifficult = diffChars.length > 0

        if (hasDifficult || /[\u4e00-\u9fa5]{8,}/.test(rawText) || /[，。！？；、]/.test(rawText)) {
          dimension = 'what'
          dimension_name = '是什么'
          aspect_subdivision = '高考必背名篇名句默写 · 意境理解与生僻字精准考查'
          question_title = `【名句默写】请结合语境与意境，完整默写出【${parentName}】对应的名句，并注意生僻字笔画规范。`
          understanding_hint = '结合上下文语境与意境氛围回忆，重点关注笔画繁难生僻字与同音形近字。'
        } else if (rawText.includes('、') || rawText.includes('/') || rawText.includes('，') || rawText.length <= 6) {
          dimension = 'which'
          dimension_name = '有什么'
          aspect_subdivision = '高考核心要素清单 · 分类形态与组成考查'
          question_title = `【要素清单】请完整盘点【${parentName}】包含哪些核心分支要素与分类形态？`
          understanding_hint = '宏观梳理知识框架，条理化盘点所有关键要素与分类分支。'
        } else {
          dimension = 'what'
          dimension_name = '是什么'
          aspect_subdivision = '高考核心概念定理 · 本质定义与学科表述考查'
          question_title = `【概念定义】请阐述【${parentName}】的高考学科严谨定义、内涵属性与关键特征。`
          understanding_hint = '聚焦学科规范术语，准确还原核心定义与成立内涵。'
        }
      } else {
        const isWhy = qIndex % 2 === 0 || /原因|机理|推导|定律|原理|规律|条件/.test(parentName + rawText)
        if (isWhy) {
          dimension = 'why'
          dimension_name = '为什么'
          aspect_subdivision = '深层因果机制链条 · 成立机理与推导依据深度复盘'
          question_title = `【机理推导】请深入剖析【${parentName}】：为什么该结论必然成立？其深层因果推导依据是什么？`
          understanding_hint = '严密梳理因果链条，从底层定理逐步演绎，不放过任何跳步推导。'
        } else {
          dimension = 'for_what'
          dimension_name = '为了什么'
          aspect_subdivision = '学科工具价值与本质意图 · 高考综合大题迁移破题'
          question_title = `【工具意图】请剖析引入【${parentName}】的核心目的与工具价值：它是为了解决什么本质问题？如何指导大题破题？`
          understanding_hint = '从高考综合大题的破题工具视角，分析该知识点在解题中的核心定位。'
        }
      }

      node.data.isQuestion = true
      node.data.quizIndex = qIndex
      node.data.status = 'pending'
      node.data.dimension = dimension
      node.data.dimension_name = dimension_name
      node.data.aspect_domain = breadcrumb
      node.data.aspect_subdivision = aspect_subdivision
      node.data.target_node_text = parentName
      node.data.question_title = question_title
      node.data.understanding_hint = understanding_hint
      node.data.standard_answer = rawText
      node.data.has_difficult_chars = hasDifficult
      node.data.difficult_chars = diffChars
      node.data.evaluation_criteria = mode === 'memory'
        ? '必须包含高考核心专业术语/名句原字，生僻字书写完全正确。'
        : '必须包含严密因果推导链条与高考解题学科规范表述。'

      // 视觉进度初始状态：黄色待考查
      node.data.text = `❓ 【${dimension_name}】${parentName} (${qIndex + 1})`
      node.data.fillColor = '#fefce8'
      node.data.borderColor = '#eab308'
      node.data.borderWidth = 2
      node.data.color = '#854d0e'
    } else {
      if (node === targetRoot) {
        node.data.text = `${rawText} [${mode === 'memory' ? '主力军考查' : '后勤部复盘'}]`
      }
    }

    for (const child of node.children || []) {
      traverse(child, currentPath)
    }
  }

  traverse(targetRoot, [])

  if (quizIndex === 0) {
    targetRoot.data.isQuestion = true
    targetRoot.data.quizIndex = 0
    targetRoot.data.status = 'pending'
    targetRoot.data.dimension = mode === 'memory' ? 'what' : 'why'
    targetRoot.data.dimension_name = mode === 'memory' ? '是什么' : '为什么'
    targetRoot.data.aspect_domain = '核心知识网络'
    targetRoot.data.aspect_subdivision = mode === 'memory' ? '核心知识结构盘点' : '核心原理机制复盘'
    targetRoot.data.target_node_text = targetRoot.data.text
    targetRoot.data.question_title = `请对【${targetRoot.data.text}】的核心考点与知识体系发起系统阐述。`
    targetRoot.data.understanding_hint = '宏观梳理结构脉络与核心逻辑。'
    targetRoot.data.standard_answer = targetRoot.data.text
    targetRoot.data.text = `❓ 【${targetRoot.data.dimension_name}】${targetRoot.data.text}`
    targetRoot.data.fillColor = '#fefce8'
    targetRoot.data.borderColor = '#eab308'
    targetRoot.data.borderWidth = 2
    targetRoot.data.color = '#854d0e'
  }

  return { root: targetRoot }
}

/**
 * 基于思维导图节点及子节点，自动生成窗口内交互式【挖空/设问思维导图】数据结构 (Quiz Mind Map)
 * 采用本地确定性构建，确保 100% 零报错秒开呈现，完美支撑思维导图进度与细分考查
 */
export async function generateQuizMindMapTree(rootNodeData, options = {}) {
  return buildQuizMindMapTree(rootNodeData, options)
}
