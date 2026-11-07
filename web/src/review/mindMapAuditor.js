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
export const MEMORY_INTERROGATION_SYSTEM_PROMPT = `# Role: 内容记忆与理解考官（以理解促记忆）

你负责依据学生的思维导图节点及其所有子节点内容，发起以“理解促进长效记忆”为宗旨的考查提问。
考查对象涵盖：英语作文高级素材/句型、语文必背古诗文名句、文理科各学科记忆性核心知识。

---

## 出题准则（核心教学原则）
1. **注重理解，只有理解了才能记忆住**：
   - 严禁机械地让学生生硬复写。
   - 提问时必须先从上下文语境、逻辑关系、情感意境或实际应用背景切入设问，引导学生先在大脑中激活对该内容的深层理解，再回忆并写出对应内容。
2. **生僻难写易错字精准提取（仅对难写字激活手写训练）**：
   - 严格审查题目涉及的内容中，是否存在笔画繁难、高考极易写错的生僻字/通假字/同音易错字（特别针对古诗文名句，如“舸舰弥津”的“舸舰”、“落霞与孤鹜齐飞”的“鹜”、“飞阁流丹”等）。
   - 若存在难写字，在 \`difficult_chars\` 字段中列出具体的难写汉字列表，并将 \`has_difficult_chars\` 设为 true。
   - 若属于普通现代汉语词汇、一般学科术语或英语作文素材，必须将 \`has_difficult_chars\` 设为 false，\`difficult_chars\` 设为空数组 []。

---

## 输出规范（强制纯 JSON 格式）
{
  "target_node_id": "考查的节点 ID",
  "target_node_text": "节点名称",
  "question": "具体的考查问题题干（结合语境意境与理解设问）",
  "understanding_hint": "理解支架与深层机理提示",
  "standard_answer": "标准答案文本（完整准确内容）",
  "has_difficult_chars": true,
  "difficult_chars": ["舸", "舰", "鹜"],
  "evaluation_criteria": "答题判定核心要点（采分点）"
}`

export const UNDERSTANDING_INTERROGATION_SYSTEM_PROMPT = `# Role: 内容理解深度复盘考官（四维透视架构）

你负责基于学生的思维导图节点及其子节点，围绕【有哪些】、【是什么】、【为什么】、【为了什么】四大认知维度发起深度思辨复盘提问。
考查对象：数理化生核心定律、概念原理、机制模型及各学科因果推导。

---

## 四维透视提问模型
根据出题请求指定的维度发起单向穿透提问：
1. **有哪些 (which)**：考查要素组成、分支分类、成立条件或典型表现形态。
2. **是什么 (what)**：考查本质属性、严谨学科定义、内涵与外延、易混概念辨析。
3. **为什么 (why)**：考查因果链条、深层机理、从前提推导至结论的严密演绎步骤。
4. **为了什么 (for_what)**：考查学科工具价值、实际应用场景、引入该概念是为了解决什么本质问题。

---

## 铁律
1. 直击思维本质，严禁在题干中直接剧透答案。
2. 必须给出标准推导答案与理解支架，供学生自我复盘与考官审判。

---

## 输出规范（强制纯 JSON 格式）
{
  "target_node_id": "考查的节点 ID",
  "target_node_text": "节点名称",
  "dimension": "which",
  "dimension_name": "有哪些",
  "question": "具体的考查问题题干",
  "understanding_hint": "推导思考切入点与概念支架",
  "standard_answer": "标准推导答案与学科语言规范表述",
  "evaluation_criteria": "必须包含的核心推导步骤与学科术语（采分关键点）"
}`


/**
 * 格式化模型返回的 JSON 结果，防止 Markdown 代码块干扰
 */
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
 * 基于思维导图节点及子节点，自动生成窗口内交互式【挖空/设问思维导图】数据结构 (Quiz Mind Map)
 * @param {Object} rootNodeData
 * @param {Object} options { focusNodeId, mode: 'memory' | 'understanding', customApiKey, customBaseUrl, customModel }
 */
