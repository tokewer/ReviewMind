import { describe, it, expect, beforeEach } from 'bun:test'
import {
  DEFAULT_INTERROGATION_CONFIG,
  getInterrogationConfig,
  saveInterrogationConfig,
  resetInterrogationConfig
} from '../web/src/review/interrogationConfig.js'

describe('拷问系统规则与工作流配置中心 (interrogationConfig)', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  it('初始加载包含官方推荐的默认规则与工作流', () => {
    const config = getInterrogationConfig()
    expect(config.memoryCustomRules).toContain('注重理解')
    expect(config.understandingCustomRules).toContain('四维透视')
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
        understandingDimensions: ['which', 'why']
      }
    }

    const saved = saveInterrogationConfig(custom)
    expect(saved).toBe(true)

    const reloaded = getInterrogationConfig()
    expect(reloaded.memoryCustomRules).toBe('自定义记忆规则：高考文言文重点考查通假字')
    expect(reloaded.understandingCustomRules).toBe('自定义理解规则：深入分析受力分析图与加速度推导')
    expect(reloaded.customExtraInstructions).toBe('必须以苏格拉底步步追问风格设问')
    expect(reloaded.workflow.understandingDimensions).toEqual(['which', 'why'])
  })

  it('支持一键恢复官方推荐默认规则与工作流', () => {
    saveInterrogationConfig({
      memoryCustomRules: '临时修改的规则',
      customExtraInstructions: '临时特定指令'
    })

    const reset = resetInterrogationConfig()
    expect(reset.memoryCustomRules).toContain('注重理解')
    expect(reset.customExtraInstructions).toBe('')

    const reloaded = getInterrogationConfig()
    expect(reloaded.memoryCustomRules).toContain('注重理解')
  })
})
