<template>
  <!-- [LAN 대전] 로비: 입장 → 곡 선택(방장) → 준비 → 시작 → (게임) → 대전 결과 -->
  <div class="vs-page">
    <div class="vs-lines"></div>
    <header class="vs-top">
      <span class="slashes">///</span>
      <span>VS BATTLE</span>
      <span class="vs-host" v-if="hostName">{{ hostName }}</span>
      <div class="vs-hint">
        <template v-if="stage === 'room' && !showResult">
          <span v-if="isLeader"><kbd>&larr;</kbd><kbd>&rarr;</kbd> 곡</span>
          <span v-if="isLeader"><kbd>ENTER</kbd> 시작</span>
          <span v-else><kbd>ENTER</kbd> 준비</span>
        </template>
        <span><kbd>ESC</kbd> 나가기</span>
      </div>
    </header>

    <!-- LAN 미설정 -->
    <div class="vs-center" v-if="stage === 'off'">
      <div class="vs-card">
        <h2>LAN 연결이 필요해요</h2>
        <p>곡 선택 화면에서 <b>ESC → LAN</b> 설정의 역할을 "호스트" 또는 "참가"로 바꾸고 Apply를 누르세요.</p>
        <p class="muted">대전은 같은 공유기(같은 네트워크)에 연결된 PC끼리, 최대 4명까지 할 수 있어요.</p>
      </div>
    </div>

    <!-- 대전 후 호스트 연결이 끊긴 경우: 내 결과만이라도 볼 수 있게 -->
    <div class="vs-center" v-else-if="stage === 'lost'">
      <div class="vs-card">
        <h2>호스트 연결이 끊겼어요</h2>
        <p>대전 결과는 볼 수 없지만, 내 결과와 랭킹 등록은 할 수 있어요.</p>
        <p class="muted"><kbd>R</kbd> 내 결과 · 랭킹 등록 &nbsp; <kbd>ESC</kbd> 나가기</p>
      </div>
    </div>

    <!-- 입장 -->
    <div class="vs-center" v-else-if="stage === 'join'">
      <div class="vs-card">
        <h2>대전 입장</h2>
        <div class="vs-form">
          <input ref="joinName" v-model="joinForm.name" :maxlength="nameMax" placeholder="이름" @keydown.enter.prevent="onJoinEnter" />
          <input v-model="joinForm.group" :maxlength="groupMax" placeholder="소속" @keydown.enter.prevent="onJoinEnter" />
        </div>
        <p class="muted">ENTER 입장 · ESC 나가기</p>
        <p class="vs-error" v-if="error">{{ error }}</p>
      </div>
    </div>

    <!-- 방 -->
    <div class="vs-layout" v-else-if="stage === 'room' && room">
      <section class="vs-songs" v-if="!showResult">
        <div class="vs-section-head">SONG {{ isLeader ? "" : "· 방장이 선택" }}</div>
        <div
          v-for="c in charts"
          :key="c.id"
          class="vs-song"
          :class="{ active: c.id === displaySheetId, locked: !isLeader }"
          @click="isLeader && pickSong(c.id)"
        >
          <span class="vs-song-title">{{ c.title }}</span>
          <span class="vs-song-lv">LV {{ c.difficulty }}</span>
        </div>
      </section>

      <section class="vs-result" v-else>
        <div class="vs-section-head">RESULT · {{ currentTitle }}</div>
        <div v-for="(p, i) in resultList" :key="p.pcId" class="vs-res-row" :class="{ win: i === 0 && p.final, me: p.pcId === pcId }">
          <span class="vs-res-pos">{{ p.final ? i + 1 : "-" }}</span>
          <span class="vs-res-name">{{ p.name }}<small v-if="p.group"> {{ p.group }}</small></span>
          <span class="vs-res-win" v-if="i === 0 && p.final && resultList.length > 1">WIN</span>
          <span class="vs-res-acc" v-if="p.final">{{ p.final.accuracy.toFixed(2) }}%</span>
          <span class="vs-res-fc" v-if="p.final && p.final.isFullCombo">FC</span>
          <span class="vs-res-score">{{ p.final ? p.final.score.toLocaleString() : p.offline ? "OFFLINE" : "PLAYING..." }}</span>
        </div>
        <div class="vs-result-actions">
          <span v-if="myResultId"><kbd>R</kbd> 내 결과 · 랭킹 등록</span>
          <span v-if="isLeader && room.phase === 'result'"><kbd>ENTER</kbd> 로비로</span>
          <span v-else-if="room.phase === 'result'" class="muted">방장이 로비로 돌아가면 다시 할 수 있어요</span>
          <span v-else class="muted">다른 플레이어가 끝나길 기다리는 중...</span>
        </div>
      </section>

      <section class="vs-players">
        <div class="vs-section-head">PLAYERS {{ room.players.length }}/4</div>
        <div v-for="i in 4" :key="i" class="vs-slot" :class="slotClass(room.players[i - 1])">
          <template v-if="room.players[i - 1]">
            <span class="vs-slot-name">{{ room.players[i - 1].name }}</span>
            <span class="vs-slot-group">{{ room.players[i - 1].group }}</span>
            <span class="vs-badge leader" v-if="room.players[i - 1].pcId === room.leaderId">방장</span>
            <span class="vs-badge off" v-if="room.players[i - 1].offline">OFFLINE</span>
            <span class="vs-badge ready" v-else-if="room.players[i - 1].ready || room.players[i - 1].pcId === room.leaderId">READY</span>
            <span class="vs-badge wait" v-else>대기</span>
          </template>
          <span v-else class="vs-slot-empty">빈 자리</span>
        </div>
        <div class="vs-status">{{ statusText }}</div>
        <p class="vs-error" v-if="error">{{ error }}</p>
      </section>
    </div>

    <div class="vs-center" v-else-if="stage === 'room'">
      <div class="vs-card"><p class="muted">호스트에 연결 중...</p></div>
    </div>
  </div>
