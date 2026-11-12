import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import {
  DEFAULT_INTERROGATION_CONFIG,
  getInterrogationConfig,
  saveInterrogationConfig,
  resetInterrogationConfig
} from '../web/src/review/interrogationConfig.js'
import {
  detectDifficultChars,
  extractNodeMaskInfo,
  buildQuizMindMapTree,
  generateQuizMindMapTree,
  regenerateSingleQuestionWithAi,
  stripHtml
} from '../web/src/review/mindMapAuditor.js'

describe('拷问系统规则与工作流配置中心 (interrogationConfig)', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  it('初始加载包含高考主力军与理解后勤部定位、原位遮盖直问与超纲防护铁律', () => {
    const config = getInterrogationConfig()
    expect(config.memoryCustomRules).toContain('高考直接主力军')
    expect(config.memoryCustomRules).toContain('有什么、是什么')
    expect(config.memoryCustomRules).toContain('只考思维导图的内容')
    expect(config.memoryCustomRules).toContain('所有内容必须为高考服务，不需要复习、考察过度超纲')
    expect(config.understandingCustomRules).toContain('高考理解后勤部')
    expect(config.understandingCustomRules).toContain('为什么、为了什么')
    expect(config.understandingCustomRules).toContain('只考思维导图的内容')
    expect(config.understandingCustomRules).toContain('所有内容必须为高考服务，不需要复习、考察过度超纲')
    expect(config.workflow.requireUnderstandingFirst).toBe(true)
    expect(config.workflow.tianzigeDifficultCharsOnly).toBe(true)
    expect(config.workflow.allowMentalAnswer).toBe(true)
    expect(config.workflow.autoFlipNodeOnPass).toBe(true)
  })

  it('支持保存用户自定义的考官规则与工作流', () => {
    const custom = {
      memoryCustomRules: '自定义记忆规则：高考文言文重点考查通假字',
      understandingCustomRules: '自定义理解规则：深入分析受力分析图与加速度推导',
      customExtraInstructions: '只考思维导图原内容，绝不拓展',
      workflow: {
        requireUnderstandingFirst: true,
        tianzigeDifficultCharsOnly: true,
        allowMentalAnswer: true,
        defaultAnswerType: 'mental',
        autoFlipNodeOnPass: true,
        understandingDimensions: ['why', 'for_what']
      }
    }

    const saved = saveInterrogationConfig(custom)
    expect(saved).toBe(true)

    const reloaded = getInterrogationConfig()
    expect(reloaded.memoryCustomRules).toBe('自定义记忆规则：高考文言文重点考查通假字')
    expect(reloaded.understandingCustomRules).toBe('自定义理解规则：深入分析受力分析图与加速度推导')
    expect(reloaded.customExtraInstructions).toBe('只考思维导图原内容，绝不拓展')
    expect(reloaded.workflow.understandingDimensions).toEqual(['why', 'for_what'])
  })

  it('支持一键恢复官方推荐默认规则与工作流', () => {
    saveInterrogationConfig({
      memoryCustomRules: '临时修改的规则',
      customExtraInstructions: '临时特定指令'
    })

    const reset = resetInterrogationConfig()
    expect(reset.memoryCustomRules).toContain('高考直接主力军')
    expect(reset.customExtraInstructions).toContain('只考思维导图的内容')

    const reloaded = getInterrogationConfig()
    expect(reloaded.memoryCustomRules).toContain('有什么、是什么')
  })
})

