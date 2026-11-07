<template>
  <el-dialog
    title="🧠 AI 苏格拉底式系统化深度拷问系统"
    :visible.sync="visible"
    width="720px"
    :append-to-body="true"
    custom-class="aiInterrogationDialog"
  >
    <div class="dialogBody" v-loading="loading" :element-loading-text="loadingText">
      <!-- 顶部控制与靶向范围栏 -->
      <div class="topControlBar">
        <div class="targetNodeBanner">
          <span class="targetIcon">🎯</span>
          <span class="targetLabel">考查范围：</span>
          <strong class="targetName" v-if="focusNodeId">【{{ selectedNodeText }}】分支</strong>
          <strong class="targetName" v-else>全图宏观知识网络</strong>
          <el-button
            type="text"
            size="mini"
            @click="toggleFocusMode"
            style="margin-left: 8px;"
          >
            {{ focusNodeId ? '切换为全图考查' : (hasCanvasSelection ? '考查当前选中节点' : '') }}
          </el-button>
        </div>

        <div class="topActions">
          <el-button size="mini" icon="el-icon-setting" @click="openConfig">
            API 配置
          </el-button>
          <el-button
            type="primary"
            size="mini"
            icon="el-icon-refresh"
            @click="startNewExam"
            :disabled="loading"
          >
            开启新一轮拷问
          </el-button>
        </div>
      </div>

      <!-- 考核进度步骤条 -->
      <div class="examStepsBar">
        <el-steps :active="currentStage" finish-status="success" align-center size="small">
          <el-step title="第 1 关" description="溯源本质"></el-step>
          <el-step title="第 2 关" description="逻辑推导"></el-step>
          <el-step title="第 3 关" description="边界反例"></el-step>
          <el-step title="考核鉴定" description="总评报告"></el-step>
        </el-steps>
      </div>

      <!-- 考核进行中：考题展示卡片 -->
      <div v-if="currentStage < 3 && currentQuiz" class="quizMainArea">
        <div class="questionCard">
          <div class="nodeBadge">
            <el-tag size="small" type="primary">📌 考查靶点：{{ currentQuiz.target_node_text || '核心概念' }}</el-tag>
            <el-tag size="small" type="warning" style="margin-left: 8px;">
              {{ getStageTypeName(currentStage) }}
            </el-tag>
          </div>
          <div class="questionContent">
            {{ currentQuiz.question }}
          </div>
        </div>

        <!-- 作答输入区 -->
        <div class="answerArea">
          <div class="modeToggle">
            <span class="subTitle">✍️ 您的推导演绎作答：</span>
            <el-radio-group v-model="answerMode" size="mini">
              <el-radio-button label="text">键盘输入</el-radio-button>
              <el-radio-button label="handwriting">数位板手写</el-radio-button>
            </el-radio-group>
          </div>

          <div v-if="answerMode === 'text'" class="textInputBox">
            <el-input
              type="textarea"
              :rows="5"
              placeholder="请在此输入您的推导过程、前提判定条件或反例辨析..."
              v-model="userAnswerText"
            ></el-input>
          </div>

          <div v-else class="handwritingBox">
            <ReviewHandwritingBoard
              ref="handwritingBoardRef"
              :card="currentHandwritingCard"
              @judge-completed="onHandwritingJudgeCompleted"
            />
          </div>

          <div class="submitRow" v-if="answerMode === 'text' && !currentJudgeResult">
            <el-button
              type="success"
              size="medium"
              icon="el-icon-check"
              @click="submitTextAnswer"
              :disabled="!userAnswerText.trim() || judging"
            >
              {{ judging ? '考官严苛审判中...' : '提交答案 · 接受审判' }}
            </el-button>
          </div>
        </div>

        <!-- 本题审判反馈结果 -->
        <div v-if="currentJudgeResult" class="judgeFeedbackBox" :class="'grade-' + currentJudgeResult.grade">
          <div class="judgeHeader">
            <el-tag size="medium" :type="getGradeTagType(currentJudgeResult.grade)">
              本题评级：{{ getGradeLabel(currentJudgeResult.grade) }}
            </el-tag>
            <span class="gradeScore">得分：{{ currentJudgeResult.grade * 33 + (currentStage === 2 ? 1 : 0) }} 分</span>
          </div>
          <div class="critiqueText">
            <strong>【考官审判】</strong>：{{ currentJudgeResult.interrogation_critique }}
          </div>

          <div class="nextStepRow">
            <el-button
              type="primary"
              size="small"
              icon="el-icon-right"
              @click="nextStage"
            >
              {{ currentStage < 2 ? `进入第 ${currentStage + 2} 关` : '生成考核鉴定总评' }}
            </el-button>
          </div>
        </div>
      </div>

      <!-- 考核完成：终极考核鉴定书 -->
      <div v-if="currentStage === 3" class="finalReportArea">
        <div class="reportHeader">
          <div class="totalScoreBadge">
            <span class="label">考核综合得分</span>
            <span class="val" :style="{ color: getScoreColor(totalScore) }">{{ totalScore }}</span>
          </div>
          <div class="reportTitleBox">
            <h3>🎉 本轮苏格拉底系统考核已完成！</h3>
            <p>已全流程考查【本质内涵】、【因果推导】与【边界反例】三大核心认知维度。</p>
          </div>
        </div>

        <div class="stageHistoryList">
          <div
            v-for="(item, idx) in stageRecords"
            :key="idx"
            class="historyCard"
          >
            <div class="cardTop">
              <span class="stageTag">{{ getStageTypeName(idx) }}</span>
              <span class="targetPoint">📌 {{ item.quiz.target_node_text }}</span>
              <el-tag size="mini" :type="getGradeTagType(item.result.grade)">
                {{ getGradeLabel(item.result.grade) }}
              </el-tag>
            </div>
            <div class="historyCritique">
              {{ item.result.interrogation_critique }}
            </div>
          </div>
        </div>

        <div class="syncReviewBox">
          <el-button
            type="primary"
            size="medium"
            icon="el-icon-collection"
            @click="syncToReviewData"
          >
            将薄弱漏洞节点沉淀至 ReviewMind 复习大盘 (SM-2 调度)
          </el-button>
          <el-button size="medium" @click="startNewExam">
            开始新一轮考核
          </el-button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script>
