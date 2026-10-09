<template>
  <!-- 축제 랭킹 보드: 곡별 TOP10 / 소속 대항전 / 미션 도장. 큰 화면에 띄워두면 곡이 자동으로 넘어감 -->
  <div class="rank-page" @mousedown="stopAuto">
    <div class="rk-lines"></div>
    <header class="rk-top">
      <span class="slashes">///</span>
      <span>FESTIVAL RANKING</span>
      <span class="rk-source" v-if="source">{{ source }}</span>
      <div class="rk-hint">
        <span><kbd>&larr;</kbd><kbd>&rarr;</kbd> 곡</span>
        <span><kbd>T</kbd> {{ todayOnly ? "오늘" : "전체" }}</span>
        <span><kbd>TAB</kbd> 보기 전환</span>
        <span><kbd>ESC</kbd> 나가기</span>
      </div>
    </header>

    <div class="rk-layout">
      <!-- 왼쪽: 곡 선택 + TOP10 -->
      <section class="rk-main">
        <div class="rk-songs">
          <div
            v-for="(c, i) in charts"
            :key="c.id"
            class="rk-song"
            :class="{ active: i === songIndex }"
            @click="selectSong(i)"
          >
            {{ c.title }}
          </div>
        </div>

        <div class="rk-board" v-if="currentChart">
          <div class="rk-board-head">
            <span class="rk-board-title">{{ currentChart.title }}</span>
            <span class="rk-board-sub">TOP 10 · {{ todayOnly ? "TODAY" : "ALL TIME" }}</span>
          </div>
          <div v-if="topList.length === 0" class="rk-empty">아직 기록이 없어요. 첫 번째 주인공이 되어보세요!</div>
          <div v-for="(e, i) in topList" :key="e.id" class="rk-row" :class="'rank-' + (i + 1)">
            <span class="rk-pos">{{ i + 1 }}</span>
            <span class="rk-name">{{ e.name }}</span>
            <span class="rk-group">{{ e.group }}</span>
            <span class="rk-acc">{{ Number(e.accuracy).toFixed(2) }}%</span>
            <span class="rk-fc" v-if="e.isFullCombo">FC</span>
            <span class="rk-score">{{ e.score.toLocaleString() }}</span>
          </div>
        </div>
      </section>

      <!-- 오른쪽: 소속 대항전 / 미션 도장 -->
      <section class="rk-side">
        <div class="rk-tabs">
          <div class="rk-tab" :class="{ active: sideTab === 'group' }" @click="sideTab = 'group'">소속 대항전</div>
          <div class="rk-tab" :class="{ active: sideTab === 'stamp' }" @click="sideTab = 'stamp'">미션 도장</div>
        </div>

        <div v-if="sideTab === 'group'" class="rk-groups">
          <div v-if="groups.length === 0" class="rk-empty">소속을 입력해 기록을 등록하면 대항전에 반영돼요.</div>
          <div v-for="(g, i) in groups.slice(0, 10)" :key="g.group" class="rk-group-row">
            <span class="rk-pos">{{ i + 1 }}</span>
            <div class="rk-group-body">
              <div class="rk-group-line">
                <span class="rk-group-name">{{ g.group }}</span>
                <span class="rk-group-pts">{{ g.points.toFixed(1) }} pt</span>
              </div>
              <div class="rk-bar"><div class="rk-bar-fill" :style="{ width: barWidth(g.points) }"></div></div>
              <div class="rk-group-meta">{{ g.members }}명 · {{ g.plays }}곡 기록</div>
            </div>
          </div>
          <div class="rk-rule">점수 = 사람별·곡별 최고점(100만점 → 100pt) 합계</div>
        </div>

        <div v-else class="rk-groups">
          <div v-if="stamps.length === 0" class="rk-empty">아직 달성한 미션이 없어요.</div>
          <div v-for="(p, i) in stamps.slice(0, 12)" :key="p.name + p.group" class="rk-row small">
            <span class="rk-pos">{{ i + 1 }}</span>
            <span class="rk-name">{{ p.name }}</span>
            <span class="rk-group">{{ p.group }}</span>
            <span class="rk-score">{{ p.stamps }} 개</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script>
import { localCatalog, getSongById } from "../javascript/localCatalog";
import { loadRecords, topBySheet, groupStandings, missionStamps, clearRecords } from "../helpers/records";
import { fetchSharedRecords, clearSharedRecords } from "../helpers/lan";

