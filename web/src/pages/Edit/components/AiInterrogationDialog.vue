<template>
  <el-dialog
    title="🧠 AI 苏格拉底式自动深度拷问系统"
    :visible.sync="visible"
    width="680px"
    :append-to-body="true"
    custom-class="aiInterrogationDialog"
  >
    <div class="dialogBody" v-loading="loading" :element-loading-text="loadingText">
      <!-- 考题设置与出题栏 -->
      <div class="quizControlBar">
        <div class="typeSelect">
          <span class="label">考查类型：</span>
          <el-radio-group v-model="questionType" size="mini">
            <el-radio-button label="all">综合考查</el-radio-button>
            <el-radio-button label="essence">溯源本质</el-radio-button>
            <el-radio-button label="derivation">逻辑推导</el-radio-button>
            <el-radio-button label="counterexample">边界反例</el-radio-button>
          </el-radio-group>
        </div>
        <el-button
          type="primary"
          size="small"
          icon="el-icon-refresh"
          @click="generateNewQuestion"
          :disabled="loading"
        >
          换一道题
        </el-button>
      </div>

      <!-- 当前考题卡片 -->
      <div v-if="currentQuiz" class="questionCard">
        <div class="nodeBadge">
          <el-tag size="small" type="primary">📌 考查节点：{{ currentQuiz.target_node_text || '核心概念' }}</el-tag>
          <el-tag size="small" type="warning" style="margin-left: 8px;">
            {{ getTypeName(currentQuiz.question_type) }}
          </el-tag>
        </div>
        <div class="questionContent">
          {{ currentQuiz.question }}
        </div>
      </div>

      <!-- 学生作答区 -->
      <div class="answerArea" v-if="currentQuiz">
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
            placeholder="请在此输入您的推导过程、条件论证或反例辨析..."
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

        <div class="submitRow" v-if="answerMode === 'text'">
          <el-button type="success" size="medium" icon="el-icon-check" @click="submitTextAnswer" :disabled="!userAnswerText.trim() || judging">
            {{ judging ? '考官审判中...' : '提交答案 · 接受审判' }}
          </el-button>
        </div>
      </div>

      <!-- 审判反馈结果 -->
      <div v-if="judgeResult" class="judgeFeedbackBox" :class="'grade-' + judgeResult.grade">
        <div class="judgeHeader">
          <el-tag size="medium" :type="getGradeTagType(judgeResult.grade)">
            评分等级：{{ getGradeLabel(judgeResult.grade) }}
          </el-tag>
        </div>
        <div class="critiqueText">
          <strong>【考官审判】</strong>：{{ judgeResult.interrogation_critique }}
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script>
import { generateSocraticQuiz } from '@/review/mindMapAuditor'
import { getJudgeAiConfig } from '@/review/handwritingJudge'
import ReviewHandwritingBoard from './ReviewHandwritingBoard.vue'

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
      questionType: 'all',
      currentQuiz: null,
      answerMode: 'text',
      userAnswerText: '',
      judgeResult: null
    }
  },
  created() {
    this.$bus.$on('showAiInterrogation', () => {
      this.show()
    })
  },
  beforeDestroy() {
    this.$bus.$off('showAiInterrogation')
  },
  computed: {
    currentHandwritingCard() {
      if (!this.currentQuiz) return null
      return {
        id: this.currentQuiz.target_node_id || 'quiz_1',
        prompt: this.currentQuiz.question,
        standard_answer: this.currentQuiz.evaluation_criteria || '逻辑自洽且包含完整物理/学科条件'
      }
    }
  },
  methods: {
    show() {
      this.visible = true
      if (!this.currentQuiz) {
        this.generateNewQuestion()
      }
    },
    async generateNewQuestion() {
      if (!this.mindMap) {
        this.$message.warning('思维导图未就绪')
        return
      }
      const rootData = this.mindMap.getData(false)
      if (!rootData || !rootData.root) {
        this.$message.warning('导图内容为空')
        return
      }

      this.loading = true
      this.judgeResult = null
      this.userAnswerText = ''
      try {
        const quiz = await generateSocraticQuiz(rootData.root, {
          questionType: this.questionType
        })
        if (!quiz || !quiz.question) {
          throw new Error('考题生成格式异常')
        }
        this.currentQuiz = quiz
      } catch (err) {
        this.$message.error(err.message || '出题失败，请检查 API 配置')
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
考查问题：${this.currentQuiz.question}
考查要点：${this.currentQuiz.evaluation_criteria || '逻辑自洽'}
学生作答：${this.userAnswerText.trim()}

请以严苛高考/学术阅卷组长口吻对学生作答进行审判打分（强制输出 JSON）：
{
  "grade": 3 | 2 | 1 | 0, // 3: 完全正确推导清晰; 2: 答对但略有犹豫或瑕疵; 1: 存在概念混淆或前提缺失; 0: 答非所问或完全错误
  "interrogation_critique": "冷峻、一针见血地指出其推导的核心缺陷或闪光点"
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
        this.judgeResult = JSON.parse(content)
      } catch (e) {
        this.$message.error(e.message || '审判失败')
      } finally {
        this.judging = false
      }
    },
    onHandwritingJudgeCompleted(res) {
      this.judgeResult = res
    },
    getTypeName(type) {
      const map = {
        essence: '溯源本质题',
        derivation: '逻辑推导题',
        counterexample: '边界反例题'
      }
      return map[type] || '综合思辨题'
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
    }
  }
}
</script>

<style lang="less" scoped>
.dialogBody {
  min-height: 280px;

  .quizControlBar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f8f9fa;
    padding: 10px 14px;
    border-radius: 6px;
    margin-bottom: 16px;

    .typeSelect {
      display: flex;
      align-items: center;
      .label {
        font-size: 13px;
        color: #606266;
        margin-right: 8px;
      }
    }
  }

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
      margin-bottom: 8px;
    }

    .critiqueText {
      font-size: 13px;
      color: #606266;
      line-height: 1.6;
    }
  }
}
</style>
