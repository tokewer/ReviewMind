// ReviewMind 高中语文理解性默写·高精度审判考官服务模块
import { RATING, rateReview } from './index'

export const GAOKAO_JUDGE_SYSTEM_PROMPT = `# Role: ReviewMind 高中语文理解性默写·高精度审判考官

你负责接入 ReviewMind 记忆卡片复习流，对用户在数位板上手写的“高考语文必背篇目理解性默写”作答进行严苛批改、错误溯源与复习算法打分。

---

## 判定准则与流水线

### 1. 严格书写与字符审判（高考零容忍标准）
- **字面精确比对**：错一字、漏一字、添一字、颠倒一字均不得分。将识别出的文字与标准答案逐字对齐。
- **异体字与通假字**：仅认可国家统编教材统一定义的通假字（如《兰亭集序》“趣舍万殊”同“趋”）；其余自造别字、非通用异体字一律按错字判定。
- **涂改处理准则**：若画面中存在被清晰画双横线划去、涂黑丢弃的废字，以其最终修改的书写为准；若涂改重叠导致无法辨认，按错字判定。
- **标点符号容错界限**：诗文主体字词必须绝对精确。单纯标点符号漏写、句号误写为逗号，不判定为字词错误，但在 critique 中予以高考规范提醒。

### 2. 错误归因与认知诊断
针对非满分作答，必须精准定位到具体失分类型：
- \`WRONG_CHARACTER\`（错别字）：背出了句子，但特定字词写错笔画、偏旁或同音混淆（如将“沧海”写成“苍海”、“舞幽壑”写成“幽鹤”）。
- \`OMISSION_ADDITION\`（漏字/添字/语序颠倒）：背诵不熟练，虚词脱落或语序混乱。
- \`CONTEXT_MISMATCH\`（情境理解错误/答非所问）：默写了同一篇目中的其他句子，未抓住题干中的情境定位词。
- \`BLANK_OR_UNRECOGNIZED\`（空白/完全未作答/字迹无法辨认）。
- 若完全正确，类型为 \`NONE\`。

### 3. ReviewMind 记忆评级映射（对接间隔复习调度）
| 评分等级 (grade) | 状态定义 | 对应算法动作 (ReviewMind 调度) |
| :--- | :--- | :--- |
| \`3\` (Pass) | **完全正确**：一字不差，情境理解精准 | MASTERED / 推进至下一复习阶段（增加间隔） |
| \`2\` (Hard) | **勉强达标**：全句文字完全正确，但存在涂改重写痕迹或字迹微草 | REMEMBER / 缩短下次复习间隔 |
| \`1\` (Again_Mistake) | **笔误/错别字**：情境理解正确，仅错 1~2 个易错生僻字 | FUZZY / 重置间隔并加入高频错字生词本 |
| \`0\` (Again_Failed) | **完全失分**：答非所问、严重错漏、白卷或放弃 | FORGOT / 当天重置回第一阶段立即重练 |

---

## 输出规范（强制纯 JSON 格式）

你必须仅输出合法可解析的 JSON 对象，严禁包裹任何额外解释性闲聊、Markdown 标题或非 JSON 字符：

{
  "extracted_text": "实际手写识别文字",
  "is_fully_correct": false,
  "grade": 1,
  "diff_analysis": [
    { "standard_char": "标", "actual_char": "标", "is_correct": true }
  ],
  "error_type": "WRONG_CHARACTER",
  "error_details": {
    "wrong_chars": [
      {
        "expected": "羁",
        "actual": "苍",
        "reason": "同音/形似混淆，‘羁’为四字头加‘马’加‘革’，意为受束缚的马笼头；误写为‘苍’导致整句意境全失。"
      }
    ],
    "context_hint_analysis": "分析题干关键词与诗文情境对应关系。"
  },
  "interrogation_critique": "以冷峻、一针见血的高考阅卷人语气指出核心致命点，并给出该字词的笔画记忆锚点。"
}`

const CONFIG_STORAGE_KEY = 'reviewmind_ai_config'

/**
 * 获取考官 AI 接口配置
 */
export function getJudgeAiConfig() {
  let local = {}
  try {
    local = JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) || '{}')
  } catch (e) {
    local = {}
  }

  // 兼容老配置或提供合理默认值
  return {
    apiKey: local.apiKey || '',
    baseUrl: (local.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    modelName: local.modelName || 'gpt-4o-mini',
    temperature: typeof local.temperature === 'number' ? local.temperature : 0.0
  }
}

