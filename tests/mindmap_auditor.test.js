import { describe, it, expect } from 'bun:test'
import {
  AUDITOR_SYSTEM_PROMPT,
  INTERROGATION_SYSTEM_PROMPT,
  MEMORY_INTERROGATION_SYSTEM_PROMPT,
  UNDERSTANDING_INTERROGATION_SYSTEM_PROMPT,
  parseModelJsonResponse
} from '../web/src/review/mindMapAuditor.js'

describe('思维导图学术审校与考官服务 (MindMapAuditor)', () => {
  it('审校提示词严格包含禁止代写铁律与 4 维体检模型', () => {
    expect(AUDITOR_SYSTEM_PROMPT).toContain('绝对禁止替学生代写、补充任何子节点')
    expect(AUDITOR_SYSTEM_PROMPT).toContain('FACTUAL_ERROR')
    expect(AUDITOR_SYSTEM_PROMPT).toContain('HIERARCHY_INVERSION')
    expect(AUDITOR_SYSTEM_PROMPT).toContain('MISSING_PREREQUISITE')
    expect(AUDITOR_SYSTEM_PROMPT).toContain('CONFUSION_RISK')
  })

  it('苏格拉底考官提示词包含三阶提问模型', () => {
    expect(INTERROGATION_SYSTEM_PROMPT).toContain('essence')
    expect(INTERROGATION_SYSTEM_PROMPT).toContain('derivation')
    expect(INTERROGATION_SYSTEM_PROMPT).toContain('counterexample')
    expect(INTERROGATION_SYSTEM_PROMPT).toContain('严禁在题干中直接透露答案')
  })

  it('内容记忆模式提示词包含注重理解与生僻字定向提取铁律', () => {
    expect(MEMORY_INTERROGATION_SYSTEM_PROMPT).toContain('注重理解，只有理解了才能记忆住')
    expect(MEMORY_INTERROGATION_SYSTEM_PROMPT).toContain('difficult_chars')
    expect(MEMORY_INTERROGATION_SYSTEM_PROMPT).toContain('has_difficult_chars')
  })

  it('内容理解模式提示词包含四维透视架构', () => {
    expect(UNDERSTANDING_INTERROGATION_SYSTEM_PROMPT).toContain('有哪些')
    expect(UNDERSTANDING_INTERROGATION_SYSTEM_PROMPT).toContain('是什么')
    expect(UNDERSTANDING_INTERROGATION_SYSTEM_PROMPT).toContain('为什么')
    expect(UNDERSTANDING_INTERROGATION_SYSTEM_PROMPT).toContain('为了什么')
  })

  it('parseModelJsonResponse 能够正确解析 Markdown 包裹的 JSON 与原始 JSON', () => {
    const raw = '{"summary": "整体逻辑良好", "score": 90, "issues": []}'
    expect(parseModelJsonResponse(raw)).toEqual({ summary: '整体逻辑良好', score: 90, issues: [] })

    const mdWrapped = '```json\n{"summary": "存在缺陷", "score": 70, "issues": [{"node_id": "1", "severity": "WARNING"}]}\n```'
    const res = parseModelJsonResponse(mdWrapped)
    expect(res.score).toBe(70)
    expect(res.issues.length).toBe(1)

    // 容错前后闲聊
    const noisy = '这是一份体检报告：\n{"summary": "有硬伤", "score": 60, "issues": []}\n请仔细检查！'
    expect(parseModelJsonResponse(noisy).score).toBe(60)

    expect(parseModelJsonResponse('纯文本无法解析')).toBeNull()
  })
})