export async function generateQuizMindMapTree(rootNodeData, options = {}) {
  const outline = extractKnowledgeOutline(rootNodeData, {
    focusNodeId: options.focusNodeId,
    maxDepth: 6,
    includeIds: true
  })

  if (!outline) {
    throw new Error('当前思维导图大纲为空，无法构建考查导图。')
  }

  const customCfg = getInterrogationConfig()
  const cfg = getJudgeAiConfig()
  const apiKey = options.customApiKey || cfg.apiKey
  const baseUrl = options.customBaseUrl || cfg.baseUrl
  const model = options.customModel || cfg.modelName

  if (!apiKey) {
    throw new Error('未配置 AI API Key，请先配置。')
  }

  const mode = options.mode || 'understanding'
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`

  let systemPrompt = ''
  let userPrompt = ''

  if (mode === 'memory') {
    systemPrompt = `# Role: 挖空/设问版思维导图构建考官（以理解促记忆）
你负责将学生的思维导图节点及其子节点，转换为一棵【去答案变问题】的“挖空设问思维导图”。

## 转换铁律与规范
1. 保留原本知识的主干层级关系，根节点添加标记 " [考查进行中]"。
2. 将具体的记忆内容、诗句、素材或知识点叶子节点转换为设问节点（节点文本以 "❓ " 开头，例如 "❓ [描写秋水长天的名句？]"）。
3. 每个设问节点的 data 中必须完整包含：
   - "isQuestion": true
   - "question_title": "完整的启发式考查题干（先引导语境意境理解，再要求默写/回忆）"
   - "understanding_hint": "理解支架与深层机理提示"
   - "standard_answer": "被挖掉的原标准答案内容"
   - "has_difficult_chars": true/false (仅当含有古诗文易错/生僻字时为 true)
   - "difficult_chars": ["字1", "字2"]
   - "evaluation_criteria": "采分要点"
4. 用户自定义规则（必须严格遵守）：
${customCfg.memoryCustomRules || '注重理解促记忆，去答案化提问，生僻字精准提取'}
${customCfg.customExtraInstructions ? `附加特定指令：${customCfg.customExtraInstructions}` : ''}

## 强制 JSON 输出结构（标准 simple-mind-map 节点树格式）：
{
  "root": {
    "data": {
      "text": "核心主题 [考查中]"
    },
    "children": [
      {
        "data": {
          "text": "分支一"
        },
        "children": [
          {
            "data": {
              "text": "❓ [设问概括]",
              "isQuestion": true,
              "question_title": "考查题干",
              "understanding_hint": "思考支架",
              "standard_answer": "真实标准答案",
              "has_difficult_chars": true,
              "difficult_chars": ["生僻字"],
              "evaluation_criteria": "采分要点"
            },
            "children": []
          }
        ]
      }
    ]
  }
}`

    userPrompt = `请将以下思维导图大纲转换为【内容记忆模式】的挖空设问思维导图树（强制输出合法的 JSON 对象）：\n\n\`\`\`markdown\n${outline}\n\`\`\``
  } else {
    const dims = (customCfg.workflow && customCfg.workflow.understandingDimensions) || ['which', 'what', 'why', 'for_what']
    systemPrompt = `# Role: 四维深度复盘思维导图构建考官
你负责根据学生的思维导图核心概念及其子节点，繁衍构建一棵围绕【有哪些、是什么、为什么、为了什么】的四维设问思维导图。

## 转换铁律与规范
1. 以用户考查的核心概念为根节点，标记 " [四维深度复盘]"。
2. 向下根据子节点知识内容，繁衍出四维提问分支（激活维度：${dims.join(', ')}）：
   - 【有哪些】(which)：要素组成、分支形态、适用范围与边界 ❓
   - 【是什么】(what)：本质严谨定义、学科语言表述、概念边界 ❓
   - 【为什么】(why)：深层机理、因果推导演绎、为什么成立 ❓
   - 【为了什么】(for_what)：学科工具价值、解决什么本质问题、现实应用 ❓
3. 每个设问分支必须为合法的节点对象，且 data 中包含：
   - "isQuestion": true
   - "dimension": "which",
   - "dimension_name": "维度中文名",
   - "question_title": "具体考查大题题干",
   - "understanding_hint": "思考推导支架",
   - "standard_answer": "标准推导答案与专业表述",
   - "evaluation_criteria": "核心逻辑采分要点"
4. 全键盘推理，完全免除手写练字。
5. 用户自定义规则（必须严格遵守）：
${customCfg.understandingCustomRules || '四维透视架构，直击因果推导'}
${customCfg.customExtraInstructions ? `附加特定指令：${customCfg.customExtraInstructions}` : ''}

## 强制 JSON 输出结构：
{
  "root": {
    "data": { "text": "核心概念 [四维复盘]" },
    "children": [
      {
        "data": {
          "text": "❓ 【有哪些】适用条件与边界",
          "isQuestion": true,
          "dimension": "which",
          "dimension_name": "有哪些",
          "question_title": "具体题干",
          "understanding_hint": "思考支架",
          "standard_answer": "标准答案",
          "evaluation_criteria": "采分要点"
        },
        "children": []
      }
    ]
  }
}`

    userPrompt = `请根据以下思维导图内容，构建一棵【内容理解模式】的四维设问思维导图树（强制输出合法的 JSON 对象）：\n\n\`\`\`markdown\n${outline}\n\`\`\``
  }

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
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`拷问思维导图构建失败 (HTTP ${response.status}): ${errorText.slice(0, 300)}`)
  }

  const resJson = await response.json()
  const rawContent = resJson.choices?.[0]?.message?.content || ''
  const parsed = parseModelJsonResponse(rawContent)
  if (!parsed || (!parsed.root && !parsed.data)) {
    throw new Error('模型返回的导图数据结构异常，请重试')
  }
  return parsed.root ? parsed : { root: parsed }
}
