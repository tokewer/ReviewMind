import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import {
  DEFAULT_INTERROGATION_CONFIG,
  getInterrogationConfig,
  saveInterrogationConfig,
  resetInterrogationConfig
} from '../web/src/review/interrogationConfig.js'
import {
  detectDifficultChars,
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

  it('初始加载包含高考主力军与理解后勤部定位及超纲防护铁律', () => {
    const config = getInterrogationConfig()
    expect(config.memoryCustomRules).toContain('高考直接主力军')
    expect(config.memoryCustomRules).toContain('有什么、是什么')
    expect(config.memoryCustomRules).toContain('所有内容必须为高考服务，不需要复习、考察过度超纲')
    expect(config.understandingCustomRules).toContain('高考理解后勤部')
    expect(config.understandingCustomRules).toContain('为什么、为了什么')
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
      customExtraInstructions: '必须以苏格拉底步步追问风格设问',
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
    expect(reloaded.customExtraInstructions).toBe('必须以苏格拉底步步追问风格设问')
    expect(reloaded.workflow.understandingDimensions).toEqual(['why', 'for_what'])
  })

  it('支持一键恢复官方推荐默认规则与工作流', () => {
    saveInterrogationConfig({
      memoryCustomRules: '临时修改的规则',
      customExtraInstructions: '临时特定指令'
    })

    const reset = resetInterrogationConfig()
    expect(reset.memoryCustomRules).toContain('高考直接主力军')
    expect(reset.customExtraInstructions).toContain('所有内容必须为高考服务')

    const reloaded = getInterrogationConfig()
    expect(reloaded.memoryCustomRules).toContain('有什么、是什么')
  })
})

describe('思维导图去答案变设问与考查细分测试 (buildQuizMindMapTree & detectDifficultChars)', () => {
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

  it('buildQuizMindMapTree 彻底剔除富文本 HTML 标签，保证题干与导图文本纯净', () => {
    const mockRichMap = {
      data: { text: '<p>理论</p>', richText: true },
      children: [
        {
          data: { text: '<p>原理</p>', richText: true },
          children: [
            {
              data: { text: '<p>合外力决定加速度大小与方向</p>', richText: true },
              children: []
            }
          ]
        }
      ]
    }

    const res = buildQuizMindMapTree(mockRichMap, { mode: 'memory' })
    const leaf = res.root.children[0].children[0]
    expect(leaf.data.target_node_text).toBe('原理')
    expect(leaf.data.aspect_domain).toBe('理论 ➔ 原理')
    expect(leaf.data.question_title).not.toContain('<p>')
    expect(leaf.data.question_title).not.toContain('</p>')
    expect(leaf.data.text).not.toContain('<p>')
    expect(leaf.data.text).not.toContain('</p>')
    expect(leaf.data.richText).toBeUndefined()
    expect(res.root.data.expand).toBe(true)
    expect(res.root.children[0].data.expand).toBe(true)
    expect(leaf.data.expand).toBe(true)
  })

  it('buildQuizMindMapTree 模式一构建【有什么、是什么】主力军设问树', () => {
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
    expect(res.root.data.text).toContain('[主力军考查]')

    const leafNode = res.root.children[0].children[0]
    expect(leafNode.data.isQuestion).toBe(true)
    expect(leafNode.data.status).toBe('pending')
    expect(leafNode.data.dimension_name).toBe('是什么')
    expect(leafNode.data.aspect_subdivision).toContain('高考必背名篇名句默写')
    expect(leafNode.data.has_difficult_chars).toBe(true)
    expect(leafNode.data.difficult_chars).toContain('鹜')
    expect(leafNode.data.difficult_chars).toContain('舸')
    expect(leafNode.data.difficult_chars).toContain('舰')
    // 答案被隐藏至 standard_answer，text 变为设问与进度样式
    expect(leafNode.data.standard_answer).toBe('落霞与孤鹜齐飞，秋水共长天一色。舸舰弥津。')
    expect(leafNode.data.text).toContain('❓ 【是什么】')
    expect(leafNode.data.fillColor).toBe('#fefce8')
    expect(leafNode.data.borderColor).toBe('#eab308')
  })

  it('buildQuizMindMapTree 模式二构建【为什么、为了什么】理解后勤部设问树', () => {
    const mockMap = {
      data: { text: '高中物理必修一' },
      children: [
        {
          data: { text: '牛顿第二定律' },
          children: [
            {
              data: { text: '合外力决定加速度大小与方向，为什么在超重失重状态下依然成立' },
              children: []
            }
          ]
        }
      ]
    }

    const res = buildQuizMindMapTree(mockMap, { mode: 'understanding' })
    expect(res.root).toBeDefined()
    expect(res.root.data.text).toContain('[后勤部复盘]')

    const leafNode = res.root.children[0].children[0]
    expect(leafNode.data.isQuestion).toBe(true)
    expect(leafNode.data.status).toBe('pending')
    expect(leafNode.data.dimension_name).toBe('为什么')
    expect(leafNode.data.aspect_subdivision).toContain('深层因果机制链条')
    expect(leafNode.data.has_difficult_chars).toBe(false)
    expect(leafNode.data.text).toContain('❓ 【为什么】')
    expect(leafNode.data.fillColor).toBe('#fefce8')
  })

  it('generateQuizMindMapTree 本地确定性生成，无需网络且 0 毫秒秒开（未配 Key 时）', async () => {
    const mockMap = {
      data: { text: '高中化学有机物' },
      children: [
        {
          data: { text: '乙醇的催化氧化反应机理' },
          children: []
        }
      ]
    }

    const tree = await generateQuizMindMapTree(mockMap, { mode: 'understanding' })
    expect(tree).toBeDefined()
    expect(tree.root).toBeDefined()
    expect(tree.aiGenerated).toBe(false)
  })
})

