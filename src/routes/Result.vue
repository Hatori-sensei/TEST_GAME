<template>
  <div class="result-page">
    <div class="rs-bg" :style="bgStyle"></div>
    <div class="rs-lines"></div>
    <div class="rs-shade"></div>

    <header class="rs-top">
      <span class="slashes">///</span>
      <span>RESULT</span>
    </header>

    <div class="rs-layout" v-if="sheet && result">
      <section class="rs-left">
        <div class="rs-jacket-frame">
          <div class="rs-jacket">
            <img v-if="cover" :src="cover" class="rs-art" />
            <div v-else class="rs-art rs-art-empty"></div>
          </div>
        </div>

        <div class="rs-title-block">
          <h1 class="rs-title">{{ sheet.song.title }}</h1>
          <p class="rs-artist">{{ sheet.song.artist }}</p>
        </div>

        <div class="rs-chips" v-if="chips.length">
          <span class="rs-chip" v-for="chip in chips" :key="chip.label">
            <small>{{ chip.label }}</small>{{ chip.value }}
          </span>
        </div>
      </section>

      <section class="rs-right">
        <div class="rs-main">
          <div class="rs-rank" :style="{ color: rankColor, textShadow: rankGlow }">
            {{ result.rank }}
          </div>
          <div class="rs-figures">
            <div class="rs-figure">
              <span class="rs-figure-label">ACCURACY</span>
              <span class="rs-figure-value acc">
                <ICountUp
                  :endVal="result.result.percentage"
                  :options="{ decimalPlaces: 2 }"
                />%
              </span>
            </div>
            <div class="rs-figure">
              <span class="rs-figure-label">
                SCORE
                <span class="rs-tag rs-tag-record" v-if="newRecord">NEW RECORD</span>
              </span>
              <span class="rs-figure-value score">
                <ICountUp
                  :endVal="result.result.score"
                  :options="{ decimalPlaces: 0 }"
                />
              </span>
            </div>
            <div class="rs-figure">
              <span class="rs-figure-label">
                MAX COMBO
                <span class="rs-tag rs-tag-combo" v-if="result.isFullCombo">FULL COMBO</span>
              </span>
              <span class="rs-figure-value combo">
                <ICountUp
                  :endVal="result.result.maxCombo"
                  :options="{ decimalPlaces: 0 }"
                />
              </span>
            </div>
          </div>
        </div>

        <div class="rs-judges">
          <div class="rs-judge-col">
            <div class="rs-judge-head">SUMMARY</div>
            <div
              class="rs-row"
              :class="entry.className"
              v-for="entry in summaryJudgeEntries"
              :key="entry.label"
            >
              <span class="rs-row-label">{{ entry.label }}</span>
              <ICountUp :endVal="entry.value" :options="{ decimalPlaces: 0 }" />
            </div>
            <!-- [UI] 타이밍 분석: IIDX의 FAST/SLOW 개수 + osu!의 평균 오차(ms) 참고 -->
            <div class="rs-timing" v-if="timingInfo">
              <div class="rs-judge-head">TIMING</div>
              <div class="rs-row small">
                <span class="rs-row-label fs-fast">FAST</span>
                <span>{{ timingInfo.fast }}</span>
              </div>
              <div class="rs-row small">
                <span class="rs-row-label fs-slow">SLOW</span>
                <span>{{ timingInfo.slow }}</span>
              </div>
              <div class="rs-row small">
                <span class="rs-row-label">AVG</span>
                <span>{{ timingInfo.avgText }}</span>
              </div>
              <div class="rs-timing-hint" v-if="timingInfo.hint">{{ timingInfo.hint }}</div>
            </div>
          </div>
          <div class="rs-judge-col rs-judge-detail">
            <div class="rs-judge-head">DETAILED</div>
            <div
              class="rs-row small"
              :class="entry.className"
              v-for="entry in detailedJudgeEntries"
              :key="entry.label"
            >
              <span class="rs-row-label">{{ entry.label }}</span>
              <ICountUp :endVal="entry.value" :options="{ decimalPlaces: 0 }" />
            </div>
          </div>
        </div>

        <div class="btn_sec">
          <div class="btn-action btn-dark rs-btn rs-btn-main" @click="replay">
            <v-icon name="redo" />
            <span>Replay</span>
          </div>
          <div class="btn-action btn-dark rs-btn" @click="toMenu">
            <v-icon name="arrow-right" />
            <span>Continue</span>
          </div>
        </div>
      </section>
    </div>

    <Loading :show="!sheet || !result">Syncing Results...</Loading>

    <!-- level up modal -->
    <Modal
      ref="levelModal"
      :showCancel="false"
      style="text-align: center; z-index: 500;"
      @ok="$confetti.stop()"
    >
      <template v-slot:header>
        <div style="width: 100%; font-size: 23px;">Level Up!</div>
      </template>

      <template>
        <div style="opacity: 0.5;">
          Congratulations, you have now leveled up.
        </div>
        <div class="flex_hori flex_row">
          <div class="level" v-if="oldProfileInfo">
            {{ oldProfileInfo.lvd }}
          </div>
          <v-icon name="arrow-right" scale="2" />
          <div class="level">
            {{ $store.state.userProfile && $store.state.userProfile.lvd }}
          </div>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script>
