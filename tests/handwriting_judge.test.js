import { describe, test, expect, beforeEach } from 'bun:test'
import {
  GAOKAO_JUDGE_SYSTEM_PROMPT,
  getJudgeAiConfig,
  saveJudgeAiConfig,
  normalizeJudgeResult,
  mapJudgeGradeToRating,
  applyJudgeRating,
  exportOptimizedInk
} from '../web/src/review/handwritingJudge'
import {
  RATING,
  addReview,
  getNode,
  importReviewData
} from '../web/src/review/index'

describe('高中语文理解性默写·高精度审判考官测试套件 (Gaokao Handwriting Judge)', () => {
  beforeEach(() => {
    localStorage.clear()
    importReviewData('{"version":5,"nodes":{}}')
  })

  test('考官系统提示词完整涵盖高考零容忍准则与结构化输出定义', () => {
    expect(GAOKAO_JUDGE_SYSTEM_PROMPT).toContain('高中语文理解性默写·高精度审判考官')
    expect(GAOKAO_JUDGE_SYSTEM_PROMPT).toContain('错一字、漏一字、添一字、颠倒一字均不得分')
    expect(GAOKAO_JUDGE_SYSTEM_PROMPT).toContain('WRONG_CHARACTER')
    expect(GAOKAO_JUDGE_SYSTEM_PROMPT).toContain('OMISSION_ADDITION')
    expect(GAOKAO_JUDGE_SYSTEM_PROMPT).toContain('CONTEXT_MISMATCH')
    expect(GAOKAO_JUDGE_SYSTEM_PROMPT).toContain('interrogation_critique')
    expect(GAOKAO_JUDGE_SYSTEM_PROMPT).toContain('diff_analysis')
  })

  test('考官接口配置读写与 baseUrl 格式化', () => {
    const defaultConfig = getJudgeAiConfig()
    expect(defaultConfig.baseUrl).toBe('https://api.openai.com/v1')
    expect(defaultConfig.modelName).toBe('gpt-4o-mini')

    saveJudgeAiConfig({
      apiKey: 'sk-test-key-123456',
      baseUrl: 'https://api.deepseek.com/v1///',
      modelName: 'deepseek-chat'
    })

    const updated = getJudgeAiConfig()
    expect(updated.apiKey).toBe('sk-test-key-123456')
    expect(updated.baseUrl).toBe('https://api.deepseek.com/v1') // 自动剔除末尾斜杠
    expect(updated.modelName).toBe('deepseek-chat')
  })

  test('normalizeJudgeResult 正确处理并补齐审判结构', () => {
    const rawResult = {
      extracted_text: '苍鸟恋旧林，池鱼思故渊。',
      is_fully_correct: false,
      grade: 1,
      diff_analysis: [
        { standard_char: '羁', actual_char: '苍', is_correct: false },
        { standard_char: '鸟', actual_char: '鸟', is_correct: true }
      ],
      error_type: 'WRONG_CHARACTER',
      error_details: {
        wrong_chars: [
          { expected: '羁', actual: '苍', reason: '误写为苍' }
        ],
        context_hint_analysis: '渴望摆脱束缚之意'
      },
      interrogation_critique: '致命失分：一字之差全题作废。'
    }

    const normalized = normalizeJudgeResult(rawResult, '羁鸟恋旧林，池鱼思故渊。')
    expect(normalized.is_fully_correct).toBe(false)
    expect(normalized.grade).toBe(1)
    expect(normalized.diff_analysis.length).toBe(2)
    expect(normalized.error_type).toBe('WRONG_CHARACTER')
    expect(normalized.error_details.wrong_chars[0].expected).toBe('羁')
    expect(normalized.interrogation_critique).toContain('致命失分')
  })

  test('normalizeJudgeResult 针对缺失 diff_analysis 自动对齐生成逐字比对', () => {
    const partialResult = {
      extracted_text: '池鱼思故渊',
      is_fully_correct: true,
      grade: 3
    }
    const normalized = normalizeJudgeResult(partialResult, '池鱼思故渊')
    expect(normalized.diff_analysis.length).toBe(5)
    expect(normalized.diff_analysis.every(c => c.is_correct)).toBe(true)
  })

  test('考官评级准确映射到 ReviewMind 调度动作', () => {
    expect(mapJudgeGradeToRating(3)).toBe(RATING.MASTERED)
    expect(mapJudgeGradeToRating(2)).toBe(RATING.REMEMBER)
    expect(mapJudgeGradeToRating(1)).toBe(RATING.FUZZY)
    expect(mapJudgeGradeToRating(0)).toBe(RATING.FORGOT)
    expect(mapJudgeGradeToRating(-1)).toBe(RATING.FORGOT)
  })

  test('applyJudgeRating 驱动节点间隔调度并沉淀错别字薄弱点', () => {
    const node = addReview({
      uid: 'test_node_gaokao',
      name: '《归园田居（其一）》',
      path: '高中语文 / 必修上',
      cycles: [1, 2, 4, 7, 15]
    })

    const judgeResult = {
      extracted_text: '苍鸟恋旧林，池鱼思故渊。',
      is_fully_correct: false,
      grade: 1,
      error_type: 'WRONG_CHARACTER',
      error_details: {
        wrong_chars: [
          { expected: '羁', actual: '苍', reason: '网马之套误写为苍' }
        ],
        context_hint_analysis: '束缚之鸟'
      },
      interrogation_critique: '羁字必须牢记网马革结构！'
    }

    const { rating, node: updatedNode } = applyJudgeRating(node.uid, judgeResult)
    expect(rating).toBe(RATING.FUZZY)
    expect(updatedNode.times).toBe(1)
    expect(updatedNode.errorCount).toBe(1)
    expect(updatedNode.lastRating).toBe(RATING.FUZZY)
    // 沉淀错字到 weakChars
    expect(updatedNode.weakChars).toContain('羁')
    // 沉淀最近审判记录
    expect(updatedNode.lastJudgeResult.grade).toBe(1)
    expect(updatedNode.lastJudgeResult.critique).toContain('网马革')
  })

  test('exportOptimizedInk 针对空画布或无效对象安全返回 null', () => {
    expect(exportOptimizedInk(null)).toBeNull()
  })
})