describe('AI 基于思维导图生成高考考题与单题重命题深度测试', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('generateQuizMindMapTree 通过 AI 基于思维导图大纲定制高质量考题并回填', async () => {
    const mockMap = {
      data: { uid: 'root_1', text: '高中物理·电磁感应' },
      children: [
        {
          data: { uid: 'node_faraday', text: '法拉第电磁感应定律' },
          children: [
            {
              data: { uid: 'leaf_formula', text: 'E = n * (ΔΦ/Δt) 感应电动势大小与磁通量变化率成正比' },
              children: []
            }
          ]
        }
      ]
    }

    // 模拟大模型返回针对思维导图生成的真实高考考题
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                questions: [
                  {
                    target_node_id: 'leaf_formula',
                    target_node_text: '法拉第电磁感应定律',
                    dimension: 'why',
                    dimension_name: '为什么',
                    aspect_subdivision: '感应电动势本质成因与磁通量变化率推导',
                    question: '【高考大题机理】在导体棒切割磁感线模型中，结合洛伦兹力推导为什么感应电动势的大小必然正比于磁通量的变化率 ΔΦ/Δt？',
                    understanding_hint: '从自由电子在磁场中受洛伦兹力沿导体运动做功的微观视角切入演绎。',
                    standard_answer: '微观电荷在磁场中做切割运动受到洛伦兹力做功，根据动生电动势定义 W=qE_感，推得感应电动势严格等于单位时间内磁通量的变化率。',
                    has_difficult_chars: false,
                    difficult_chars: [],
                    evaluation_criteria: '必须指出洛伦兹力沿导体方向分力做功，并严密得出 E = ΔΦ/Δt 表达式。'
                  }
                ]
              })
            }
          }
        ]
      })
    })

    const res = await generateQuizMindMapTree(mockMap, {
      mode: 'understanding',
      customApiKey: 'sk-mock-key-for-test',
      customBaseUrl: 'https://api.mock.test/v1'
    })

    expect(res.aiGenerated).toBe(true)
    const leaf = res.root.children[0].children[0]
    expect(leaf.data.ai_generated).toBe(true)
    expect(leaf.data.question_title).toContain('结合洛伦兹力推导为什么感应电动势的大小必然正比于磁通量的变化率')
    expect(leaf.data.understanding_hint).toContain('从自由电子在磁场中受洛伦兹力')
    expect(leaf.data.aspect_subdivision).toContain('感应电动势本质成因')
    expect(leaf.data.standard_answer).toContain('微观电荷在磁场中做切割运动受到洛伦兹力做功')
  })

  it('regenerateSingleQuestionWithAi 支持针对当前节点由 AI 换个角度重新出题', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                target_node_id: 'test_node_1',
                target_node_text: '楞次定律',
                dimension: 'for_what',
                dimension_name: '为了什么',
                aspect_subdivision: '能量守恒定律在电磁感应中的工具价值',
                question: '【新视角设问】从能量守恒定律的宏观视角剖析：高考力电综合大题中引入楞次定律是为了解决什么本质问题？阻碍磁通量变化的背后是什么能量转换？',
                understanding_hint: '外力克服安培力做功与感应电流产生的电能严格守恒。',
                standard_answer: '楞次定律是能量守恒定律在电磁现象中的直接体现，外力克服感应电流安培力所做的功完全转化为电路中的电能或内能。',
                evaluation_criteria: '指明能量守恒本质与安培力做功转化机制。'
              })
            }
          }
        ]
      })
    })

    const updated = await regenerateSingleQuestionWithAi(
      {
        target_node_id: 'test_node_1',
        target_node_text: '楞次定律',
        aspect_domain: '高中物理 ➔ 电磁感应 ➔ 楞次定律',
        standard_answer: '感应电流的磁场总要阻碍引起感应电流的磁通量的变化'
      },
      '- 高中物理\n  - 电磁感应\n    - 楞次定律',
      {
        mode: 'understanding',
        customApiKey: 'sk-mock-test',
        customBaseUrl: 'https://api.mock.test/v1'
      }
    )

    expect(updated.ai_generated).toBe(true)
    expect(updated.question).toContain('从能量守恒定律的宏观视角剖析')
    expect(updated.dimension_name).toBe('为了什么')
    expect(updated.understanding_hint).toContain('外力克服安培力做功')
    expect(updated.question).not.toContain('<p>')
  })

  it('generateQuizMindMapTree 在网络失败时安全降级为本地考纲模型，绝不抛错阻断用户', async () => {
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
  })
})