import Loading from "../components/ui/Loading.vue";
import Modal from "../components/ui/Modal.vue";
import {
  getGameSheet,
  getResult,
  getBestScore,
  getUserProfile,
} from "../javascript/db";
import ICountUp from "vue-countup-v2";

export default {
  name: "Result",
  components: {
    ICountUp,
    Loading,
    Modal,
  },
  data() {
    return {
      showModal: false,
      result: null,
      sheet: null,
      windowWidth: window.innerWidth,
      newRecord: false,
      oldProfileInfo: null,
      overrideProfile: null,
    };
  },
  computed: {
    summaryJudgeEntries() {
      const summary = this.result?.result?.judgeSummary || {};
      return [
        {
          label: "MAX 100%",
          value: Number(summary.max100 || 0),
          className: "perfect",
        },
        {
          label: "MAX 1%~90%",
          value: Number(summary.max1To90 || 0),
          className: "good",
        },
        {
          label: "BREAK",
          value: Number(summary.break || 0),
          className: "miss",
        },
      ];
    },
    detailedJudgeEntries() {
      const details = this.result?.result?.judgeDetails || {};
      const orderedLabels = [
        "MAX 100%",
        "MAX 90%",
        "MAX 80%",
        "MAX 70%",
        "MAX 60%",
        "MAX 50%",
        "MAX 40%",
        "MAX 30%",
        "MAX 20%",
        "MAX 10%",
        "MAX 1%",
        "BREAK",
      ];
      return orderedLabels.map((label) => ({
        label,
        value: Number(details[label] || 0),
        className:
          label === "MAX 100%"
            ? "perfect"
            : label === "BREAK"
            ? "miss"
            : label === "MAX 1%"
            ? "offbeat"
            : "good",
      }));
    },
    // [UI] 타이밍 통계(기록이 없는 예전 결과면 표시 안 함)
    timingInfo() {
      const t = this.result?.result?.timing;
      if (!t || !t.count) return null;
      const avg = Math.round(t.sumMs / t.count);
      const avgText = `${avg > 0 ? "+" : ""}${avg}ms`;
      let hint = "";
      // 평균이 한쪽으로 15ms 이상 치우치면 오프셋 조정 안내(설정 > 오디오 오프셋)
      if (avg >= 15) hint = `늦게 치는 편 → 오디오 오프셋 +${avg}ms 정도 권장`;
      else if (avg <= -15) hint = `빠르게 치는 편 → 오디오 오프셋 ${avg}ms 정도 권장`;
      return { fast: t.fast, slow: t.slow, avgText, hint };
    },
    // song info lives in chart.song
    cover() {
      return (this.sheet && this.sheet.song && this.sheet.song.customCoverUrl) || "";
    },
    bgStyle() {
      return this.cover ? { backgroundImage: `url(${this.cover})` } : {};
    },
    chips() {
      const s = this.sheet;
      if (!s) return [];
      const out = [];
      const keys = String(Array.isArray(s.keys) ? s.keys[0] : s.keys ?? "").replace(/\D/g, "");
      if (keys) out.push({ label: "MODE", value: `${keys}B` });
      if (s.difficulty) out.push({ label: "LV", value: s.difficulty });
      if (s.song && s.song.bpm) out.push({ label: "BPM", value: s.song.bpm });
      return out;
    },
    rankColor() {
      const colors = {
        S: "#ffb400",
        A: "#19d3ff",
        B: "#7ee8b0",
        C: "#c4f5ff",
        D: "#ff7a2f",
        F: "#ff3b5c",
      };
      return colors[this.result && this.result.rank] || "#ffffff";
    },
    rankGlow() {
      return `0 0 40px ${this.rankColor}66`;
    },
  },
  watch: {},
  async mounted() {
    //FIXME add id and route validation
    if (this.$route.params.resultId && this.$route.params.resultId != "null") {
      try {
        this.result = await getResult(this.$route.params.resultId);
        this.sheet = await getGameSheet(this.result.sheetId);
        const bestResult = await getBestScore(this.result.sheetId);
        if (bestResult && bestResult.result.score <= this.result.result.score) {
          this.newRecord = true;
        }
      } catch (err) {
        this.showError();
      }
    } else {
      this.showError();
    }

    window.onresize = () => {
      this.windowWidth = window.innerWidth;
    };

    if (this.result.uid !== this.$store.state.currentUser.uid) {
      this.overrideProfile = await getUserProfile(this.result.uid);
      if (this.overrideProfile.isAnonymous) this.overrideProfile = null;
    } else {
      // update local user level info
      const userProfile = this.$store.state.userProfile;
      const { lvd, exp, lv } = userProfile;
      this.oldProfileInfo = { lvd, exp, lv };

      await this.$store.dispatch("updateUserProfile");

      Logger.log(userProfile, this.oldProfileInfo);

      if (this.$store.state.userProfile.lvd > lvd) {
        Logger.warn("level up", lvd, userProfile.lvd);
        this.$refs.levelModal.show();
        this.$confetti.start();
      }
    }
  },
  beforeDestroy() {
    this.$store.state.audio.stop();
  },
  methods: {
    showError() {
      this.$store.state.gModal.show({
        bodyText: "This result is unavaliable.",
        isError: true,
        showCancel: false,
        okCallback: this.toMenu,
      });
    },
    replay() {
      this.$router.push("/game/" + this.sheet.sheetId);
    },
    toMenu() {
      this.$router.push("/menu/");
    },
  },
};
</script>

