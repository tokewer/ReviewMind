<template>
  <div class="handwritingBoardContainer" :class="{ dark: isDark, isCollapsed: isCollapsed }">
    <!-- 折叠栏标题与触发器 -->
    <div class="boardHeader" @click="toggleCollapse">
      <div class="headerLeft">
        <span class="headerIcon">✍️</span>
        <span class="headerTitle">数位板手写作答 · 高考高精度审判考官</span>
        <el-tag size="mini" type="danger" effect="plain" class="headerTag">高考零容忍标准</el-tag>
        <span class="strokeInfo" v-if="strokes.length && !isCollapsed">（已写 {{ strokes.length }} 笔）</span>
      </div>
      <div class="headerRight" @click.stop>
        <el-button
          size="mini"
          type="text"
          icon="el-icon-setting"
          @click="openConfigModal"
        >考官接口设置</el-button>
        <el-button
          size="mini"
          type="text"
          :icon="isCollapsed ? 'el-icon-arrow-down' : 'el-icon-arrow-up'"
          @click="toggleCollapse"
        >{{ isCollapsed ? '展开手写板' : '收起手写板' }}</el-button>
      </div>
    </div>

    <!-- 手写板展开内容 -->
    <el-collapse-transition>
      <div v-show="!isCollapsed" class="boardBody">
        <!-- 画板顶部工具栏 -->
        <div class="boardToolbar">
          <div class="toolGroup">
            <el-radio-group v-model="toolMode" size="mini">
              <el-radio-button label="pen">🖊️ 钢笔</el-radio-button>
              <el-radio-button label="eraser">🧹 橡皮</el-radio-button>
            </el-radio-group>
          </div>

          <div class="toolGroup" v-show="toolMode === 'pen'">
            <span class="toolLabel">粗细:</span>
            <el-radio-group v-model="lineWidth" size="mini">
              <el-radio-button :label="2">细</el-radio-button>
              <el-radio-button :label="4">中</el-radio-button>
              <el-radio-button :label="7">粗</el-radio-button>
            </el-radio-group>
          </div>

          <div class="toolGroup" v-show="toolMode === 'pen'">
            <span class="toolLabel">墨色:</span>
            <div class="colorPalette">
              <span
                v-for="c in colorOptions"
                :key="c.color"
                class="colorDot"
                :class="{ active: strokeColor === c.color }"
                :style="{ background: c.color }"
                :title="c.name"
                @click="strokeColor = c.color"
              ></span>
            </div>
          </div>

          <div class="toolGroup rightOps">
            <el-button size="mini" icon="el-icon-refresh-left" :disabled="!strokes.length" @click="undoStroke">撤回</el-button>
            <el-button size="mini" icon="el-icon-delete" :disabled="!strokes.length" @click="clearCanvas">清空</el-button>
            <el-button
              size="mini"
              type="danger"
              icon="el-icon-cpu"
              :loading="isEvaluating"
              @click="submitForJudgement"
            >
              {{ isEvaluating ? '考官审判中...' : '🤖 考官审判默写' }}
            </el-button>
          </div>
        </div>

        <!-- Canvas 作答区（带田字格/横线底纹） -->
        <div class="canvasWrapper" ref="canvasWrapper">
          <canvas
            ref="drawCanvas"
            class="drawCanvas"
            @pointerdown="handlePointerDown"
            @pointermove="handlePointerMove"
            @pointerup="handlePointerUp"
            @pointercancel="handlePointerUp"
          ></canvas>
          <div class="canvasWatermark" v-if="!strokes.length">
            <span>✍️ 在此处使用数位板、触控笔或鼠标书写默写诗句（支持压感）</span>
          </div>
        </div>

        <!-- 考官审判加载遮罩 -->
        <div class="evaluatingLoading" v-if="isEvaluating">
          <i class="el-icon-loading"></i>
          <span>高考语文审判考官正在逐字比对字形结构、偏旁笔画与情境匹配度...</span>
        </div>

        <!-- 考官审判结果面板 -->
        <transition name="el-zoom-in-top">
          <div class="judgeResultCard" v-if="judgeResult && !isEvaluating">
            <div class="resultTop">
              <div class="gradeBadge" :class="'grade-' + judgeResult.grade">
                <span class="gradeNum">{{ gradeText(judgeResult.grade) }}</span>
                <span class="gradeSub">（得分：{{ judgeResult.grade }} / 3）</span>
              </div>
              <div class="errorTypeTag">
                <el-tag
                  size="medium"
                  :type="judgeResult.is_fully_correct ? 'success' : 'danger'"
                  effect="dark"
                >
                  {{ errorTypeText(judgeResult.error_type) }}
                </el-tag>
              </div>
            </div>

            <!-- 识别文本总览 -->
            <div class="extractedTextRow">
              <span class="rowLabel">手写识别文本：</span>
              <span class="textValue">{{ judgeResult.extracted_text || '（未识别出有效文本）' }}</span>
            </div>

            <!-- 逐字红绿标色对照面板 (Diff Analysis) -->
            <div class="diffSection" v-if="judgeResult.diff_analysis && judgeResult.diff_analysis.length">
              <div class="diffTitle">逐字高考审判对照（绿字准确 · 红字扣死）：</div>
              <div class="charMatrix">
                <div
                  v-for="(item, idx) in judgeResult.diff_analysis"
                  :key="idx"
                  class="charBlock"
                  :class="{ correct: item.is_correct, wrong: !item.is_correct }"
                >
                  <div class="actualChar">{{ item.actual_char || '　' }}</div>
                  <div class="divider"></div>
                  <div class="standardChar">{{ item.standard_char }}</div>
                  <div class="statusMark">{{ item.is_correct ? '✓' : '✗' }}</div>
                </div>
              </div>
            </div>

            <!-- 错别字深度剖析 -->
            <div
              class="wrongCharsSection"
              v-if="judgeResult.error_details && judgeResult.error_details.wrong_chars && judgeResult.error_details.wrong_chars.length"
            >
              <div class="sectionTitle">⚠️ 错字致命点剖析：</div>
              <div
                v-for="(wc, widx) in judgeResult.error_details.wrong_chars"
                :key="widx"
                class="wrongCharCard"
              >
                <div class="wcHeader">
                  <span class="wcExpected">正字：<b>{{ wc.expected }}</b></span>
                  <span class="wcArrow">←</span>
                  <span class="wcActual">误写：<del>{{ wc.actual }}</del></span>
                </div>
                <div class="wcReason">{{ wc.reason }}</div>
              </div>
            </div>

            <!-- 题干关键词与情境契合度解析 -->
            <div
              class="contextSection"
              v-if="judgeResult.error_details && judgeResult.error_details.context_hint_analysis"
            >
              <span class="contextLabel">💡 情境审判分析：</span>
              <span class="contextText">{{ judgeResult.error_details.context_hint_analysis }}</span>
            </div>

            <!-- 考官冷峻评语与记忆锚点 -->
            <div class="critiqueBox" :class="{ 'critique-success': judgeResult.is_fully_correct }">
              <div class="critiqueTitle">
                <i class="el-icon-warning-outline"></i>
                <span>考官评语 & 笔画记忆锚点：</span>
              </div>
              <div class="critiqueBody">{{ judgeResult.interrogation_critique }}</div>
            </div>

            <!-- SM-2 间隔复习预测标签 -->
            <div class="sm2ScheduleRow" v-if="judgeResult.sm2">
              <span class="sm2Icon">📅</span>
              <span class="sm2Title">SM-2 推荐下次复习：</span>
              <el-tag size="mini" type="success" effect="dark">{{ judgeResult.sm2.interval }} 天后</el-tag>
              <span class="sm2Detail">（连续稳固 {{ judgeResult.sm2.repetition }} 次 · 记忆简易度 EF: {{ judgeResult.sm2.easeFactor }}）</span>
            </div>

            <!-- 联动评价快捷操作栏 -->
            <div class="judgeActionRow">
              <el-button
                type="success"
                size="medium"
                icon="el-icon-check"
                @click="adoptJudgeResult"
              >
                采纳考官评价：{{ actionNameForGrade(judgeResult.grade) }} 并推进
              </el-button>
              <el-button
                size="medium"
                plain
                icon="el-icon-edit"
                @click="retryHandwriting"
              >
                修改重写
              </el-button>
            </div>
          </div>
        </transition>
      </div>
    </el-collapse-transition>

    <!-- AI 考官接口设置弹窗 -->
    <el-dialog
      title="高考语文审判考官 · 接口配置"
      :visible.sync="configModalVisible"
      width="520px"
      append-to-body
      custom-class="judgeConfigModal"
    >
      <el-form label-width="120px" size="small">
        <el-alert
          title="考官采用视觉多模态大模型（Vision）逐字识别数位板墨迹并按高考考纲执行严苛批改。推荐配置 GPT-4o-mini 或 Gemini-1.5-flash。"
          type="info"
          :closable="false"
          style="margin-bottom: 16px;"
        ></el-alert>

        <el-form-item label="API Key">
          <el-input
            v-model="configForm.apiKey"
            placeholder="sk-..."
            show-password
          ></el-input>
        </el-form-item>

        <el-form-item label="API Base URL">
          <el-input
            v-model="configForm.baseUrl"
            placeholder="https://api.openai.com/v1"
          ></el-input>
          <div class="formHint">支持 OpenAI 官方、OneAPI、NewAPI、硅基流动、DeepSeek、Moonshot 等兼容节点</div>
        </el-form-item>

        <el-form-item label="Model Name">
          <el-input
            v-model="configForm.modelName"
            placeholder="gpt-4o-mini"
          ></el-input>
        </el-form-item>

        <el-form-item label="快捷预设">
          <el-button-group>
            <el-button size="mini" type="primary" plain @click="applyPreset('gemini')">Google Gemini 官方</el-button>
            <el-button size="mini" @click="applyPreset('deepseek')">DeepSeek</el-button>
            <el-button size="mini" @click="applyPreset('openai')">OpenAI 默认</el-button>
            <el-button size="mini" @click="applyPreset('silicon')">硅基流动</el-button>
          </el-button-group>
        </el-form-item>
      </el-form>

      <div slot="footer" class="dialog-footer">
        <el-button size="small" @click="configModalVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="saveConfig">保存并生效</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { trackEvent } from '@/utils/analytics'