</template>

<script>
import { localCatalog, getSongById } from "../javascript/localCatalog";
import { isLanActive, getPcId, subscribeLan, measureClockOffset, pingHost } from "../helpers/lan";
import { vsJoin, vsLeave, vsPing, vsSelect, vsReady, vsStart, vsReset, vsRoom } from "../helpers/vs";
import { loadLastPlayer, saveLastPlayer, NAME_MAX, GROUP_MAX } from "../helpers/records";

const PING_MS = 3000;

export default {
  name: "VsLobby",
  data() {
    return {
      stage: "off",
      room: null,
      pcId: getPcId(),
      hostName: "",
      joinForm: { name: "", group: "" },
      nameMax: NAME_MAX,
      groupMax: GROUP_MAX,
      error: "",
      pickedSheetId: "",
      myResultId: this.$route.query.result || "",
      launching: false,
    };
  },
  computed: {
    charts() {
      return Object.values(localCatalog.charts).map((c) => {
        const song = getSongById(c.songId);
        return { id: c.id, title: (song && song.title) || c.title, difficulty: c.difficulty };
      });
    },
    me() {
      return this.room ? this.room.players.find((p) => p.pcId === this.pcId) : null;
    },
    isLeader() {
      return !!this.room && this.room.leaderId === this.pcId;
    },
    displaySheetId() {
      return (this.isLeader && this.pickedSheetId) || (this.room && this.room.sheetId) || "";
    },
    currentTitle() {
      const c = this.charts.find((x) => x.id === (this.room && this.room.sheetId));
      return c ? c.title : "";
    },
    // 결과 화면: 이 PC가 게임을 마치고 왔거나, 방이 결과 단계일 때
    showResult() {
      if (!this.room) return false;
      return this.room.phase === "result" || (!!this.myResultId && this.room.phase === "playing");
    },
    resultList() {
      if (!this.room) return [];
      return [...this.room.players].sort((a, b) => ((b.final && b.final.score) || -1) - ((a.final && a.final.score) || -1));
    },
    statusText() {
      if (!this.room) return "";
      const others = this.room.players.filter((p) => p.pcId !== this.room.leaderId);
      const notReady = others.filter((p) => !p.ready).length;
      if (this.room.phase === "lobby") {
        if (!this.room.sheetId) return this.isLeader ? "곡을 고르세요 (←/→)" : "방장이 곡을 고르는 중";
        if (notReady > 0) return this.isLeader ? `준비 안 된 사람 ${notReady}명` : this.me && this.me.ready ? "준비 완료! 방장이 시작하길 기다리는 중" : "ENTER를 눌러 준비";
        return this.isLeader ? "ENTER로 시작!" : "방장이 시작하길 기다리는 중";
      }
      if (this.room.phase === "loading") return "곡 불러오는 중...";
      if (this.room.phase === "countdown" || this.room.phase === "playing") return "대전 진행 중";
      return "";
    },
  },
  watch: {
    // 방장이 됐는데 곡이 안 골라져 있으면 첫 곡을 자동 선택
    room(r) {
      if (r && this.isLeader && r.phase === "lobby" && !r.sheetId && !this.pickedSheetId && this.charts.length) {
        this.pickSong(this.charts[0].id);
      }
    },
  },
  async mounted() {
    // 게임 화면에서 돌아왔으면 대전 컨텍스트 해제(평소 플레이에 영향 없도록)
    this.$store.commit("setVs", null);
    window.addEventListener("keydown", this.onKey);
    if (!isLanActive()) {
      this.stage = "off";
      return;
    }
    const info = await pingHost();
    if (info.ok) this.hostName = info.name;
    this.off = subscribeLan(this.onEvent);
    const room = await vsRoom();
    if (!info.ok && this.myResultId) {
      this.stage = "lost";
      return;
    }
    if (room && room.players.some((p) => p.pcId === this.pcId)) {
      this.room = room;
      this.stage = "room";
    } else {
      const last = loadLastPlayer();
      this.joinForm = { name: last.name, group: last.group };
      this.stage = "join";
      this.error = info.ok ? "" : `호스트에 연결할 수 없어요: ${info.error}`;
      this.$nextTick(() => this.$refs.joinName && this.$refs.joinName.focus());
    }
    this.pingTimer = setInterval(() => this.stage === "room" && vsPing(), PING_MS);
  },
  beforeDestroy() {
    window.removeEventListener("keydown", this.onKey);
    clearInterval(this.pingTimer);
    clearTimeout(this.selectTimer);
    if (this.off) this.off();
  },
  methods: {
    onEvent(event, data) {
      if (event === "room" && data) {
        this.room = data;
        if (this.stage === "join" && data.players.some((p) => p.pcId === this.pcId)) this.stage = "room";
        if (data.phase === "lobby" && this.myResultId) {
          // 방장이 로비로 돌림 → 결과 화면 닫기
          this.myResultId = "";
          if (this.$route.query.result) this.$router.replace({ path: "/vs" });
        }
        if (data.phase === "loading" && this.me && !this.launching) this.launchGame(data);
      }
    },
    onJoinEnter(e) {
      if (e.isComposing || e.keyCode === 229) return; // 한글 조합 중 Enter 무시
      this.join();
    },
    async join() {
      const name = this.joinForm.name.trim();
      if (!name) return;
      this.error = "";
      const r = await vsJoin(name, this.joinForm.group.trim());
      if (!r.ok) {
        this.error = r.error || "입장 실패";
        return;
      }
      saveLastPlayer(name, this.joinForm.group.trim());
      this.room = await vsRoom();
      this.stage = "room";
      this.$store.state.audio.playEffect("ui/slide2");
    },
    pickSong(id) {
      this.pickedSheetId = id;
      clearTimeout(this.selectTimer);
      // 빠르게 넘길 때 요청이 몰리지 않게 0.25초 모아서 전송
      this.selectTimer = setTimeout(async () => {
        const r = await vsSelect(id);
        this.error = r.ok ? "" : r.error;
      }, 250);
    },
    moveSong(step) {
      const n = this.charts.length;
      const cur = this.charts.findIndex((c) => c.id === this.displaySheetId);
      const next = this.charts[(cur + step + n) % n];
      this.pickSong(next.id);
      this.$store.state.audio.playHoverEffect("ui/ta");
    },
    // 대전 시작: 시계 차이 측정 → 대전 컨텍스트 저장 → 게임 화면(배속 설정 화면은 건너뜀)
    async launchGame(room) {
      this.launching = true;
      const clock = await measureClockOffset(5);
      this.$store.commit("setVs", {
        pcId: this.pcId,
        roomId: room.id,
        sheetId: room.sheetId,
        offsetMs: clock ? clock.offsetMs : 0,
        rttMs: clock ? clock.rttMs : -1,
      });
      this.$store.commit("setAutoPlay", false); // 대전은 오토플레이 불가
      this.$store.commit("setPendingGameOptions", { randomGimmickMode: "off" }); // 모두 같은 채보
      this.$router.push("/game/" + room.sheetId);
    },
    slotClass(p) {
      if (!p) return "empty";
      return { me: p.pcId === this.pcId, offline: p.offline };
    },
    async leaveAndExit() {
      if (this.stage === "room") await vsLeave();
      this.$router.push("/menu");
    },
    async onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        this.leaveAndExit();
        return;
      }
      if (this.stage === "lost") {
        if (e.key === "r" || e.key === "R") this.$router.push("/result/" + this.myResultId);
        return;
      }
      if (this.stage !== "room" || !this.room) return;
      if (this.showResult) {
        if ((e.key === "r" || e.key === "R") && this.myResultId) {
          this.$router.push("/result/" + this.myResultId);
        } else if (e.key === "Enter" && this.isLeader && this.room.phase === "result") {
          const r = await vsReset();
          this.error = r.ok ? "" : r.error;
        }
        return;
      }
      if (this.room.phase !== "lobby") return;
      if (this.isLeader && (e.key === "ArrowRight" || e.key === "ArrowDown")) {
        e.preventDefault();
        this.moveSong(1);
      } else if (this.isLeader && (e.key === "ArrowLeft" || e.key === "ArrowUp")) {
        e.preventDefault();
        this.moveSong(-1);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (this.isLeader) {
          const r = await vsStart();
          this.error = r.ok ? "" : r.error;
        } else if (this.me) {
          const r = await vsReady(!this.me.ready);
          this.error = r.ok ? "" : r.error;
        }
      }
    },
  },
};
</script>