<style scoped>
.result-page {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: var(--dm-bg);
  color: var(--dm-text);
  font-family: var(--dm-font-body);
}

.rs-bg {
  position: absolute;
  top: -8%;
  left: -8%;
  width: 116%;
  height: 116%;
  background-size: cover;
  background-position: center;
  filter: blur(30px) brightness(0.26) saturate(0.85);
}

.rs-lines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    115deg,
    rgba(var(--dm-cyan-rgb), 0.05) 0,
    rgba(var(--dm-cyan-rgb), 0.05) 1px,
    transparent 1px,
    transparent 16px
  );
}

.rs-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(4, 6, 12, 0.9), rgba(4, 6, 12, 0.4) 55%, rgba(4, 6, 12, 0.85));
}

/* ---------- top bar ---------- */
.rs-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 48px;
  border-bottom: 1px solid var(--dm-cyan-dim);
  background: linear-gradient(180deg, rgba(4, 6, 12, 0.9), rgba(4, 6, 12, 0.4));
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: 26px;
  letter-spacing: 0.08em;
}

.rs-top .slashes {
  color: var(--dm-cyan);
  letter-spacing: -0.05em;
}

/* ---------- layout ---------- */
.rs-layout {
  position: relative;
  z-index: 1;
  display: flex;
  height: 100%;
  padding: 96px 56px 40px;
  gap: 64px;
  box-sizing: border-box;
}

