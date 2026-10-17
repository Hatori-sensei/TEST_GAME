<template>
  <!-- [모드] Arcade 시작 전 이름/소속 입력. 끝나면 곡 고르기(/menu)로. 색은 --dm-* 변수만 사용 -->
  <div class="entry-page">
    <header class="ae-top">
      <span class="slashes">///</span>
      <span>ARCADE · ENTRY</span>
    </header>
    <div class="ae-center">
      <div class="ae-card">
        <h2>이름을 입력하세요</h2>
        <p class="ae-sub">3곡을 다 치면 최종 점수가 이 이름으로 랭킹에 올라가요.</p>
        <div class="ae-form">
          <input
            ref="name"
            v-model="name"
            :maxlength="nameMax"
            placeholder="이름"
            @keydown.enter.prevent="onEnter"
            @keydown.esc.prevent="back"
          />
          <input
            v-model="group"
            :maxlength="groupMax"
            placeholder="소속 (예: 2-3, 컴공)"
            @keydown.enter.prevent="onEnter"
            @keydown.esc.prevent="back"
          />
        </div>
        <p class="ae-hint">ENTER 시작 · ESC 뒤로 · 소속을 비우면 {{ guest }}</p>
        <p class="ae-error" v-if="error">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import { NAME_MAX, GROUP_MAX, GUEST_GROUP, loadLastPlayer, saveLastPlayer } from "../helpers/records";
import { startSession, MODES } from "../helpers/session";

export default {
  name: "ArcadeEntry",
  data() {
    const last = loadLastPlayer();
    return { name: last.name, group: last.group, nameMax: NAME_MAX, groupMax: GROUP_MAX, guest: GUEST_GROUP, error: "" };
  },
  mounted() {
    this.$nextTick(() => this.$refs.name && this.$refs.name.focus());
  },
  methods: {
    // 한글 입력 조합 중의 Enter는 글자 확정용이라 무시(다음 Enter에 진행)
    onEnter(e) {
      if (e.isComposing || e.keyCode === 229) return;
      const name = this.name.trim();
      if (!name) {
        this.error = "이름을 입력해 주세요";
        this.$refs.name && this.$refs.name.focus();
        return;
      }
      const group = this.group.trim() || GUEST_GROUP;
      saveLastPlayer(name, group === GUEST_GROUP ? "" : group);
      startSession(MODES.arcade, { name, group });
      this.$store.state.audio.playEffect("ui/slide2");
      this.$router.push("/menu");
    },
    back() {
      this.$router.push("/mode");
    },
  },
};
</script>

<style scoped>
.entry-page {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--dm-bg);
  color: var(--dm-text);
  font-family: var(--dm-font-body);
}
.ae-top {
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
.ae-top .slashes {
  color: var(--dm-cyan);
}
.ae-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ae-card {
  width: min(640px, 90vw);
  padding: 36px 40px;
  box-sizing: border-box;
  background: var(--dm-panel);
  border: 1px solid var(--dm-cyan-dim);
  border-top: 6px solid var(--dm-cyan);
}
.ae-card h2 {
  margin: 0;
  font-family: var(--dm-font-display);
  font-weight: 800;
  font-size: 34px;
}
.ae-sub,
.ae-hint {
  color: var(--dm-muted);
  font-size: 15px;
}
.ae-form {
  display: flex;
  gap: 12px;
  margin: 22px 0 6px;
}
.ae-form input {
  flex: 1;
  min-width: 0;
  padding: 12px 14px;
  color: var(--dm-text);
  background: var(--dm-bg);
  border: 1px solid var(--dm-cyan-dim);
  font-family: var(--dm-font-body);
  font-size: 22px;
  outline: none;
}
.ae-form input:focus {
  border-color: var(--dm-cyan);
}
.ae-error {
  color: var(--dm-red);
}
</style>
