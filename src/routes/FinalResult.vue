<template>
  <!-- [모드] 크레딧 마지막 화면. Arcade: 곡 점수 × 난이도 배율 합계 → 최종 기록 등록 + 순위.
       Free Play / VS: 친 곡(판) 목록만. ENTER/ESC → 타이틀. 색은 --dm-* 변수만 사용 -->
  <div class="final-page">
    <header class="fr-top">
      <span class="slashes">///</span>
      <span>{{ modeLabel }} · FINAL</span>
      <span class="fr-player" v-if="session && session.player">{{ session.player.name }} <small>{{ session.player.group }}</small></span>
    </header>

    <div class="fr-body" v-if="session">
      <table class="fr-table">
        <thead>
          <tr>
            <th>{{ isVs ? "MATCH" : "STAGE" }}</th>
            <th class="left">SONG</th>
            <th>LV</th>
            <th>ACC</th>
            <th>SCORE</th>
            <th v-if="isArcade">BONUS</th>
            <th v-if="isArcade">FINAL</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in rows" :key="i" :class="{ failed: r.failed }">
            <td>{{ i + 1 }}</td>
            <td class="left">
              {{ r.title }}
              <span class="fr-tag" v-if="r.hidden">HIDDEN</span>
              <span class="fr-tag fail" v-if="r.failed">FAILED</span>
            </td>
            <td>{{ r.level }}</td>
            <td>{{ r.accuracy.toFixed(2) }}%</td>
            <td>{{ r.score.toLocaleString() }}</td>
            <td v-if="isArcade">×{{ r.multiplier.toFixed(2) }}</td>
            <td v-if="isArcade" class="strong">{{ r.weighted.toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>

      <div class="fr-total" v-if="isArcade">
        <div class="fr-line"><span>곡 점수 합계</span><b>{{ final.base.toLocaleString() }}</b></div>
        <div class="fr-line"><span>난이도 가산점 (레벨 × {{ bonusPct }}%)</span><b>+{{ final.bonus.toLocaleString() }}</b></div>
        <div class="fr-line big"><span>FINAL SCORE</span><b>{{ final.total.toLocaleString() }}</b></div>
        <div class="fr-rank" v-if="saveState === 'saved'">
          오늘 순위 <b>{{ rank > 0 ? rank + "위" : "-" }}</b>
        </div>
        <div class="fr-note" v-else-if="saveState === 'auto'">오토플레이로 친 곡이 있어 랭킹에 등록되지 않습니다</div>
        <div class="fr-note" v-else-if="saveState === 'empty'">친 곡이 없어 등록하지 않았습니다</div>
      </div>
      <div class="fr-total" v-else>
        <div class="fr-note">{{ isVs ? "VS MATCH" : "FREE PLAY" }}는 랭킹에 등록되지 않습니다</div>
      </div>

      <div class="fr-actions">
        <span><kbd>ENTER</kbd> 끝내기 (타이틀로)</span>
      </div>
    </div>
  </div>
</template>

<script>
import { getSession, markFinalSaved, MODES, MODE_LABELS } from "../helpers/session";
import { computeFinal, multiplierOf, BONUS_PER_LEVEL } from "../helpers/finalScore";
import { addRecord, loadRecords, topFinals } from "../helpers/records";
import { postSharedRecord, fetchSharedRecords, getLanConfig } from "../helpers/lan";
import { vsLeave } from "../helpers/vs";

export default {
  name: "FinalResult",
  data() {
    return { session: getSession(), saveState: "", rank: 0 };
  },
  computed: {
    isArcade() {
      return !!this.session && this.session.mode === MODES.arcade;
    },
    isVs() {
      return !!this.session && this.session.mode === MODES.vs;
    },
    modeLabel() {
      return (this.session && MODE_LABELS[this.session.mode]) || "RESULT";
    },
    final() {
      return computeFinal(this.session ? this.session.stages : []);
    },
    rows() {
      const stages = this.session ? this.session.stages : [];
      return stages.map((st, i) => {
        const f = this.final.rows[i];
        return { ...st, level: f.level, multiplier: multiplierOf(st.level), weighted: f.weighted };
      });
    },
    bonusPct() {
      return Math.round(BONUS_PER_LEVEL * 100);
    },
  },
  async mounted() {
    if (!this.session) {
      this.$router.replace("/mode");
      return;
    }
    window.addEventListener("keydown", this.onKey);
    // VS: 마지막 판이 끝났으면 방에서 나감(다음 대전에 끌려가지 않게)
    if (this.isVs) vsLeave().catch(() => {});
    if (this.isArcade) await this.saveFinal();
  },
  beforeDestroy() {
    window.removeEventListener("keydown", this.onKey);
  },
  methods: {
    async saveFinal() {
      const s = this.session;
      if (!s.stages.length) {
        this.saveState = "empty";
        return;
      }
      if (s.stages.some((st) => st.autoPlay)) {
        this.saveState = "auto";
        return;
      }
      if (!s.finalSaved) {
        const f = this.final;
        const entry = addRecord({
          kind: "final",
          name: s.player && s.player.name,
          group: s.player && s.player.group,
          score: f.total,
          base: f.base,
          bonus: f.bonus,
          songs: f.rows.map((r) => ({ sheetId: r.sheetId, title: r.title, level: r.level, score: r.score })),
          pc: getLanConfig().pcName,
        });
        markFinalSaved();
        if (entry) postSharedRecord(entry); // LAN 통합 랭킹(미사용이면 아무것도 안 함)
        this.savedId = entry && entry.id;
      }
      this.saveState = "saved";
      const shared = await fetchSharedRecords();
      const list = topFinals(shared || loadRecords(), 9999, { todayOnly: true });
      const name = s.player && s.player.name;
      const group = s.player && s.player.group;
      this.rank = list.findIndex((e) => e.name === name && e.group === group) + 1;
    },
    finish() {
      this.$store.state.audio.playEffect("ui/slide2");
      this.$router.push("/"); // 타이틀(Home)이 세션을 지움
    },
    onKey(e) {
      if (e.key === "Enter" || e.key === "Escape" || e.key === " ") {
        e.preventDefault();
        this.finish();
      }
    },
  },
};
</script>

<style scoped>
.final-page {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--dm-bg);
  color: var(--dm-text);
  font-family: var(--dm-font-body);
  overflow: hidden;
}
.fr-top {
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
.fr-top .slashes {
  color: var(--dm-cyan);
}
.fr-player {
  margin-left: auto;
  font-size: 22px;
}
.fr-player small {
  color: var(--dm-muted);
  font-size: 16px;
}
.fr-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 28px;
  padding: 0 8vw;
}
.fr-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--dm-font-display);
  font-size: 24px;
  background: var(--dm-panel);
}
.fr-table th {
  padding: 10px 16px;
  font-size: 15px;
  letter-spacing: 0.2em;
  color: var(--dm-muted);
  text-align: right;
  border-bottom: 1px solid var(--dm-cyan-dim);
}
.fr-table td {
  padding: 12px 16px;
  text-align: right;
  font-weight: 700;
  border-bottom: 1px solid var(--dm-cyan-faint);
}
.fr-table .left {
  text-align: left;
}
.fr-table .strong {
  color: var(--dm-cyan);
  font-weight: 800;
}
.fr-table tr.failed td {
  color: var(--dm-muted);
}
.fr-tag {
  margin-left: 8px;
  padding: 1px 8px;
  font-size: 13px;
  letter-spacing: 0.14em;
  color: var(--dm-bg);
  background: var(--dm-amber);
}
.fr-tag.fail {
  background: var(--dm-red);
}
.fr-total {
  align-self: flex-end;
  min-width: 460px;
  padding: 20px 26px;
  background: var(--dm-panel);
  border-left: 6px solid var(--dm-cyan);
}
.fr-line {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 4px 0;
  font-size: 18px;
  color: var(--dm-muted);
}
.fr-line b {
  color: var(--dm-text);
  font-family: var(--dm-font-display);
  font-size: 26px;
}
.fr-line.big {
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--dm-cyan-dim);
  color: var(--dm-text);
  font-family: var(--dm-font-display);
  font-weight: 800;
  letter-spacing: 0.16em;
}
.fr-line.big b {
  font-size: 56px;
  color: var(--dm-cyan);
}
.fr-rank {
  margin-top: 6px;
  text-align: right;
  font-size: 20px;
}
.fr-rank b {
  color: var(--dm-amber);
  font-size: 28px;
}
.fr-note {
  color: var(--dm-muted);
}
.fr-actions {
  align-self: flex-end;
  color: var(--dm-muted);
  letter-spacing: 0.1em;
}
.fr-actions kbd {
  padding: 1px 7px;
  border: 1px solid var(--dm-cyan-dim);
  color: var(--dm-cyan);
  font-family: inherit;
}
</style>
