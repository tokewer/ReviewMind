import { describe, it, expect } from 'bun:test'
import {
  stripHtml,
  findSubtree,
  extractKnowledgeOutline,
  getOutlineMetrics
} from '../web/src/utils/mindMapKnowledgeExtractor.js'

describe('思维导图知识大纲提取器 (MindMapKnowledgeExtractor)', () => {
  it('正确过滤富文本与 HTML 标签', () => {
    expect(stripHtml('<p><strong>牛顿第二定律</strong></p>')).toBe('牛顿第二定律')
    expect(stripHtml('<span>F&nbsp;=&nbsp;ma</span>')).toBe('F = ma')
    expect(stripHtml('<a>测试&lt;边界&gt;条件</a>')).toBe('测试<边界>条件')
    expect(stripHtml(null)).toBe('')
  })

  const sampleTree = {
    data: { text: '<p>高中物理</p>', uid: 'root-1' },
    children: [
      {
        data: { text: '<p>力学</p>', uid: 'mech-1', tag: ['重点'] },
        children: [
          {
            data: { text: '牛顿第二定律', note: 'F=ma，注意适用惯性系', uid: 'newton-2' },
            children: []
          },
          {
            data: { text: '动量守恒', uid: 'momentum-1' },
            children: []
          }
        ]
      },
      {
        data: { text: '电磁学', uid: 'em-1' },
        children: [
          {
            data: { text: '洛伦兹力', uid: 'lorentz-1' },
            children: []
          }
        ]
      }
    ]
  }

  it('正确提取整张导图知识大纲并保留 ID 与层级', () => {
    const outline = extractKnowledgeOutline(sampleTree)
    expect(outline).toContain('- 高中物理 [ID: root-1]')
    expect(outline).toContain('  - 力学 [ID: mech-1] [标签: 重点]')
    expect(outline).toContain('    - 牛顿第二定律 [ID: newton-2] (备注: F=ma，注意适用惯性系)')
    expect(outline).toContain('  - 电磁学 [ID: em-1]')
  })

  it('支持单分支子树聚焦提取', () => {
    const outline = extractKnowledgeOutline(sampleTree, { focusNodeId: 'mech-1' })
    expect(outline).toContain('- 力学 [ID: mech-1]')
    expect(outline).toContain('  - 牛顿第二定律 [ID: newton-2]')
    expect(outline).not.toContain('电磁学')
  })

  it('深度截断与结构度量计算', () => {
    const outline = extractKnowledgeOutline(sampleTree, { maxDepth: 2 })
    expect(outline).toContain('- 高中物理')
    expect(outline).toContain('  - 力学')
    expect(outline).not.toContain('牛顿第二定律')

    const fullOutline = extractKnowledgeOutline(sampleTree)
    const metrics = getOutlineMetrics(fullOutline)
    expect(metrics.nodeCount).toBe(6)
    expect(metrics.maxDepth).toBe(3)
  })
})