const AUTO_ROTATE_MS = 8000; // 입력이 없으면 곡을 자동으로 넘김(큰 화면 전시용)
const REFRESH_MS = 5000; // 기록 새로고침(LAN 통합 랭킹일 때 다른 PC 기록 반영)

export default {
  name: "Rankings",
  data() {
    return {
      entries: [],
      songIndex: 0,
      todayOnly: true,
      sideTab: "group",
      autoRotate: true,
      source: "",
    };
  },
  computed: {
    charts() {
      return Object.values(localCatalog.charts).map((c) => {
        const song = getSongById(c.songId);
        return { id: c.id, title: (song && song.title) || c.title };
      });
    },
    currentChart() {
      return this.charts[this.songIndex] || null;
    },
    topList() {
      return this.currentChart ? topBySheet(this.entries, this.currentChart.id, 10, { todayOnly: this.todayOnly }) : [];
    },
    groups() {
      return groupStandings(this.entries, { todayOnly: this.todayOnly });
    },
    stamps() {
      return missionStamps(this.entries);
    },
  },
  async mounted() {
    // 다른 화면에서 곡을 지정해 들어오면(예: 곡 선택 화면의 R) 그 곡부터
    const q = this.$route.query.sheet;
    const idx = this.charts.findIndex((c) => c.id === q);
    if (idx >= 0) {
      this.songIndex = idx;
      this.autoRotate = false;
    }
    await this.refresh();
    window.addEventListener("keydown", this.onKey);
    this.rotateTimer = setInterval(() => {
      if (this.autoRotate && this.charts.length) this.songIndex = (this.songIndex + 1) % this.charts.length;
    }, AUTO_ROTATE_MS);
    this.refreshTimer = setInterval(this.refresh, REFRESH_MS);
  },
  beforeDestroy() {
    window.removeEventListener("keydown", this.onKey);
    clearInterval(this.rotateTimer);
    clearInterval(this.refreshTimer);
  },
  methods: {
    // LAN 호스트가 설정돼 있으면 통합 기록, 아니면(또는 실패 시) 이 PC 기록
    async refresh() {
      const shared = await fetchSharedRecords();
      if (shared) {
        this.entries = shared;
        this.source = "LAN 통합";
      } else {
        this.entries = loadRecords();
        this.source = "";
      }
    },
    stopAuto() {
      this.autoRotate = false;
    },
    selectSong(i) {
      this.songIndex = i;
      this.stopAuto();
    },
    barWidth(points) {
      const max = this.groups.length ? this.groups[0].points : 0;
      return max > 0 ? `${Math.max(3, (points / max) * 100)}%` : "0%";
    },
    async onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        this.$router.push("/menu");
        return;
      }
      // 관리자 초기화: Ctrl+Shift+Delete
      if (e.ctrlKey && e.shiftKey && e.key === "Delete") {
        e.preventDefault();
        const ok = await this.$store.state.gModal.show({
          bodyText: "모든 랭킹 기록을 삭제할까요? (되돌릴 수 없음)",
          okText: "삭제",
          type: "warning",
        });
        if (ok) {
          clearRecords();
          await clearSharedRecords();
          await this.refresh();
        }
        return;
      }
      this.stopAuto();
      const n = this.charts.length;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") this.songIndex = (this.songIndex + 1) % n;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") this.songIndex = (this.songIndex - 1 + n) % n;
      else if (e.key === "t" || e.key === "T") this.todayOnly = !this.todayOnly;
      else if (e.key === "Tab") {
        e.preventDefault();
        this.sideTab = this.sideTab === "group" ? "stamp" : "group";
      }
    },
  },
};
</script>