describe('思维导图原位遮盖变设问与清晰提问测试 (buildQuizMindMapTree & extractNodeMaskInfo)', () => {
  it('detectDifficultChars 准确检测并提取古诗文生僻字', () => {
    const text = '落霞与孤鹜齐飞，秋水共长天一色。舸舰弥津，青雀黄龙之舳。'
    const diffs = detectDifficultChars(text)
    expect(diffs).toContain('鹜')
    expect(diffs).toContain('舸')
    expect(diffs).toContain('舰')
    expect(diffs).toContain('舳')
    expect(diffs).not.toContain('落')
    expect(diffs).not.toContain('天')
  })

  it('stripHtml 彻底清除节点中的 <p>、<span> 等富文本 HTML 标签及实体编码', () => {
    expect(stripHtml('<p>理论</p>')).toBe('理论')
    expect(stripHtml('&lt;p&gt;理论&lt;/p&gt;')).toBe('理论')
    expect(stripHtml('<span>【<p>原理</p>】</span>')).toBe('【原理】')
    expect(stripHtml('&nbsp;&lt;p&gt;公式&lt;/p&gt;&amp;nbsp;')).toBe('公式')
  })

  it('extractNodeMaskInfo 准确识别并保留前缀标签（如 "公式：..."），仅遮盖核心答案', () => {
    const slotInfo = extractNodeMaskInfo('公式：F = ma')
    expect(slotInfo.hasSlotLabel).toBe(true)
    expect(slotInfo.slotLabel).toBe('公式')
    expect(slotInfo.maskedContent).toBe('F = ma')
    expect(slotInfo.fullContent).toBe('公式：F = ma')

    const plainInfo = extractNodeMaskInfo('落霞与孤鹜齐飞，秋水共长天一色')
    expect(plainInfo.hasSlotLabel).toBe(false)
    expect(plainInfo.slotLabel).toBe('')
    expect(plainInfo.maskedContent).toBe('落霞与孤鹜齐飞，秋水共长天一色')

    const urlInfo = extractNodeMaskInfo('https://example.com')
    expect(urlInfo.hasSlotLabel).toBe(false)
  })

  it('buildQuizMindMapTree 彻底剔除富文本 HTML 标签，保证题干与导图文本纯净', () => {
    const mockRichMap = {
      data: { text: '<p>理论</p>', richText: true },
      children: [
        {
          data: { text: '<p>原理</p>', richText: true },
          children: [
            {
              data: { text: '<p>公式：F = ma</p>', richText: true },
              children: []
            }
          ]
        }
      ]
    }

    const res = buildQuizMindMapTree(mockRichMap, { mode: 'memory' })
    const leaf = res.root.children[0].children[0]
    expect(leaf.data.target_node_text).toBe('原理 ➔ 公式')
    expect(leaf.data.aspect_domain).toBe('理论 ➔ 原理')
    expect(leaf.data.masked_label).toBe('公式：______')
    expect(leaf.data.question_title).toContain('公式')
    expect(leaf.data.question_title).not.toContain('F = ma') // 绝不剧透答案
    expect(leaf.data.question_title).not.toContain('<p>')
    expect(leaf.data.question_title).not.toContain('</p>')
    expect(leaf.data.text).toContain('❓ [公式：______]')
    expect(leaf.data.richText).toBeUndefined()
    expect(res.root.data.expand).toBe(true)
    expect(res.root.children[0].data.expand).toBe(true)
    expect(leaf.data.expand).toBe(true)
  })

  it('buildQuizMindMapTree 区分同级多个兄弟节点，让用户明确看出当前考的是哪一项', () => {
    const mockSiblingMap = {
      data: { text: '有氧呼吸' },
      children: [
        { data: { uid: 'n1', text: '场所：细胞质基质和线粒体' }, children: [] },
        { data: { uid: 'n2', text: '产物：二氧化碳和水' }, children: [] }
      ]
    }

    const res = buildQuizMindMapTree(mockSiblingMap, { mode: 'memory' })
    const c1 = res.root.children[0]
    const c2 = res.root.children[1]

    expect(c1.data.sibling_index).toBe(1)
    expect(c1.data.sibling_count).toBe(2)
    expect(c1.data.sibling_context).toEqual(['场所：细胞质基质和线粒体', '产物：二氧化碳和水'])
    expect(c1.data.text).toBe('❓ [场所：______] (1)')
    expect(c2.data.text).toBe('❓ [产物：______] (2)')
    expect(c1.data.question_title).toContain('场所')
    expect(c2.data.question_title).toContain('产物')
    expect(c1.data.standard_answer).toBe('场所：细胞质基质和线粒体')
  })

  it('buildQuizMindMapTree 模式一针对名句原位遮盖并提取生僻字', () => {
    const mockMap = {
      data: { text: '高中语文必修上册' },
      children: [
        {
          data: { text: '滕王阁序' },
          children: [
            {
              data: { text: '落霞与孤鹜齐飞，秋水共长天一色。舸舰弥津。' },
              children: []
            }
          ]
        }
      ]
    }

    const res = buildQuizMindMapTree(mockMap, { mode: 'memory' })
    expect(res.root).toBeDefined()
    expect(res.root.data.text).toContain('[原位遮盖记忆]')

    const leafNode = res.root.children[0].children[0]
    expect(leafNode.data.isQuestion).toBe(true)
    expect(leafNode.data.status).toBe('pending')
    expect(leafNode.data.dimension_name).toBe('是什么')
    expect(leafNode.data.aspect_subdivision).toContain('生僻字检查')
    expect(leafNode.data.has_difficult_chars).toBe(true)
    expect(leafNode.data.difficult_chars).toContain('鹜')
    expect(leafNode.data.difficult_chars).toContain('舸')
    expect(leafNode.data.difficult_chars).toContain('舰')
    expect(leafNode.data.standard_answer).toBe('落霞与孤鹜齐飞，秋水共长天一色。舸舰弥津。')
    expect(leafNode.data.text).toContain('❓ [已遮盖 · 21字]')
    expect(leafNode.data.fillColor).toBe('#fefce8')
    expect(leafNode.data.borderColor).toBe('#eab308')
  })

  it('buildQuizMindMapTree 模式二针对原因/作用原位遮盖直问，绝不乱拓展', () => {
    const mockMap = {
      data: { text: '高中生物' },
      children: [
        {
          data: { text: '酶的特性' },
          children: [
            {
              data: { text: '作用：降低化学反应的活化能' },
              children: []
            }
          ]
        }
      ]
    }

    const res = buildQuizMindMapTree(mockMap, { mode: 'understanding' })
    expect(res.root).toBeDefined()
    expect(res.root.data.text).toContain('[原位遮盖理解]')

    const leafNode = res.root.children[0].children[0]
    expect(leafNode.data.isQuestion).toBe(true)
    expect(leafNode.data.status).toBe('pending')
    expect(leafNode.data.dimension_name).toBe('为了什么')
    expect(leafNode.data.question_title).toContain('作用、目的或意义')
    expect(leafNode.data.question_title).not.toContain('降低化学反应的活化能')
    expect(leafNode.data.standard_answer).toBe('作用：降低化学反应的活化能')
    expect(leafNode.data.has_difficult_chars).toBe(false)
    expect(leafNode.data.text).toBe('❓ [作用：______] (1)')
  })

  it('generateQuizMindMapTree 未配 Key 时秒开返回本地原位遮盖模型', async () => {
    const mockMap = {
      data: { text: '高中化学有机物' },
      children: [
        {
          data: { text: '反应条件：铜作催化剂并加热' },
          children: []
        }
      ]
    }

    const tree = await generateQuizMindMapTree(mockMap, { mode: 'understanding' })
    expect(tree).toBeDefined()
    expect(tree.root).toBeDefined()
    expect(tree.aiGenerated).toBe(false)
    expect(tree.root.children[0].data.standard_answer).toBe('反应条件：铜作催化剂并加热')
  })
})