.rs-left {
  flex: 0 0 min(34%, 480px);
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.rs-right {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 30px;
}

/* ---------- jacket / title ---------- */
.rs-jacket-frame {
  width: min(100%, 38vh);
  aspect-ratio: 1 / 1;
  padding: 2px;
  background: linear-gradient(135deg, var(--dm-cyan) 0%, rgba(var(--dm-cyan-rgb), 0.15) 45%, var(--dm-cyan) 100%);
  clip-path: polygon(0 0, calc(100% - 30px) 0, 100% 30px, 100% 100%, 30px 100%, 0 calc(100% - 30px));
}

.rs-jacket {
  width: 100%;
  height: 100%;
  background: #000;
  clip-path: polygon(0 0, calc(100% - 29px) 0, 100% 29px, 100% 100%, 29px 100%, 0 calc(100% - 29px));
}

.rs-art {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.rs-art-empty {
  background: linear-gradient(135deg, #0b1a2c, #04060c);
}

.rs-title-block {
  border-left: 5px solid var(--dm-cyan);
  padding-left: 16px;
}

.rs-title {
  margin: 0;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: clamp(34px, 5.4vh, 58px);
  line-height: 0.98;
  text-transform: uppercase;
  overflow-wrap: anywhere;
}

.rs-artist {
  margin: 8px 0 0;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 600;
  font-size: 22px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--dm-cyan);
}

.rs-chips {
  display: flex;
  gap: 10px;
}

.rs-chip {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 4px 18px 4px 14px;
  background: rgba(8, 16, 30, 0.85);
  border-left: 3px solid var(--dm-cyan);
  clip-path: polygon(0 0, 100% 0, calc(100% - 9px) 100%, 0 100%);
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: 26px;
}

.rs-chip small {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.22em;
  color: var(--dm-muted);
}

/* ---------- rank + figures ---------- */
.rs-main {
  display: flex;
  align-items: center;
  gap: 48px;
  padding-bottom: 26px;
  border-bottom: 1px solid var(--dm-cyan-dim);
}

.rs-rank {
  flex: 0 0 auto;
  min-width: 190px;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: clamp(150px, 27vh, 260px);
  line-height: 0.85;
  text-align: center;
}

.rs-figures {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rs-figure {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 20px;
  padding: 2px 0 2px 18px;
  border-left: 4px solid var(--dm-cyan);
  background: linear-gradient(90deg, rgba(8, 16, 30, 0.85), transparent);
}

.rs-figure-label {
  display: flex;
  align-items: center;
  gap: 14px;
  font-family: var(--dm-font-display);
  font-weight: 700;
  font-size: 17px;
  letter-spacing: 0.26em;
  color: var(--dm-muted);
}

.rs-figure-value {
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  line-height: 1;
  color: #ffffff;
}

.rs-figure-value.score {
  font-size: 64px;
}

.rs-figure-value.acc {
  font-size: 44px;
  color: var(--dm-cyan);
}

.rs-figure-value.combo {
  font-size: 44px;
}

.rs-tag {
  padding: 2px 12px;
  font-size: 14px;
  letter-spacing: 0.16em;
  color: #04121c;
  clip-path: polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%);
}

.rs-tag-record {
  background: var(--dm-amber);
}

.rs-tag-combo {
  background: var(--dm-cyan);
}

/* ---------- judgement tables ---------- */
.rs-judges {
  display: flex;
  gap: 48px;
  min-height: 0;
}

.rs-judge-col {
  flex: 0 0 300px;
}

.rs-judge-detail {
  flex: 1;
  max-width: 520px;
}

.rs-judge-head {
  margin-bottom: 8px;
  font-family: var(--dm-font-display);
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.3em;
  color: var(--dm-muted);
}

.rs-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 6px;
  padding: 4px 14px 4px 14px;
  background: rgba(8, 16, 30, 0.8);
  border-left: 4px solid var(--dm-cyan);
  clip-path: polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 700;
  font-size: 24px;
}

/* [UI] 타이밍 분석 카드 */
.rs-timing {
  margin-top: 14px;
}
.rs-row-label.fs-fast {
  color: #19d3ff;
}
.rs-row-label.fs-slow {
  color: #ff5a7a;
}
.rs-timing-hint {
  margin-top: 4px;
  font-size: 13px;
  color: var(--dm-muted);
  word-break: keep-all;
}

.rs-row.small {
  font-size: 17px;
  line-height: 1.15;
  padding: 1px 14px;
  margin-bottom: 3px;
}

.rs-row-label {
  letter-spacing: 0.08em;
  color: var(--dm-muted);
}

.rs-row.perfect {
  border-left-color: #ffffff;
}

.rs-row.good {
  border-left-color: var(--dm-cyan);
}

.rs-row.offbeat {
  border-left-color: var(--dm-amber);
}

.rs-row.miss {
  border-left-color: var(--dm-red);
}

.rs-row.perfect .rs-row-label {
  color: #ffffff;
}

/* ---------- buttons ---------- */
.btn_sec {
  position: absolute;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 16px;
}

.rs-btn {
  min-width: 200px;
  margin: 0;
  font-size: 1.4em;
}

.rs-btn-main {
  color: #04121c;
  background: var(--dm-cyan);
}

.rs-btn-main .fa-icon {
  color: #04121c;
}

.level {
  font-size: 5em;
}

.flex_row {
  flex-direction: row;
  padding: 30px 0;
}
</style>