import {
  exportOptimizedInk,
  requestHandwritingJudge,
  getJudgeAiConfig,
  saveJudgeAiConfig,
  mapJudgeGradeToRating,
  applyJudgeRating
} from '@/review/handwritingJudge'

export default {
  name: 'ReviewHandwritingBoard',
  props: {
    card: {
      type: Object,
      default: () => null
    },
    node: {
      type: Object,
      default: () => null
    },
    isDark: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      isCollapsed: false,
      toolMode: 'pen', // 'pen' | 'eraser'
      lineWidth: 4,
      strokeColor: '#1a1a1a',
      colorOptions: [
        { name: '经典黑', color: '#1a1a1a' },
        { name: '高考墨蓝', color: '#0d328c' },
        { name: '玄青', color: '#004d40' }
      ],
      strokes: [], // 存储所有笔画 [{ points: [{ x, y, pressure }], color, width, isEraser }]
      currentStroke: null,
      isDrawing: false,
      isEvaluating: false,
      judgeResult: null,
      configModalVisible: false,
      configForm: {
        apiKey: '',
        baseUrl: 'https://api.openai.com/v1',
        modelName: 'gpt-4o-mini'
      }
    }
  },
  watch: {
    card() {
      // 切换卡片时，若上一张已完成审判，则清空画板开启新题目
      if (this.judgeResult) {
        this.clearCanvas()
        this.judgeResult = null
      }
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.initCanvas()
      window.addEventListener('resize', this.handleResize)
    })
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.handleResize)
  },
  methods: {
    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed
      if (!this.isCollapsed) {
        this.$nextTick(() => {
          this.handleResize()
        })
      }
    },

    initCanvas() {
      const canvas = this.$refs.drawCanvas
      if (!canvas) return
      const wrapper = this.$refs.canvasWrapper
      if (!wrapper) return

      const dpr = window.devicePixelRatio || 1
      const rect = wrapper.getBoundingClientRect()
      const w = rect.width || 600
      const h = 220 // 适中书写区域

      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'

      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      this.redrawAllStrokes()
    },

    handleResize() {
      if (this.isCollapsed) return
      const canvas = this.$refs.drawCanvas
      const wrapper = this.$refs.canvasWrapper
      if (!canvas || !wrapper) return

      const dpr = window.devicePixelRatio || 1
      const rect = wrapper.getBoundingClientRect()
      if (rect.width === 0) return

      const oldW = parseFloat(canvas.style.width) || rect.width
      const oldH = parseFloat(canvas.style.height) || 220
      const newW = rect.width
      const newH = 220

      if (Math.abs(oldW - newW) > 2) {
        canvas.width = newW * dpr
        canvas.height = newH * dpr
        canvas.style.width = newW + 'px'
        canvas.style.height = newH + 'px'
        const ctx = canvas.getContext('2d')
        ctx.scale(dpr, dpr)
        this.redrawAllStrokes()
      }
    },

    getPointerPos(e) {
      const canvas = this.$refs.drawCanvas
      const rect = canvas.getBoundingClientRect()
      const pressure = typeof e.pressure === 'number' && e.pressure > 0 ? e.pressure : 0.5
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        pressure
      }
    },

    handlePointerDown(e) {
      if (!this.strokes.length) {
        trackEvent('Handwriting', 'Start_Writing')
      }
      const canvas = this.$refs.drawCanvas
      canvas.setPointerCapture(e.pointerId)
      this.isDrawing = true
      const pos = this.getPointerPos(e)

      this.currentStroke = {
        points: [pos],
        color: this.strokeColor,
        width: this.lineWidth,
        isEraser: this.toolMode === 'eraser'
      }

      this.drawSinglePoint(pos, this.currentStroke)
    },

    handlePointerMove(e) {
      if (!this.isDrawing || !this.currentStroke) return
      const pos = this.getPointerPos(e)
      this.currentStroke.points.push(pos)
      this.drawLatestSegment(this.currentStroke)
    },

    handlePointerUp(e) {
      if (!this.isDrawing) return
      this.isDrawing = false
      if (this.currentStroke && this.currentStroke.points.length > 0) {
        this.strokes.push(this.currentStroke)
      }
      this.currentStroke = null
      try {
        this.$refs.drawCanvas.releasePointerCapture(e.pointerId)
      } catch (err) {}
    },

    drawSinglePoint(pos, stroke) {
      const canvas = this.$refs.drawCanvas
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      ctx.save()
      ctx.fillStyle = stroke.isEraser ? '#ffffff' : stroke.color
      const r = (stroke.width * (pos.pressure || 0.5)) / 2
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, Math.max(1, r), 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    },

    drawLatestSegment(stroke) {
      const pts = stroke.points
      if (pts.length < 2) return
      const canvas = this.$refs.drawCanvas
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const p1 = pts[pts.length - 2]
      const p2 = pts[pts.length - 1]

      ctx.save()
      ctx.strokeStyle = stroke.isEraser ? '#ffffff' : stroke.color
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      const avgPressure = ((p1.pressure || 0.5) + (p2.pressure || 0.5)) / 2
      const strokeW = stroke.isEraser ? stroke.width * 3.5 : stroke.width * (0.4 + avgPressure * 0.9)
      ctx.lineWidth = Math.max(1, strokeW)

      ctx.beginPath()
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(p2.x, p2.y)
      ctx.stroke()
      ctx.restore()
    },

    drawMiziGrid(ctx, w, h) {
      const boxSize = 64
      const gap = 8
      const padY = Math.max(10, Math.floor((h - boxSize * 2 - gap) / 2))
      const cols = Math.floor((w - 16) / (boxSize + gap))
      const startX = Math.max(8, Math.floor((w - cols * (boxSize + gap) + gap) / 2))

      ctx.save()
      ctx.lineWidth = 1

      for (let row = 0; row < 2; row++) {
        const y = padY + row * (boxSize + gap + 10)
        if (y + boxSize > h - 4) break

        for (let col = 0; col < cols; col++) {
          const x = startX + col * (boxSize + gap)

          // 1. 外边框 (高考米字格浅淡红细线)
          ctx.strokeStyle = '#f4d6d6'
          ctx.setLineDash([])
          ctx.strokeRect(x, y, boxSize, boxSize)

          // 2. 内部十字线与对角线 (虚线)
          ctx.strokeStyle = '#faeaea'
          ctx.setLineDash([3, 3])

          // 水平中线
          ctx.beginPath()
          ctx.moveTo(x, y + boxSize / 2)
          ctx.lineTo(x + boxSize, y + boxSize / 2)
          ctx.stroke()

          // 垂直中线
          ctx.beginPath()
          ctx.moveTo(x + boxSize / 2, y)
          ctx.lineTo(x + boxSize / 2, y + boxSize)
          ctx.stroke()

          // 对角线 1
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(x + boxSize, y + boxSize)
          ctx.stroke()

          // 对角线 2
          ctx.beginPath()
          ctx.moveTo(x + boxSize, y)
          ctx.lineTo(x, y + boxSize)
          ctx.stroke()
        }
      }
      ctx.restore()
    },

    redrawAllStrokes() {
      const canvas = this.$refs.drawCanvas
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const w = parseFloat(canvas.style.width) || canvas.width
      const h = parseFloat(canvas.style.height) || canvas.height

      // 填充纯白背景
      ctx.save()
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)

      // 绘制高考答题卡典雅米字格底纹
      this.drawMiziGrid(ctx, w, h)
      ctx.restore()

      // 重新绘制所有笔画
      this.strokes.forEach(stroke => {
        if (!stroke.points || stroke.points.length === 0) return
        if (stroke.points.length === 1) {
          this.drawSinglePoint(stroke.points[0], stroke)
          return
        }

        ctx.save()
        ctx.strokeStyle = stroke.isEraser ? '#ffffff' : stroke.color
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        for (let i = 1; i < stroke.points.length; i++) {
          const p1 = stroke.points[i - 1]
          const p2 = stroke.points[i]
          const avgPressure = ((p1.pressure || 0.5) + (p2.pressure || 0.5)) / 2
          const strokeW = stroke.isEraser ? stroke.width * 3.5 : stroke.width * (0.4 + avgPressure * 0.9)
          ctx.lineWidth = Math.max(1, strokeW)
          ctx.beginPath()
          ctx.moveTo(p1.x, p1.y)
          ctx.lineTo(p2.x, p2.y)
          ctx.stroke()
        }
        ctx.restore()
      })
    },

    undoStroke() {
      if (!this.strokes.length) return
      this.strokes.pop()
      this.redrawAllStrokes()
    },

    clearCanvas() {
      this.strokes = []
      this.redrawAllStrokes()
    },

    retryHandwriting() {
      this.judgeResult = null
    },

    openConfigModal() {
      const cfg = getJudgeAiConfig()
      this.configForm = {
        apiKey: cfg.apiKey,
        baseUrl: cfg.baseUrl,
        modelName: cfg.modelName
      }
      this.configModalVisible = true
    },

    applyPreset(type) {
      if (type === 'gemini') {
        this.configForm.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai'
        this.configForm.modelName = 'gemini-1.5-pro'
      } else if (type === 'openai') {
        this.configForm.baseUrl = 'https://api.openai.com/v1'
        this.configForm.modelName = 'gpt-4o-mini'
      } else if (type === 'silicon') {
        this.configForm.baseUrl = 'https://api.siliconflow.cn/v1'
        this.configForm.modelName = 'deepseek-ai/DeepSeek-V2.5'
      } else if (type === 'deepseek') {
        this.configForm.baseUrl = 'https://api.deepseek.com/v1'
        this.configForm.modelName = 'deepseek-chat'
      }
    },

    saveConfig() {
      saveJudgeAiConfig(this.configForm)
      this.configModalVisible = false
      this.$message.success('考官接口配置已保存！')
    },

    async submitForJudgement() {
      if (!this.strokes.length) {
        this.$message.warning('请先在手写板中书写默写诗句后再提交审判！')
        return
      }

      const cfg = getJudgeAiConfig()
      if (!cfg.apiKey) {
        this.$message.info('首次使用请先配置 AI API Key')
        this.openConfigModal()
        return
      }

      const canvas = this.$refs.drawCanvas
      const imageBase64 = exportOptimizedInk(canvas)
      if (!imageBase64) {
        this.$message.warning('未能提取到有效笔迹，请书写清晰后重试！')
        return
      }

      const promptText = (this.card && this.card.front) || (this.node && this.node.name) || ''
      const sourceText = (this.node && (this.node.path || this.node.name)) || (this.card && this.card.hint) || ''
      const answerText = (this.card && this.card.back) || ''

      this.isEvaluating = true
      this.judgeResult = null

      try {
        const result = await requestHandwritingJudge({
          imageBase64,
          prompt: promptText,
          source: sourceText,
          standardAnswer: answerText
        })
        this.judgeResult = result
        this.$message.success('考官审判完成！请查阅详细字句与错误诊断。')

        // 审判完成后自动触发显示参考答案，方便对照
        this.$emit('reveal-answer')
      } catch (err) {
        this.$message.error(err.message || '考官审判请求失败')
      } finally {
        this.isEvaluating = false
      }
    },

    adoptJudgeResult() {
      if (!this.judgeResult) return
      const rating = mapJudgeGradeToRating(this.judgeResult.grade)
      const uid = this.node ? this.node.uid : null

      if (uid) {
        applyJudgeRating(uid, this.judgeResult, this.card)
      }

      this.$emit('rate', rating)
    },

    gradeText(grade) {
      switch (grade) {
        case 3:
          return '满分通过 (Pass)'
        case 2:
          return '勉强过关 (Hard)'
        case 1:
          return '致命错字 (Mistake)'
        case 0:
        default:
          return '全题失分 (Failed)'
      }
    },

    errorTypeText(type) {
      switch (type) {
        case 'NONE':
          return '✅ 一字不差 · 契合情境'
        case 'WRONG_CHARACTER':
          return '❌ 错别字 · 高考零容忍扣分'
        case 'OMISSION_ADDITION':
          return '⚠️ 漏字 / 添字 / 语序颠倒'
        case 'CONTEXT_MISMATCH':
          return '🚫 答非所问 · 偏离题干情境'
        case 'BLANK_OR_UNRECOGNIZED':
          return '❓ 空白 / 字迹无法辨识'
        default:
          return type || '审判失分'
      }
    },

    actionNameForGrade(grade) {
      switch (grade) {
        case 3:
          return '🌟 熟练'
        case 2:
          return '✅ 记得'
        case 1:
          return '🤔 模糊'
        case 0:
        default:
          return '😰 忘记'
      }
    }
  }
}
</script>