describe('AI 原位遮盖直问与单题清晰重表述深度测试', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('generateQuizMindMapTree 通过 AI 基于被遮盖节点生成清晰直白问题，且 100% 忠实保留导图原答案', async () => {
    const mockMap = {
      data: { uid: 'root_1', text: '高中物理·电磁感应' },
      children: [
        {
          data: { uid: 'node_faraday', text: '法拉第电磁感应定律' },
          children: [
            {
              data: { uid: 'leaf_formula', text: '表达式：E = n * (ΔΦ/Δt)' },
              children: []
            }
          ]
        }
      ]
    }

    let capturedUserPrompt = ''
    globalThis.fetch = async (url, init) => {
      const body = JSON.parse(init.body)
      capturedUserPrompt = body.messages[1].content
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  questions: [
                    {
                      target_node_id: 'leaf_formula',
                      target_node_text: '法拉第电磁感应定律 ➔ 表达式',
                      dimension: 'what',
                      dimension_name: '是什么',
                      aspect_subdivision: '定律计算表达式',
                      question: '在导图【法拉第电磁感应定律】分支下，感应电动势大小的计算表达式是什么？',
                      understanding_hint: '写出由匝数与磁通量变化率构成的公式。',
                      // 故意测试即使 AI 试图改写 standard_answer，前端也应锁死保留原节点内容
                      standard_answer: 'AI篡改后的额外长篇大论解释',
                      has_difficult_chars: true,
                      difficult_chars: ['磁', '幻'], // '幻' 不在原节点文本中，应被过滤
                      evaluation_criteria: '写出 E = n * (ΔΦ/Δt)'
                    }
                  ]
                })
              }
            }
          ]
        })
      }
    }

    const res = await generateQuizMindMapTree(mockMap, {
      mode: 'memory',
      customApiKey: 'sk-mock-key-for-test',
      customBaseUrl: 'https://api.mock.test/v1'
    })

    expect(capturedUserPrompt).toContain('只考思维导图的内容')
    expect(capturedUserPrompt).toContain('表达式：E = n * (ΔΦ/Δt)')
    expect(res.aiGenerated).toBe(true)

    const leaf = res.root.children[0].children[0]
    expect(leaf.data.ai_generated).toBe(true)
    expect(leaf.data.question_title).toBe('在导图【法拉第电磁感应定律】分支下，感应电动势大小的计算表达式是什么？')
    // 核心保真验证：standard_answer 必须依然是导图节点原始内容！
    expect(leaf.data.standard_answer).toBe('表达式：E = n * (ΔΦ/Δt)')
    // 核心过滤验证：不在原节点答案里的乱编字 '幻' 应被过滤掉
    expect(leaf.data.difficult_chars).not.toContain('幻')
    expect(leaf.data.has_difficult_chars).toBe(false)
  })

  it('regenerateSingleQuestionWithAi 支持换用更清晰的问法，且绝不篡改原节点标准答案', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                target_node_id: 'test_node_1',
                target_node_text: '细胞核 ➔ 核膜',
                dimension: 'what',
                dimension_name: '是什么',
                aspect_subdivision: '核膜功能与结构特征',
                question: '在【细胞核】分支中，分隔细胞核内物质与细胞质的双层膜结构叫什么？',
                understanding_hint: '2个字，位于同级第1项。',
                standard_answer: '额外拓展的乱七八糟内容',
                evaluation_criteria: '回答出核膜。'
              })
            }
          }
        ]
      })
    })

    const updated = await regenerateSingleQuestionWithAi(
      {
        target_node_id: 'test_node_1',
        target_node_text: '细胞核（第 1/2 项）',
        aspect_domain: '生物 ➔ 细胞核',
        sibling_index: 1,
        sibling_count: 2,
        sibling_context: ['核膜：双层膜，把核内物质与细胞质分开', '核仁'],
        standard_answer: '核膜：双层膜，把核内物质与细胞质分开'
      },
      '- 生物\n  - 细胞核\n    - 核膜',
      {
        mode: 'memory',
        customApiKey: 'sk-mock-test',
        customBaseUrl: 'https://api.mock.test/v1'
      }
    )

    expect(updated.ai_generated).toBe(true)
    expect(updated.question).toBe('在【细胞核】分支中，分隔细胞核内物质与细胞质的双层膜结构叫什么？')
    // 必须保留原始节点内容
    expect(updated.standard_answer).toBe('核膜：双层膜，把核内物质与细胞质分开')
    expect(updated.question).not.toContain('<p>')
  })

  it('generateQuizMindMapTree 在网络失败时安全降级为本地原位遮盖模型，绝不抛错阻断用户', async () => {
    globalThis.fetch = async () => {
      throw new Error('Network Connection Refused')
    }

    const mockMap = {
      data: { uid: 'root_net', text: '网络异常测试导图' },
      children: [
        {
          data: { uid: 'child_1', text: '考点A' },
          children: []
        }
      ]
    }

    const res = await generateQuizMindMapTree(mockMap, {
      mode: 'memory',
      customApiKey: 'sk-test',
      customBaseUrl: 'https://api.offline.test/v1'
    })

    expect(res).toBeDefined()
    expect(res.root).toBeDefined()
    expect(res.aiGenerated).toBe(false)
    expect(res.aiError).toContain('Network Connection Refused')
    expect(res.root.children[0].data.standard_answer).toBe('考点A')
  })
})
