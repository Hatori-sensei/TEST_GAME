<template>
  <!-- [모드] 타이틀 다음 화면: Free Play / Arcade / VS Match. 어느 모드든 한 사람 최대 3곡(판).
       테마가 아직 정해지지 않아서 색은 --dm-* 변수만 쓴다(테마별 CSS 없음). -->
  <div class="mode-page">
    <header class="ms-top">
      <span class="slashes">///</span>
      <span>MODE SELECT</span>
      <div class="ms-hint">
        <span><kbd>&larr;</kbd><kbd>&rarr;</kbd> 선택</span>
        <span><kbd>ENTER</kbd> 시작</span>
        <span><kbd>R</kbd> 랭킹</span>
        <span><kbd>ESC</kbd> 타이틀</span>
      </div>
    </header>

    <div class="ms-cards">
      <div
        v-for="(m, i) in modes"
        :key="m.id"
        class="ms-card"
        :class="{ active: i === index, disabled: m.disabled }"
        @click="choose(i)"
        @mouseenter="index = i"
      >
        <div class="ms-no">{{ i + 1 }}</div>
        <div class="ms-title">{{ m.title }}</div>
        <div class="ms-desc">{{ m.desc }}</div>
        <ul class="ms-rules">
          <li v-for="r in m.rules" :key="r">{{ r }}</li>
        </ul>
        <div class="ms-off" v-if="m.disabled">{{ m.disabledText }}</div>
      </div>
    </div>

    <!-- [외부 곡 폴더] 운영자 확인용: PC마다 곡 목록 코드가 같아야 함 -->
    <footer class="ms-foot">
      <span v-if="catalogStatus.loaded">곡 폴더: 외부 {{ catalogStatus.external }}곡</span>
      <span v-else>곡 폴더 없음(내장 곡)</span>
      <span>곡 목록 코드 <b>{{ catalogStatus.hash || "-" }}</b></span>
      <span class="ms-warn" v-if="catalogProblem">{{ catalogProblem }}</span>
    </footer>
  </div>
</template>

<script>
import { startSession, clearSession, MODES } from "../helpers/session";
import { isLanActive } from "../helpers/lan";
import { catalogStatus } from "../javascript/localCatalog";

export default {
  name: "ModeSelect",
  data() {
    return { index: 0, catalogStatus, lan: isLanActive() };
  },
  computed: {
    modes() {
      return [
        {
          id: MODES.free,
          title: "FREE PLAY",
          desc: "원하는 곡을 골라서 자유롭게",
          rules: ["최대 3곡", "랭킹 등록 없음"],
        },
        {
          id: MODES.arcade,
          title: "ARCADE",
          desc: "이름을 적고 3곡을 미리 골라 도전",
          rules: ["3곡 순서대로", "난이도 가산점으로 최종 점수", "랭킹 등록", "조건을 만족하면 히든곡"],
        },
        {
          id: MODES.vs,
          title: "VS MATCH",
          desc: "다른 PC와 같은 곡으로 대결",
          rules: ["최대 3판", "LAN 연결 필요"],
          disabled: !this.lan,
          disabledText: "LAN이 꺼져 있어요 (곡 선택 ESC → LAN 설정)",
        },
      ];
    },
    catalogProblem() {
      const s = this.catalogStatus;
      if (s.error) return s.error;
      const req = s.missing.filter((m) => m.required).length;
      if (req) return `없는 파일 ${req}개(설정에서 확인)`;
      return "";
    },
  },
  mounted() {
    clearSession(); // 모드 선택으로 오면 새 크레딧
    window.addEventListener("keydown", this.onKey);
  },
  beforeDestroy() {
    window.removeEventListener("keydown", this.onKey);
  },
  methods: {
    choose(i) {
      const m = this.modes[i];
      if (!m) return;
      this.index = i;
      if (m.disabled) {
        this.$store.state.audio.playEffect("error");
        return;
      }
      this.$store.state.audio.playEffect("ui/slide2");
      if (m.id === MODES.arcade) {
        this.$router.push("/arcade-entry"); // 세션은 이름 입력 후 시작
        return;
      }
      startSession(m.id);
      this.$router.push(m.id === MODES.vs ? "/vs" : "/menu");
    },
    onKey(e) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        this.index = (this.index + 1) % this.modes.length;
        this.$store.state.audio.playHoverEffect("ui/ta");
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        this.index = (this.index - 1 + this.modes.length) % this.modes.length;
        this.$store.state.audio.playHoverEffect("ui/ta");
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.choose(this.index);
      } else if (["1", "2", "3"].includes(e.key)) {
        this.choose(Number(e.key) - 1);
      } else if ((e.key === "r" || e.key === "R") && !e.repeat) {
        this.$router.push("/rankings");
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.$router.push("/");
      }
    },
  },
};
</script>

<style scoped>
.mode-page {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--dm-bg);
  color: var(--dm-text);
  font-family: var(--dm-font-body);
  overflow: hidden;
}
.ms-top {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 60px;
  padding: 0 48px;
  border-bottom: 1px solid var(--dm-cyan-dim);
  font-family: var(--dm-font-display);
  font-weight: 800;
  font-size: 26px;
  letter-spacing: 0.1em;
}
.ms-top .slashes {
  color: var(--dm-cyan);
}
.ms-hint {
  margin-left: auto;
  display: flex;
  gap: 24px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--dm-muted);
}
.ms-hint kbd {
  padding: 1px 7px;
  margin-right: 5px;
  border: 1px solid var(--dm-cyan-dim);
  color: var(--dm-cyan);
  font-family: inherit;
  font-size: 13px;
}
.ms-cards {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 36px;
  padding: 0 6vw;
}
.ms-card {
  position: relative;
  flex: 1;
  max-width: 400px;
  min-height: 52vh;
  padding: 34px 32px;
  box-sizing: border-box;
  cursor: pointer;
  background: var(--dm-panel);
  border: 1px solid var(--dm-cyan-dim);
  border-top: 6px solid var(--dm-cyan-dim);
  transition: transform 0.15s, border-color 0.15s;
}
.ms-card.active {
  transform: translateY(-14px);
  border-color: var(--dm-cyan);
  border-top-color: var(--dm-cyan);
}
.ms-card.disabled {
  opacity: 0.45;
}
.ms-no {
  font-family: var(--dm-font-display);
  font-weight: 800;
  font-size: 72px;
  line-height: 1;
  color: var(--dm-cyan);
}
.ms-title {
  margin-top: 10px;
  font-family: var(--dm-font-display);
  font-weight: 800;
  font-size: 46px;
  letter-spacing: 0.04em;
}
.ms-desc {
  margin-top: 10px;
  font-size: 18px;
  color: var(--dm-muted);
}
.ms-rules {
  margin: 26px 0 0;
  padding: 0;
  list-style: none;
}
.ms-rules li {
  padding: 8px 0;
  border-top: 1px solid var(--dm-cyan-faint);
  font-size: 17px;
}
.ms-rules li::before {
  content: "· ";
  color: var(--dm-cyan);
}
.ms-off {
  margin-top: 18px;
  font-size: 15px;
  color: var(--dm-red);
}
.ms-foot {
  display: flex;
  gap: 24px;
  padding: 14px 48px 18px;
  font-size: 14px;
  color: var(--dm-muted);
}
.ms-foot b {
  color: var(--dm-cyan);
  letter-spacing: 0.1em;
}
.ms-warn {
  color: var(--dm-red);
}
</style>