/**
 * 保存考官 AI 接口配置
 */
export function saveJudgeAiConfig(config) {
  const current = getJudgeAiConfig()
  const merged = {
    ...current,
    ...config,
    baseUrl: (config.baseUrl || current.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')
  }
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(merged))
  return merged
}

/**
 * 从 Canvas 提取并裁剪墨迹，输出高清晰度、无死角白底的 Base64 图像
 * @param {HTMLCanvasElement} canvas - 数位板绑定的主 Canvas
 * @returns {string|null} 裁剪后的 Base64 DataURL (image/jpeg)；若为空画布则返回 null
 */
export function exportOptimizedInk(canvas) {
  if (!canvas) return null
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const width = canvas.width
  const height = canvas.height
  if (width === 0 || height === 0) return null

  let imgData = null
  try {
    imgData = ctx.getImageData(0, 0, width, height)
  } catch (e) {
    // 跨域或安全受限时降级为直接导出
    return canvas.toDataURL('image/jpeg', 0.95)
  }

  const data = imgData.data

  // 1. 寻找有效墨迹的最小包围盒 (Bounding Box)
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  let hasInk = false

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const alpha = data[idx + 3]
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]

      // 只要不是纯透明且不是纯白底色（容差 RGB > 245），即视为笔画墨迹
      if (alpha > 30 && !(r > 245 && g > 245 && b > 245)) {
        hasInk = true
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  // 若为空画布，返回 null 触发前端提示
  if (!hasInk) return null

  // 增加 24px 安全留白 (Padding)
  const pad = 24
  minX = Math.max(0, minX - pad)
  minY = Math.max(0, minY - pad)
  maxX = Math.min(width, maxX + pad)
  maxY = Math.min(height, maxY + pad)

  const cropW = Math.max(1, maxX - minX)
  const cropH = Math.max(1, maxY - minY)

  // 2. 绘制到离屏 Canvas 并注入纯白底色（防止透明背景在模型中转为黑底）
  const offscreen = document.createElement('canvas')
  offscreen.width = cropW
  offscreen.height = cropH
  const offCtx = offscreen.getContext('2d')

  // 纯白背景
  offCtx.fillStyle = '#FFFFFF'
  offCtx.fillRect(0, 0, cropW, cropH)

  // 绘制裁剪后的墨迹
  offCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH)

  return offscreen.toDataURL('image/jpeg', 0.95)
}

/**
 * 发起考官审判请求
 * @param {Object} options
 * @param {string} options.imageBase64 - 手写墨迹图 base64
 * @param {string} options.prompt - 题干情境描述
 * @param {string} options.source - 出处篇目/作者
 * @param {string} options.standardAnswer - 标准答案文本
 * @param {Object} [options.config] - 自定义接口配置
 */
export async function requestHandwritingJudge({
  imageBase64,
  prompt = '',
  source = '',
  standardAnswer = '',
  config = null
}) {
  const activeConfig = config ? { ...getJudgeAiConfig(), ...config } : getJudgeAiConfig()

  if (!activeConfig.apiKey) {
    throw new Error('未配置 AI API Key，请点击“接口设置”填入有效 Key 后再试！')
  }

  if (!imageBase64) {
    throw new Error('未检测到任何手写墨迹，请先在数位板上书写作答！')
  }

  const promptContent = [
    {
      type: 'text',
      text: `【题干情境】：${prompt || '高考必背名句默写'}\n【出处篇目】：${source || '高中语文必背篇目'}\n【标准答案】：${standardAnswer || '（请依据题干情境严格审判）'}`
    },
    {
      type: 'image_url',
      image_url: {
        url: imageBase64,
        detail: 'high' // 必须为 high，保障复杂汉字笔画清晰可辨
      }
    }
  ]

  const endpoint = `${activeConfig.baseUrl}/chat/completions`

  const payload = {
    model: activeConfig.modelName || 'gpt-4o-mini',
    temperature: 0.0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: GAOKAO_JUDGE_SYSTEM_PROMPT },
      { role: 'user', content: promptContent }
    ]
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 45000)

  let res = null
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeConfig.apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      throw new Error('考官审判请求超时（45秒未响应），请检查网络连接或更换模型节点！')
    }
    throw new Error(`网络请求失败: ${err.message}`)
  }
  clearTimeout(timeoutId)

  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    throw new Error(`考官接口响应异常 [${res.status}]: ${errorText.slice(0, 300)}`)
  }

  const json = await res.json()
  const messageContent = json.choices && json.choices[0] && json.choices[0].message
    ? json.choices[0].message.content
    : null

  if (!messageContent) {
    throw new Error('考官未返回有效的审判内容，请重试！')
  }

  // 容错解析 JSON（剥离可能出现的 ```json 前后包裹）
  let cleanJsonText = messageContent.trim()
  if (cleanJsonText.startsWith('```')) {
    cleanJsonText = cleanJsonText.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim()
  }

  let evaluation = null
  try {
    evaluation = JSON.parse(cleanJsonText)
  } catch (parseErr) {
    throw new Error(`考官审判数据格式解析失败: ${parseErr.message}\n原始内容: ${cleanJsonText.slice(0, 150)}`)
  }

  // 格式归一化与防御
  const normalized = normalizeJudgeResult(evaluation, standardAnswer)
  return normalized
}