import { generateSocraticQuiz } from '@/review/mindMapAuditor'
import { getJudgeAiConfig, applyJudgeRating } from '@/review/handwritingJudge'
import ReviewHandwritingBoard from './ReviewHandwritingBoard.vue'

const STAGE_TYPES = ['essence', 'derivation', 'counterexample']

export default {
  name: 'AiInterrogationDialog',
  components: {
    ReviewHandwritingBoard
  },
  props: {
    mindMap: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      visible: false,
      loading: false,
      loadingText: 'AI 考官正在全图检索关键节点出题...',
      judging: false,
      focusNodeId: null,
      selectedNodeText: '',
      currentStage: 0, // 0: 溯源本质, 1: 逻辑推导, 2: 边界反例, 3: 总评报告
      currentQuiz: null,
      answerMode: 'text',
      userAnswerText: '',
      currentJudgeResult: null,
      stageRecords: [] // 保存每一关的 { quiz, answer, result }
    }
  },
  created() {
    this.$bus.$on('showAiInterrogation', (payload) => {
      this.show(payload)
    })
  },
  beforeDestroy() {
    this.$bus.$off('showAiInterrogation')
  },
  computed: {
    hasCanvasSelection() {
      if (!this.mindMap || !this.mindMap.renderer) return false
      const list = this.mindMap.renderer.activeNodeList || []
      return list.length > 0
    },
    currentHandwritingCard() {
      if (!this.currentQuiz) return null
      return {
        id: this.currentQuiz.target_node_id || `quiz_${this.currentStage}`,
        prompt: this.currentQuiz.question,
        standard_answer: this.currentQuiz.evaluation_criteria || '逻辑自洽且包含完整物理/学科条件'
      }
    },
    totalScore() {
      if (!this.stageRecords.length) return 0
      const total = this.stageRecords.reduce((sum, item) => {
        return sum + (item.result?.grade || 0)
      }, 0)
      return Math.round((total / (this.stageRecords.length * 3)) * 100)
    }
  },
  methods: {
    show(payload = {}) {
      this.visible = true
      if (payload && payload.focusNodeId) {
        this.focusNodeId = payload.focusNodeId
        this.selectedNodeText = payload.nodeText || ''
      } else {
        this.checkCanvasSelection()
      }
      this.startNewExam()
    },
    checkCanvasSelection() {
      if (this.mindMap && this.mindMap.renderer) {
        const list = this.mindMap.renderer.activeNodeList || []
        if (list.length > 0) {
          const node = list[0]
          this.focusNodeId = node.nodeData?.data?.uid || node.nodeData?.data?.id || null
          this.selectedNodeText = (node.nodeData?.data?.text || '').replace(/<[^>]+>/g, '').trim()
          return
        }
      }
      this.focusNodeId = null
      this.selectedNodeText = ''
    },
    toggleFocusMode() {
      if (this.focusNodeId) {
        this.focusNodeId = null
        this.selectedNodeText = ''
      } else {
        this.checkCanvasSelection()
      }
      this.startNewExam()
    },
    openConfig() {
      this.$bus.$emit('showAiConfig')
    },
    getRootNode() {
      if (!this.mindMap) return null
      const raw = this.mindMap.getData(false)
      if (raw && (raw.root || raw.data)) {
        return raw.root || raw
      }
      if (this.mindMap.renderer && this.mindMap.renderer.root) {
        return this.mindMap.renderer.root.nodeData
      }
      return null
    },
    async startNewExam() {
      const cfg = getJudgeAiConfig()
      if (!cfg.apiKey) {
        this.$message.info('首次使用请先配置大模型 API Key（支持 Gemini、DeepSeek 等）')
        this.openConfig()
        return
      }

      this.currentStage = 0
      this.stageRecords = []
      this.loadStageQuestion(0)
    },
    async loadStageQuestion(stageIndex) {
      const rootNode = this.getRootNode()
      if (!rootNode || !rootNode.data) {
        this.$message.warning('当前导图内容为空，请先在画布中添加或打开节点')
        return
      }

      this.loading = true
      this.currentJudgeResult = null
      this.userAnswerText = ''
      const qType = STAGE_TYPES[stageIndex] || 'all'
      this.loadingText = `AI 考官正在生成第 ${stageIndex + 1} 关【${this.getStageTypeName(stageIndex)}】考题...`

      try {
        const quiz = await generateSocraticQuiz(rootNode, {
          focusNodeId: this.focusNodeId,
          questionType: qType
        })
        if (!quiz || !quiz.question) {
          throw new Error('出题格式异常，请重试')
        }
        this.currentQuiz = quiz
      } catch (err) {
        this.$message.error(err.message || '出题失败，请检查网络或 API 配置')
      } finally {
        this.loading = false
      }
    },
    async submitTextAnswer() {
      if (!this.userAnswerText.trim() || !this.currentQuiz) return

      this.judging = true
      try {
        const cfg = getJudgeAiConfig()
        const endpoint = `${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`

        const judgePrompt = `【考官审判任务】
考查环节：第 ${this.currentStage + 1} 关【${this.getStageTypeName(this.currentStage)}】
考查问题：${this.currentQuiz.question}
标准判定要点：${this.currentQuiz.evaluation_criteria || '逻辑自洽且无科学错误'}
学生作答：${this.userAnswerText.trim()}

请以冷峻、一针见血的高考阅卷组长口吻对学生作答进行审判打分（强制输出合法的 JSON 对象）：
{
  "grade": 3 | 2 | 1 | 0, // 3: 完全正确且推导清晰; 2: 答对但略有瑕疵/犹豫; 1: 存在概念混淆或前提缺失; 0: 答非所问或完全错误
  "interrogation_critique": "指出学生作答中的核心思维漏洞、条件缺失或精准点拨"
}`

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.apiKey}`
          },
          body: JSON.stringify({
            model: cfg.modelName,
            temperature: 0.0,
            response_format: { type: 'json_object' },
            messages: [{ role: 'user', content: judgePrompt }]
          })
        })

        if (!res.ok) {
          throw new Error(`审判接口请求失败 (${res.status})`)
        }

        const data = await res.json()
        const content = data.choices?.[0]?.message?.content || '{}'
        const parsed = JSON.parse(content)
        this.currentJudgeResult = parsed

        // 记录此关成绩
        this.stageRecords.push({
          stage: this.currentStage,
          quiz: this.currentQuiz,
          answer: this.userAnswerText.trim(),
          result: parsed
        })
      } catch (e) {
        this.$message.error(e.message || '审判失败')
      } finally {
        this.judging = false
      }
    },
    onHandwritingJudgeCompleted(res) {
      this.currentJudgeResult = res
      this.stageRecords.push({
        stage: this.currentStage,
        quiz: this.currentQuiz,
        answer: res.extracted_text || '数位板手写墨迹',
        result: res
      })
    },
    nextStage() {
      if (this.currentStage < 2) {
        this.currentStage += 1
        this.loadStageQuestion(this.currentStage)
      } else {
        this.currentStage = 3 // 展示总评报告
      }
    },
    syncToReviewData() {
      // 找出所有评分低于 2 分的漏洞考查节点，推入 ReviewMind 错题复习本
      let syncedCount = 0
      this.stageRecords.forEach(record => {
        if (record.result && record.result.grade <= 1) {
          try {
            applyJudgeRating(record.quiz?.target_node_id, record.result)
            syncedCount += 1
          } catch (e) {}
        }
      })
      if (syncedCount > 0) {
        this.$message.success(`已成功将 ${syncedCount} 个薄弱知识点沉淀至复习流，将在今日高频复现！`)
      } else {
        this.$message.info('本轮作答全部优秀达标，无新增薄弱错题！')
      }
    },
    getStageTypeName(stage) {
      const map = {
        0: '第一关：溯源本质题',
        1: '第二关：逻辑推导题',
        2: '第三关：边界反例题'
      }
      return map[stage] || '综合考查'
    },
    getGradeLabel(grade) {
      const map = {
        3: '完全正确 (Mastered)',
        2: '勉强通过 (Hard)',
        1: '概念有误 (Mistake)',
        0: '完全失分 (Failed)'
      }
      return map[grade] || '未定级'
    },
    getGradeTagType(grade) {
      if (grade >= 3) return 'success'
      if (grade === 2) return 'primary'
      if (grade === 1) return 'warning'
      return 'danger'
    },
    getScoreColor(score) {
      if (score >= 80) return '#67c23a'
      if (score >= 60) return '#e6a23c'
      return '#f56c6c'
    }
  }
}
</script>

<style lang="less" scoped>
.dialogBody {
  min-height: 380px;

  .topControlBar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f8f9fa;
    padding: 8px 12px;
    border-radius: 6px;
    margin-bottom: 14px;

    .targetNodeBanner {
      display: flex;
      align-items: center;
      font-size: 13px;

      .targetIcon {
        margin-right: 4px;
      }
      .targetLabel {
        color: #606266;
      }
      .targetName {
        color: #409eff;
      }
    }

    .topActions {
      display: flex;
      gap: 8px;
    }
  }

  .examStepsBar {
    margin-bottom: 16px;
    padding: 6px 0;
  }

  .quizMainArea {
    .questionCard {
      background: #ecf5ff;
      border: 1px solid #b3d8ff;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;

      .nodeBadge {
        margin-bottom: 10px;
      }

      .questionContent {
        font-size: 15px;
        font-weight: bold;
        color: #303133;
        line-height: 1.6;
      }
    }

    .answerArea {
      .modeToggle {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;

        .subTitle {
          font-size: 14px;
          font-weight: bold;
          color: #303133;
        }
      }

      .textInputBox {
        margin-bottom: 12px;
      }

      .submitRow {
        display: flex;
        justify-content: flex-end;
      }

      .handwritingBox {
        border: 1px solid #ebeef5;
        border-radius: 6px;
        padding: 8px;
        margin-bottom: 12px;
      }
    }

    .judgeFeedbackBox {
      margin-top: 16px;
      padding: 14px;
      border-radius: 6px;
      background: #fdf6ec;
      border: 1px solid #faecd8;

      &.grade-3 {
        background: #f0f9eb;
        border-color: #e1f3d8;
      }

      &.grade-0, &.grade-1 {
        background: #fef0f0;
        border-color: #fde2e2;
      }

      .judgeHeader {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;

        .gradeScore {
          font-size: 14px;
          font-weight: bold;
          color: #e6a23c;
        }
      }

      .critiqueText {
        font-size: 13px;
        color: #606266;
        line-height: 1.6;
        margin-bottom: 10px;
      }

      .nextStepRow {
        display: flex;
        justify-content: flex-end;
      }
    }
  }

  .finalReportArea {
    .reportHeader {
      display: flex;
      align-items: center;
      background: #f0f9eb;
      border: 1px solid #c2e7b0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;

      .totalScoreBadge {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100px;
        height: 70px;
        background: #fff;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        margin-right: 16px;

        .label {
          font-size: 11px;
          color: #909399;
        }
        .val {
          font-size: 26px;
          font-weight: bold;
        }
      }

      .reportTitleBox {
        h3 {
          margin: 0 0 6px 0;
          color: #67c23a;
          font-size: 16px;
        }
        p {
          margin: 0;
          font-size: 13px;
          color: #606266;
        }
      }
    }

    .stageHistoryList {
      margin-bottom: 20px;

      .historyCard {
        background: #fff;
        border: 1px solid #ebeef5;
        border-radius: 6px;
        padding: 10px 14px;
        margin-bottom: 8px;

        .cardTop {
          display: flex;
          align-items: center;
          margin-bottom: 6px;

          .stageTag {
            font-size: 12px;
            font-weight: bold;
            color: #409eff;
            margin-right: 8px;
          }
          .targetPoint {
            font-size: 13px;
            color: #303133;
            flex: 1;
          }
        }

        .historyCritique {
          font-size: 12px;
          color: #606266;
          line-height: 1.5;
        }
      }
    }

    .syncReviewBox {
      display: flex;
      justify-content: center;
      gap: 12px;
    }
  }
}
</style>