<style lang="less" scoped>
.handwritingBoardContainer {
  margin-top: 14px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);

  &.dark {
    background: #1e1e24;
    border-color: #383842;
    color: #e0e0e0;
  }

  .boardHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: #f8fafc;
    border-bottom: 1px solid #ebeef5;
    cursor: pointer;
    user-select: none;

    .headerLeft {
      display: flex;
      align-items: center;
      gap: 8px;

      .headerIcon {
        font-size: 16px;
      }

      .headerTitle {
        font-size: 13px;
        font-weight: 600;
        color: #2c3e50;
      }

      .headerTag {
        font-size: 11px;
        height: 20px;
        line-height: 18px;
      }

      .strokeInfo {
        font-size: 11px;
        color: #909399;
      }
    }

    .headerRight {
      display: flex;
      align-items: center;
      gap: 10px;
    }
  }

  .boardBody {
    padding: 12px 14px;
  }

  .boardToolbar {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 14px;
    margin-bottom: 10px;

    .toolGroup {
      display: flex;
      align-items: center;
      gap: 6px;

      .toolLabel {
        font-size: 12px;
        color: #606266;
      }
    }

    .colorPalette {
      display: flex;
      align-items: center;
      gap: 6px;

      .colorDot {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        cursor: pointer;
        border: 2px solid transparent;
        transition: transform 0.2s;

        &:hover {
          transform: scale(1.15);
        }

        &.active {
          border-color: #409eff;
          box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.3);
        }
      }
    }

    .rightOps {
      margin-left: auto;
    }
  }

  .canvasWrapper {
    position: relative;
    width: 100%;
    height: 220px;
    border: 1px solid #dcdfe6;
    border-radius: 6px;
    overflow: hidden;
    background: #ffffff;
    touch-action: none;

    .drawCanvas {
      display: block;
      width: 100%;
      height: 100%;
      cursor: crosshair;
    }

    .canvasWatermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #c0c4cc;
      font-size: 13px;
      pointer-events: none;
      user-select: none;
      white-space: nowrap;
    }
  }

  .evaluatingLoading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 18px;
    margin-top: 12px;
    background: #fdf6ec;
    border: 1px dashed #e6a23c;
    border-radius: 6px;
    color: #b88230;
    font-size: 13px;
    font-weight: 500;
  }

  .judgeResultCard {
    margin-top: 14px;
    padding: 16px;
    border-radius: 8px;
    background: #fafbfc;
    border: 1px solid #ebeef5;
    animation: fadeIn 0.3s ease;

    .resultTop {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;

      .gradeBadge {
        display: flex;
        align-items: baseline;
        gap: 6px;

        .gradeNum {
          font-size: 16px;
          font-weight: 700;
        }

        .gradeSub {
          font-size: 12px;
          color: #909399;
        }

        &.grade-3 {
          color: #67c23a;
        }
        &.grade-2 {
          color: #e6a23c;
        }
        &.grade-1 {
          color: #f56c6c;
        }
        &.grade-0 {
          color: #909399;
        }
      }
    }

    .extractedTextRow {
      font-size: 13px;
      margin-bottom: 12px;
      padding: 8px 10px;
      background: #f4f4f5;
      border-radius: 4px;

      .rowLabel {
        color: #909399;
      }
      .textValue {
        font-weight: 600;
        color: #303133;
      }
    }

    .diffSection {
      margin-bottom: 14px;

      .diffTitle {
        font-size: 12px;
        font-weight: 600;
        color: #606266;
        margin-bottom: 8px;
      }

      .charMatrix {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;

        .charBlock {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 38px;
          padding: 4px 2px;
          border-radius: 4px;
          border: 1px solid #dcdfe6;
          font-family: 'KaiTi', '楷体', 'STKaiti', serif;

          .actualChar {
            font-size: 16px;
            font-weight: 700;
            line-height: 1.2;
          }

          .divider {
            width: 100%;
            height: 1px;
            background: rgba(0, 0, 0, 0.08);
            margin: 2px 0;
          }

          .standardChar {
            font-size: 13px;
            opacity: 0.8;
          }

          .statusMark {
            font-size: 10px;
            font-weight: bold;
            margin-top: 1px;
          }

          &.correct {
            background: #f0f9eb;
            border-color: #c2e7b0;
            color: #529b2e;
          }

          &.wrong {
            background: #fef0f0;
            border-color: #fbc4c4;
            color: #f56c6c;
            animation: pulse 1s infinite alternate;

            .actualChar {
              text-decoration: underline;
            }
          }
        }
      }
    }

    .wrongCharsSection {
      margin-bottom: 12px;

      .sectionTitle {
        font-size: 12px;
        font-weight: 600;
        color: #f56c6c;
        margin-bottom: 6px;
      }

      .wrongCharCard {
        background: #fff;
        border: 1px solid #fde2e2;
        border-left: 4px solid #f56c6c;
        padding: 8px 12px;
        border-radius: 4px;
        margin-bottom: 6px;

        .wcHeader {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          margin-bottom: 4px;

          .wcExpected {
            color: #67c23a;
          }
          .wcArrow {
            color: #909399;
          }
          .wcActual {
            color: #f56c6c;
          }
        }

        .wcReason {
          font-size: 12px;
          color: #606266;
          line-height: 1.5;
        }
      }
    }

    .contextSection {
      font-size: 12px;
      color: #606266;
      background: #ecf5ff;
      border-radius: 4px;
      padding: 6px 10px;
      margin-bottom: 12px;

      .contextLabel {
        font-weight: 600;
        color: #409eff;
      }
    }

    .critiqueBox {
      background: #fef0f0;
      border: 1px solid #fbc4c4;
      border-left: 4px solid #f56c6c;
      border-radius: 4px;
      padding: 10px 14px;
      margin-bottom: 14px;

      &.critique-success {
        background: #f0f9eb;
        border-color: #c2e7b0;
        border-left-color: #67c23a;

        .critiqueTitle {
          color: #529b2e;
        }
      }

      .critiqueTitle {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 700;
        color: #c45656;
        margin-bottom: 4px;
      }

      .critiqueBody {
        font-size: 13px;
        line-height: 1.6;
        color: #303133;
      }
    }

    .sm2ScheduleRow {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      background: #f0f9eb;
      border: 1px solid #e1f3d8;
      border-radius: 4px;
      padding: 8px 12px;
      margin-bottom: 14px;

      .sm2Icon {
        font-size: 16px;
      }
      .sm2Title {
        font-weight: 600;
        color: #67c23a;
      }
      .sm2Detail {
        font-size: 12px;
        color: #909399;
      }
    }

    .judgeActionRow {
      display: flex;
      align-items: center;
      gap: 12px;
    }
  }

  .formHint {
    font-size: 11px;
    color: #909399;
    margin-top: 4px;
    line-height: 1.4;
  }
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(245, 108, 108, 0.4);
  }
  100% {
    box-shadow: 0 0 0 4px rgba(245, 108, 108, 0);
  }
}
</style>