<style scoped>
.rank-page {
  position: fixed;
  inset: 0;
  z-index: 10;
  background: radial-gradient(ellipse at 30% 0%, rgba(var(--dm-cyan-rgb), 0.12), transparent 60%), var(--dm-bg);
  color: var(--dm-text);
  font-family: var(--dm-font-body);
  overflow: hidden;
}
.rk-lines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(115deg, rgba(var(--dm-cyan-rgb), 0.05) 0, rgba(var(--dm-cyan-rgb), 0.05) 1px, transparent 1px, transparent 16px);
}
.rk-top {
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
.rk-top .slashes {
  color: var(--dm-cyan);
}
.rk-source {
  font-size: 14px;
  padding: 2px 10px;
  color: #04121c;
  background: var(--dm-cyan);
  font-style: normal;
}
.rk-hint {
  margin-left: auto;
  display: flex;
  gap: 22px;
  font-size: 15px;
  font-weight: 600;
  font-style: normal;
  letter-spacing: 0.1em;
  color: var(--dm-muted);
}
.rk-hint kbd {
  margin-right: 4px;
  padding: 1px 6px;
  border: 1px solid var(--dm-cyan-dim);
  color: var(--dm-cyan);
  font-family: inherit;
}
.rk-layout {
  position: relative;
  display: flex;
  gap: 48px;
  height: calc(100% - 60px);
  padding: 32px 48px;
  box-sizing: border-box;
}
.rk-main {
  flex: 1.4;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.rk-side {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.rk-songs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.rk-song {
  padding: 6px 16px;
  cursor: pointer;
  background: rgba(8, 16, 30, 0.8);
  border-left: 3px solid transparent;
  font-family: var(--dm-font-display);
  font-weight: 700;
  font-size: 18px;
  color: var(--dm-muted);
}
.rk-song.active {
  color: var(--dm-text);
  border-left-color: var(--dm-cyan);
  background: rgba(var(--dm-cyan-rgb), 0.15);
}
.rk-board-head {
  display: flex;
  align-items: baseline;
  gap: 16px;
  margin-bottom: 12px;
}
.rk-board-title {
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: 44px;
}
.rk-board-sub {
  font-family: var(--dm-font-display);
  font-weight: 700;
  letter-spacing: 0.3em;
  color: var(--dm-cyan);
}
.rk-row {
  display: flex;
  align-items: center;
  gap: 18px;
  height: 52px;
  padding: 0 20px;
  margin-bottom: 6px;
  background: rgba(8, 16, 30, 0.82);
  border-left: 4px solid rgba(var(--dm-cyan-rgb), 0.35);
  font-size: 20px;
}
.rk-row.small {
  height: 42px;
  font-size: 18px;
}
.rk-row.rank-1 {
  border-left-color: #ffd36a;
  background: linear-gradient(90deg, rgba(255, 211, 106, 0.18), rgba(8, 16, 30, 0.82));
}
.rk-row.rank-2 {
  border-left-color: #dfe6ee;
}
.rk-row.rank-3 {
  border-left-color: #e0975a;
}
.rk-pos {
  width: 36px;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: 26px;
  color: var(--dm-cyan);
}
.rk-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rk-group {
  width: 150px;
  color: var(--dm-muted);
  font-size: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rk-acc {
  width: 90px;
  text-align: right;
  color: var(--dm-muted);
  font-size: 16px;
}
.rk-fc {
  padding: 1px 8px;
  font-size: 13px;
  font-weight: 700;
  color: #04121c;
  background: var(--dm-cyan);
}
.rk-score {
  width: 130px;
  text-align: right;
  font-family: var(--dm-font-display);
  font-weight: 800;
  font-size: 26px;
  font-variant-numeric: tabular-nums;
}
.rk-tabs {
  display: flex;
  gap: 8px;
}
.rk-tab {
  padding: 8px 18px;
  cursor: pointer;
  font-family: var(--dm-font-display);
  font-weight: 700;
  font-size: 18px;
  letter-spacing: 0.1em;
  color: var(--dm-muted);
  border-bottom: 2px solid transparent;
}
.rk-tab.active {
  color: var(--dm-text);
  border-bottom-color: var(--dm-cyan);
}
.rk-group-row {
  display: flex;
  gap: 14px;
  margin-bottom: 14px;
}
.rk-group-body {
  flex: 1;
  min-width: 0;
}
.rk-group-line {
  display: flex;
  justify-content: space-between;
  font-size: 20px;
  font-weight: 600;
}
.rk-group-pts {
  font-family: var(--dm-font-display);
  font-weight: 800;
  color: var(--dm-cyan);
}
.rk-bar {
  height: 10px;
  margin: 6px 0 4px;
  background: rgba(255, 255, 255, 0.06);
}
.rk-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, rgba(var(--dm-cyan-rgb), 0.4), var(--dm-cyan));
  transition: width 0.4s ease;
}
.rk-group-meta,
.rk-rule {
  font-size: 13px;
  color: var(--dm-muted);
}
.rk-rule {
  margin-top: 10px;
}
.rk-empty {
  padding: 30px 0;
  color: var(--dm-muted);
  font-size: 18px;
}
</style>