<style scoped>
.vs-page {
  position: fixed;
  inset: 0;
  z-index: 10;
  background: radial-gradient(ellipse at 70% 0%, rgba(var(--dm-cyan-rgb), 0.12), transparent 60%), var(--dm-bg);
  color: var(--dm-text);
  font-family: var(--dm-font-body);
  overflow: hidden;
}
.vs-lines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(115deg, rgba(var(--dm-cyan-rgb), 0.05) 0, rgba(var(--dm-cyan-rgb), 0.05) 1px, transparent 1px, transparent 16px);
}
.vs-top {
  position: relative;
  height: 60px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 48px;
  border-bottom: 1px solid var(--dm-cyan-dim);
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: 26px;
  letter-spacing: 0.08em;
}
.vs-top .slashes {
  color: var(--dm-cyan);
}
.vs-host {
  font-size: 14px;
  padding: 2px 10px;
  color: #04121c;
  background: var(--dm-cyan);
  font-style: normal;
}
.vs-hint {
  margin-left: auto;
  display: flex;
  gap: 22px;
  font-size: 15px;
  font-weight: 600;
  font-style: normal;
  letter-spacing: 0.1em;
  color: var(--dm-muted);
}
kbd {
  margin-right: 4px;
  padding: 1px 6px;
  border: 1px solid var(--dm-cyan-dim);
  color: var(--dm-cyan);
  font-family: inherit;
}
.vs-center {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: calc(100% - 60px);
}
.vs-card {
  width: 560px;
  padding: 28px 32px;
  background: rgba(8, 16, 30, 0.88);
  border-left: 4px solid var(--dm-cyan);
}
.vs-card h2 {
  margin: 0 0 14px;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-size: 32px;
}
.vs-form {
  display: flex;
  gap: 10px;
}
.vs-form input {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  color: var(--dm-text);
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid var(--dm-cyan-dim);
  font-size: 20px;
  font-family: var(--dm-font-body);
  outline: none;
}
.vs-form input:focus {
  border-color: var(--dm-cyan);
}
.muted {
  color: var(--dm-muted);
}
.vs-error {
  color: var(--dm-red);
}
.vs-layout {
  position: relative;
  display: flex;
  gap: 48px;
  height: calc(100% - 60px);
  padding: 32px 48px;
  box-sizing: border-box;
}
.vs-songs,
.vs-result {
  flex: 1.3;
  min-width: 0;
}
.vs-players {
  flex: 1;
  min-width: 0;
}
.vs-section-head {
  margin-bottom: 12px;
  font-family: var(--dm-font-display);
  font-weight: 700;
  letter-spacing: 0.3em;
  color: var(--dm-cyan);
}
.vs-song {
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 20px;
  margin-bottom: 6px;
  cursor: pointer;
  background: rgba(8, 16, 30, 0.8);
  border-left: 4px solid transparent;
  font-family: var(--dm-font-display);
  font-weight: 700;
  font-size: 24px;
  color: var(--dm-muted);
}
.vs-song.locked {
  cursor: default;
}
.vs-song.active {
  color: var(--dm-text);
  border-left-color: var(--dm-cyan);
  background: rgba(var(--dm-cyan-rgb), 0.16);
}
.vs-song-title {
  flex: 1;
}
.vs-song-lv {
  font-size: 18px;
  color: var(--dm-amber);
}
.vs-slot {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 64px;
  padding: 0 18px;
  margin-bottom: 8px;
  background: rgba(8, 16, 30, 0.82);
  border-left: 4px solid rgba(var(--dm-cyan-rgb), 0.35);
  font-size: 22px;
}
.vs-slot.me {
  border-left-color: var(--dm-cyan);
  background: rgba(var(--dm-cyan-rgb), 0.12);
}
.vs-slot.offline {
  opacity: 0.55;
}
.vs-slot.empty {
  border-left-style: dashed;
  background: rgba(8, 16, 30, 0.4);
}
.vs-slot-name {
  font-weight: 600;
}
.vs-slot-group {
  flex: 1;
  font-size: 16px;
  color: var(--dm-muted);
}
.vs-slot-empty {
  color: var(--dm-muted);
  font-size: 16px;
}
.vs-badge {
  padding: 1px 8px;
  font-family: var(--dm-font-display);
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.1em;
}
.vs-badge.leader {
  color: #04121c;
  background: var(--dm-amber);
}
.vs-badge.ready {
  color: #04121c;
  background: var(--dm-cyan);
}
.vs-badge.wait {
  color: var(--dm-muted);
  border: 1px solid var(--dm-muted);
}
.vs-badge.off {
  color: #fff;
  background: var(--dm-red);
}
.vs-status {
  margin-top: 18px;
  font-family: var(--dm-font-display);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.05em;
}
.vs-res-row {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 72px;
  padding: 0 22px;
  margin-bottom: 8px;
  background: rgba(8, 16, 30, 0.85);
  border-left: 4px solid rgba(var(--dm-cyan-rgb), 0.35);
  font-size: 22px;
}
.vs-res-row.me {
  background: rgba(var(--dm-cyan-rgb), 0.12);
}
.vs-res-row.win {
  border-left-color: #ffd36a;
  background: linear-gradient(90deg, rgba(255, 211, 106, 0.22), rgba(8, 16, 30, 0.85));
}
.vs-res-pos {
  width: 32px;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: 34px;
  color: var(--dm-cyan);
}
.vs-res-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
}
.vs-res-name small {
  font-size: 15px;
  color: var(--dm-muted);
}
.vs-res-win {
  padding: 0 10px;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  color: #04121c;
  background: #ffd36a;
  animation: vs-win 0.8s ease-in-out infinite alternate;
}
@keyframes vs-win {
  to {
    box-shadow: 0 0 18px rgba(255, 211, 106, 0.8);
  }
}
.vs-res-acc {
  font-size: 16px;
  color: var(--dm-muted);
}
.vs-res-fc {
  padding: 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: #04121c;
  background: var(--dm-cyan);
}
.vs-res-score {
  width: 170px;
  text-align: right;
  font-family: var(--dm-font-display);
  font-weight: 800;
  font-size: 30px;
  font-variant-numeric: tabular-nums;
}
.vs-result-actions {
  display: flex;
  gap: 28px;
  margin-top: 18px;
  font-family: var(--dm-font-display);
  font-weight: 600;
  letter-spacing: 0.08em;
}
</style>