/**
 * 校验并补齐考官审判结果结构
 */
export function normalizeJudgeResult(result = {}, standardAnswer = '') {
  const extracted_text = typeof result.extracted_text === 'string' ? result.extracted_text : ''
  const is_fully_correct = Boolean(result.is_fully_correct)
  let grade = typeof result.grade === 'number' ? Math.max(0, Math.min(3, Math.round(result.grade))) : (is_fully_correct ? 3 : 0)

  let diff_analysis = Array.isArray(result.diff_analysis) ? result.diff_analysis : []
  // 若模型遗漏 diff_analysis，自动逐字补齐
  if (diff_analysis.length === 0 && standardAnswer) {
    const stdChars = standardAnswer.split('')
    const actChars = extracted_text.split('')
    diff_analysis = stdChars.map((ch, idx) => ({
      standard_char: ch,
      actual_char: actChars[idx] || '',
      is_correct: ch === actChars[idx]
    }))
  }

  const error_type = result.error_type || (is_fully_correct ? 'NONE' : 'WRONG_CHARACTER')
  const error_details = result.error_details || {
    wrong_chars: [],
    context_hint_analysis: ''
  }

  const interrogation_critique = result.interrogation_critique || (
    is_fully_correct
      ? '书写规整，字字珠玑。完全契合高考标准，继续保持！'
      : '发现书写偏差，高考默写错一字全题 0 分，请仔细对照红色错字重新书写！'
  )

  return {
    extracted_text,
    is_fully_correct,
    grade,
    diff_analysis,
    error_type,
    error_details: {
      wrong_chars: Array.isArray(error_details.wrong_chars) ? error_details.wrong_chars : [],
      context_hint_analysis: error_details.context_hint_analysis || ''
    },
    interrogation_critique
  }
}

/**
 * 映射考官评级到 ReviewMind 调度系统常量
 * grade 3 (Pass) -> MASTERED (熟练)
 * grade 2 (Hard) -> REMEMBER (记得)
 * grade 1 (Again_Mistake) -> FUZZY (模糊)
 * grade 0 (Again_Failed) -> FORGOT (忘记)
 */
export function mapJudgeGradeToRating(grade) {
  switch (grade) {
    case 3:
      return RATING.MASTERED
    case 2:
      return RATING.REMEMBER
    case 1:
      return RATING.FUZZY
    case 0:
    default:
      return RATING.FORGOT
  }
}

/**
 * 执行评价并自动记录考官错字与审判日志
 */
export function applyJudgeRating(uid, judgeResult) {
  if (!uid || !judgeResult) return null
  const rating = mapJudgeGradeToRating(judgeResult.grade)
  const updatedNode = rateReview(uid, rating)

  // 若存在错别字，沉淀到节点的 weakChars 集合
  if (updatedNode && judgeResult.error_details && Array.isArray(judgeResult.error_details.wrong_chars)) {
    updatedNode.weakChars = updatedNode.weakChars || []
    judgeResult.error_details.wrong_chars.forEach(item => {
      if (item && item.expected && !updatedNode.weakChars.includes(item.expected)) {
        updatedNode.weakChars.push(item.expected)
      }
    })
    updatedNode.lastJudgeResult = {
      date: new Date().toISOString(),
      grade: judgeResult.grade,
      error_type: judgeResult.error_type,
      critique: judgeResult.interrogation_critique,
      extracted_text: judgeResult.extracted_text
    }
  }

  return { rating, node: updatedNode }
}
