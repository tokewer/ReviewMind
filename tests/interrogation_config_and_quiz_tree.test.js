import { describe, it, expect, beforeEach } from 'bun:test'
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

  it('generateQuizMindMapTree 本地确定性生成，无需网络且 0 毫秒秒开', async () => {
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
  })
})
