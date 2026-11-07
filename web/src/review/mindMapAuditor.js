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
      } catch (err) {}
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
