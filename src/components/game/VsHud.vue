<template>
  <!-- [LAN 대전] 기어 바깥 왼쪽 위: 실시간 순위/점수. 판정 표시·기어와 겹치지 않음 -->
  <div class="vs-hud">
    <div class="vs-head">
      <span class="vs-tag">VS</span>
      <span class="vs-conn" :class="{ off: !connected }">{{ connected ? "LIVE" : "호스트 연결 끊김" }}</span>
    </div>
    <div
      v-for="(p, i) in ranked"
      :key="p.pcId"
      class="vs-row"
      :class="{ me: p.pcId === vs.pcId, offline: p.offline }"
    >
      <span class="vs-pos">{{ i + 1 }}</span>
      <div class="vs-body">
        <div class="vs-line">
          <span class="vs-name">{{ p.name }}</span>
          <span class="vs-off" v-if="p.offline">OFFLINE</span>
          <span class="vs-score">{{ p.score.toLocaleString() }}</span>
        </div>
        <div class="vs-bar"><div class="vs-bar-fill" :style="{ width: barWidth(p.score) }"></div></div>
      </div>
    </div>

    <!-- 시작 카운트다운(모든 PC가 같은 시각 기준) -->
    <div class="vs-count" v-if="countText">{{ countText }}</div>
  </div>
</template>

<script>
import { subscribeLan } from "../../helpers/lan";
import { vsProgress, vsRoom } from "../../helpers/vs";

const REPORT_MS = 250; // 점수 보고 간격

export default {
  name: "VsHud",
  props: {
    vs: { type: Object, required: true }, // { pcId, offsetMs }
    result: { type: Object, required: true },
    health: { type: Number, default: 100 },
    percentage: { type: Number, default: 0 },
    currentTime: { type: Number, default: 0 },
    startAt: { type: Number, default: 0 }, // 호스트 시각 기준 시작 시각(0 = 아직 모름)
  },
  data() {
    return { players: {}, connected: true, now: Date.now() };
  },
  computed: {
    ranked() {
      // 내 점수는 서버 왕복 없이 바로 반영
      const myScore = this.result.score || 0;
      return Object.values(this.players)
        .map((p) => (p.pcId === this.vs.pcId ? { ...p, score: myScore } : p))
        .sort((a, b) => b.score - a.score);
    },
    countText() {
      if (!this.startAt) return "";
      const hostNow = this.now + (this.vs.offsetMs || 0);
      const left = this.startAt - hostNow;
      if (left > 3000 || left < -800) return "";
      return left > 0 ? String(Math.ceil(left / 1000)) : "GO!";
    },
  },
  async mounted() {
    this.off = subscribeLan(this.onEvent);
    const room = await vsRoom();
    if (room) this.applyRoom(room);
    this.reportTimer = setInterval(this.report, REPORT_MS);
    this.clockTimer = setInterval(() => (this.now = Date.now()), 100);
  },
  beforeDestroy() {
    if (this.off) this.off();
    clearInterval(this.reportTimer);
    clearInterval(this.clockTimer);
  },
  methods: {
    applyRoom(room) {
      const next = {};
      (room.players || []).forEach((p) => {
        const prev = this.players[p.pcId];
        next[p.pcId] = {
          pcId: p.pcId,
          name: p.name,
          offline: p.offline,
          score: (p.live && p.live.score) || (prev && prev.score) || 0,
        };
      });
      this.players = next;
    },
    onEvent(event, data) {
      if (event === "_status") {
        this.connected = !!(data && data.connected);
      } else if (event === "room") {
        this.applyRoom(data);
      } else if (event === "progress" && data && Array.isArray(data.players)) {
        data.players.forEach((p) => {
          const cur = this.players[p.pcId];
          if (!cur) return;
          cur.offline = p.offline;
          if (p.live && p.pcId !== this.vs.pcId) cur.score = p.live.score;
        });
      }
    },
    async report() {
      const r = await vsProgress({
        score: this.result.score || 0,
        accuracy: this.percentage || 0,
        combo: this.result.combo || 0,
        health: this.health,
        t: this.currentTime,
      });
      // SSE가 끊겨도 보고가 성공하면 연결된 것으로 표시
      if (r && r.ok) this.connected = true;
      else if (r && !r.ok && r.status === 0) this.connected = false;
    },
    barWidth(score) {
      const top = this.ranked.length ? this.ranked[0].score : 0;
      return top > 0 ? `${Math.max(2, (score / top) * 100)}%` : "0%";
    },
  },
};
</script>

<style scoped>
.vs-hud {
  position: fixed;
  top: 84px;
  left: 28px;
  width: 300px;
  z-index: 300;
  pointer-events: none;
  font-family: var(--dm-font-display);
}
.vs-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.vs-tag {
  padding: 0 10px;
  font-style: italic;
  font-weight: 800;
  font-size: 20px;
  color: #04121c;
  background: var(--dm-cyan);
}
.vs-conn {
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.2em;
  color: var(--dm-cyan);
}
.vs-conn.off {
  color: var(--dm-red);
  letter-spacing: 0.05em;
}
.vs-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  margin-bottom: 4px;
  background: rgba(4, 8, 16, 0.78);
  border-left: 3px solid rgba(var(--dm-cyan-rgb), 0.3);
}
.vs-row.me {
  border-left-color: var(--dm-cyan);
  background: rgba(var(--dm-cyan-rgb), 0.16);
}
.vs-row.offline {
  opacity: 0.5;
}
.vs-pos {
  width: 18px;
  font-style: italic;
  font-weight: 800;
  font-size: 22px;
  color: var(--dm-cyan);
}
.vs-body {
  flex: 1;
  min-width: 0;
}
.vs-line {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.vs-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--dm-font-body);
  font-weight: 600;
  font-size: 16px;
  color: var(--dm-text);
}
.vs-off {
  font-size: 11px;
  font-weight: 700;
  color: var(--dm-red);
}
.vs-score {
  font-weight: 800;
  font-size: 18px;
  font-variant-numeric: tabular-nums;
  color: var(--dm-text);
}
.vs-bar {
  height: 4px;
  margin-top: 4px;
  background: rgba(255, 255, 255, 0.08);
}
.vs-bar-fill {
  height: 100%;
  background: var(--dm-cyan);
  transition: width 0.25s linear;
}
.vs-count {
  position: fixed;
  left: 50%;
  top: 38%;
  transform: translate(-50%, -50%);
  font-style: italic;
  font-weight: 800;
  font-size: 160px;
  color: var(--dm-text);
  text-shadow: 0 0 30px rgba(var(--dm-cyan-rgb), 0.8);
}
</style>
