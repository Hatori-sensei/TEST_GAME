<template>
  <div class="song-select-page">
    <div class="bg-blur" :style="{ backgroundImage: bgImage }"></div>
    <div class="bg-lines"></div>
    <div class="bg-vignette"></div>

    <header class="top-bar">
      <div class="top-title">
        <button class="dm-back-btn" type="button" @click="$router.push('/mode')">&larr; BACK</button>
        <span class="slashes">///</span>
        <span>MUSIC SELECT</span>
        <!-- [모드] 진행 중인 모드/스테이지 -->
        <span class="mode-badge" v-if="session">{{ modeBadge }}</span>
        <!-- [모드] Arcade에서 고른 곡(확인할 때마다 칩이 하나씩 붙음) -->
        <template v-if="isArcadePick">
          <span class="pick-chip" v-for="(p, i) in arcadePicks" :key="p.sheetId"><b>{{ i + 1 }}</b>{{ p.title }}</span>
          <span class="pick-chip secret" v-if="hiddenRule"><b>3</b>???</span>
        </template>
      </div>
      <div class="top-hint">
        <span v-if="!isArcadePick"><kbd>&uarr;</kbd><kbd>&darr;</kbd> SELECT</span>
        <template v-if="isArcadePick">
          <span><kbd>ENTER</kbd> {{ arcadePicksFull ? "START" : "SELECT" }}</span>
          <span v-if="arcadePicks.length"><kbd>BACKSPACE</kbd> UNDO</span>
        </template>
        <span v-else><kbd>ENTER</kbd> START</span>
        <template v-if="!session">
          <span><kbd>R</kbd> RANKING</span>
          <span><kbd>V</kbd> VS</span>
        </template>
        <span><kbd>ESC</kbd> OPTIONS</span>
      </div>
    </header>

    <div class="layout-container">
      <section class="left-panel">
        <transition name="fade" mode="out-in">
          <div class="song-info" v-if="selectedSong" :key="selectedSong.id">
            <div class="jacket-frame" :style="jacketStyle">
              <div class="jacket">
                <img :src="coverImage" class="album-art" @load="onArtLoad" />
                <div class="album-overlay"></div>
              </div>
            </div>

            <div class="title-block">
              <h1 class="song-title">{{ selectedSong.title }}</h1>
              <p class="song-artist">{{ selectedSong.artist || 'Unknown Artist' }}</p>
            </div>

            <div class="detail-grid">
              <div class="detail-card">
                <span class="label">BPM</span>
                <strong>{{ selectedSongBpm }}</strong>
              </div>
              <div class="detail-card">
                <span class="label">LENGTH</span>
                <strong>{{ selectedSongLength }}</strong>
              </div>
            </div>

            <!-- [모드] Arcade: 곡마다 확인 팝업 → 다음 스테이지. 고른 곡은 목록에서 빠짐 -->
            <div class="play-panel" v-if="isArcadePick">
              <button class="play-action" @click="openPickConfirm">
                <span class="play-mode">STAGE {{ Math.min(arcadePicks.length + 1, 3) }}</span>
                <span class="play-go">{{ arcadePicksFull ? "START" : "SELECT" }}<i class="chev"></i></span>
              </button>
            </div>
            <div class="play-panel" v-else-if="sheetList && sheetList.length > 0">
              <button class="play-action" @click="playGame(sheetList[0].id)">
                <span class="play-mode">{{ String(sheetList[0].keys).replace(/\D/g, '') }}B</span>
                <span class="play-lv"><small>LV</small>{{ sheetList[0].difficulty }}</span>
                <span class="play-go">START<i class="chev"></i></span>
              </button>
            </div>
            <Loading v-else :show="true" text="Loading Sheets..." />

            <!-- [축제 랭킹] 선택 곡 오늘 TOP3 (R 키로 전체 랭킹) -->
            <div class="mini-rank" v-if="miniTop.length > 0">
              <div class="mini-rank-head">TODAY TOP 3</div>
              <div v-for="(e, i) in miniTop" :key="e.id" class="mini-rank-row">
                <span class="mini-rank-pos">{{ i + 1 }}</span>
                <span class="mini-rank-name">{{ e.name }}</span>
                <span class="mini-rank-group">{{ e.group }}</span>
                <span class="mini-rank-score">{{ e.score.toLocaleString() }}</span>
              </div>
            </div>
          </div>

          <div v-else class="empty-state">
            Loading Songs...
          </div>
        </transition>
      </section>

      <section class="right-panel">
        <div class="list-head">
          <span class="list-title">TRACK LIST</span>
          <span class="list-count">{{ String((songList || []).length).padStart(2, '0') }}</span>
        </div>

        <div class="list-container" ref="listContainer">
          <div
            v-for="(song, index) in songList"
            :key="song.id"
            class="song-item"
            :class="{ active: selectedIndex === index }"
            @click="selectSong(index, false)"
            @mouseenter="hoverSong(index)"
          >
            <span class="song-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <div class="song-item-content">
              <span class="song-name">{{ song.title }}</span>
              <span class="song-subtitle">{{ song.subtitle || song.artist || 'Unknown' }}</span>
            </div>
            <div class="song-meta">
              <span class="song-lv" v-if="song.difficulty">LV {{ song.difficulty }}</span>
              <span class="song-len">{{ song.length || '00:00' }}</span>
            </div>
          </div>

          <Loading :show="!songList || songList.length === 0" text="Fetching Songs..." />
        </div>
      </section>
    </div>

    <!-- [모드] Arcade 곡 확인 팝업. 확인하면 SELECTED 도장 → 위쪽 칩으로 날아가며 다음 스테이지 -->
    <transition name="pick-pop">
      <div class="pick-overlay" v-if="pickConfirm">
        <div class="pick-card" :class="{ selected: pickAnim, secret: pickConfirm.hidden }">
          <div class="pick-stage">{{ pickConfirm.hidden ? "HIDDEN STAGE" : "STAGE " + pickConfirm.stageNo }}</div>
          <div class="pick-cover" v-if="pickConfirm.cover && !pickConfirm.hidden">
            <img :src="pickConfirm.cover" />
          </div>
          <div class="pick-cover secret" v-else>???</div>
          <div class="pick-title">{{ pickConfirm.title }}</div>
          <div class="pick-lv">LV {{ pickConfirm.level }}</div>
          <div class="pick-keys" v-if="pickConfirm.hidden">
            <span><kbd>ENTER</kbd> START</span><span><kbd>ESC</kbd> BACK</span>
          </div>
          <div class="pick-keys" v-else>
            <span><kbd>ENTER</kbd> OK</span><span><kbd>ESC</kbd> CANCEL</span>
          </div>
          <div class="pick-stamp">SELECTED</div>
        </div>
      </div>
    </transition>

    <transition name="modal-fade">
      <div
        v-if="showQuickSettings"
        class="quick-settings-backdrop"
        @click.self="closeQuickSettings"
      >
        <div class="quick-settings-panel blurBackground">
          <div class="quick-settings-header">
            <h2>설정</h2>
            <div class="hint">ESC를 눌러 닫기</div>
          </div>

          <!-- [테마] 화면 테마 선택(바꾸면 바로 미리보기, Apply 시 저장, Close 시 원래대로) -->
          <div class="quick-settings-section">
            <h3>화면 테마</h3>
            <div class="settings-row">
              <label for="themeSelect">테마</label>
              <div class="slider-wrap">
                <select id="themeSelect" v-model.number="quickGameSt.theme" @change="previewTheme">
                  <option v-for="t in themeList" :key="t.id" :value="t.id">{{ t.id }}. {{ t.name }}</option>
                </select>
              </div>
              <strong>{{ quickGameSt.theme }}</strong>
            </div>
            <!-- [팔레트] 메인 테마 3의 강조색(운영자 기본색). Arcade 손님 색·곡 지정·VS 색이 있으면 그쪽이 우선 -->
            <div class="settings-row">
              <label>팔레트</label>
              <PaletteChips v-model="quickGameSt.palette" @input="previewPalette"></PaletteChips>
              <span></span>
            </div>
          </div>

          <div class="quick-settings-section">
            <h3>키,배속 설정</h3>
            <div class="settings-row">
              <label>배속</label>
              <div class="slider-wrap">
                <vue-slider
                  :value="quickGameSt.noteSpeed"
                  :interval="0.1"
                  :min="1"
                  :max="9.9"
                  :contained="true"
                  :tooltip-formatter="(val) => `${Number(val).toFixed(1)}x`"
                  @change="onQuickSpeedChange"
                ></vue-slider>
              </div>
              <strong>{{ Number(quickGameSt.noteSpeed).toFixed(1) }}x</strong>
            </div>
            <div class="settings-row">
              <label for="randomGimmickMode">랜덤 기믹 테스트</label>
              <div class="slider-wrap">
                <select
                  id="randomGimmickMode"
                  v-model="quickGameSt.randomGimmickMode"
                  @change="onRandomGimmickModeChange"
                >
                  <option value="off">끄기</option>
                  <option value="speed">변속만</option>
                  <option value="lane">레인 이동만</option>
                  <option value="both">변속 + 레인 이동</option>
                </select>
              </div>
              <strong>{{ randomGimmickModeText(quickGameSt.randomGimmickMode) }}</strong>
            </div>
            <div class="settings-row">
              <label></label>
              <Checkbox
                label="키 빔"
                :model="quickGameSt"
                modelKey="keyBeamEnabled"
                cbStyle="form"
              ></Checkbox>
            </div>
            <div class="settings-row">
              <label></label>
              <Checkbox
                label="노트 타격 이펙트"
                :model="quickGameSt"
                modelKey="noteEffectEnabled"
                cbStyle="form"
              ></Checkbox>
            </div>
            <KeyMappings v-model="quickPreference.keyMap"></KeyMappings>
          </div>

          <!-- [설정] 플레이 설정(새 항목). 기본값은 전부 기존 동작과 동일 -->
          <div class="quick-settings-section">
            <h3>플레이 설정</h3>
            <div class="settings-row">
              <label>오디오 오프셋</label>
              <div class="slider-wrap">
                <vue-slider
                  :value="quickGameSt.audioOffsetMs"
                  :interval="1"
                  :min="-200"
                  :max="200"
                  :contained="true"
                  :tooltip-formatter="(val) => formatOffset(val)"
                  @change="(v) => (quickGameSt.audioOffsetMs = Number(v))"
                ></vue-slider>
              </div>
              <strong>{{ formatOffset(quickGameSt.audioOffsetMs) }}</strong>
            </div>
            <div class="settings-row">
              <label></label>
              <div class="calib-box">
                <template v-if="calib.state === 'running'">
                  <span class="calib-live">삑 소리에 맞춰 아무 키나 누르세요 ({{ calib.taps.length }})</span>
                </template>
                <template v-else>
                  <button class="settings-btn calib-btn" @click="startCalibration">자동 측정</button>
                  <span class="calib-msg">{{ calib.message || "소리가 늦게 들리면 + (노트가 늦게 내려옴)" }}</span>
                </template>
              </div>
              <span></span>
            </div>
            <div class="settings-row">
              <label>레인 커버</label>
              <div class="slider-wrap">
                <vue-slider
                  :value="quickGameSt.laneCover"
                  :interval="0.01"
                  :min="0"
                  :max="0.6"
                  :contained="true"
                  :tooltip-formatter="(val) => `${Math.round(Number(val) * 100)}%`"
                  @change="(v) => (quickGameSt.laneCover = Number(v))"
                ></vue-slider>
              </div>
              <strong>{{ Math.round(quickGameSt.laneCover * 100) }}%</strong>
            </div>
            <div class="settings-row">
              <label>배경 어둡게</label>
              <div class="slider-wrap">
                <vue-slider
                  :value="quickGameSt.bgaDim"
                  :interval="0.01"
                  :min="0"
                  :max="0.95"
                  :contained="true"
                  :tooltip-formatter="(val) => `${Math.round(Number(val) * 100)}%`"
                  @change="(v) => (quickGameSt.bgaDim = Number(v))"
                ></vue-slider>
              </div>
              <strong>{{ Math.round(quickGameSt.bgaDim * 100) }}%</strong>
            </div>
            <div class="settings-grid">
              <Checkbox label="FAST/SLOW 표시" :model="quickGameSt" modelKey="showFastSlow" cbStyle="form"></Checkbox>
              <Checkbox label="미러 (좌우 반전)" :model="quickGameSt" modelKey="mirror" cbStyle="form"></Checkbox>
              <Checkbox label="No Fail (게임오버 없음)" :model="quickGameSt" modelKey="noFail" cbStyle="form"></Checkbox>
              <Checkbox label="오토플레이 (이번 실행만)" :model="quickGameSt" modelKey="autoPlay" cbStyle="form"></Checkbox>
              <Checkbox label="채보 연출 효과 (섬광/암전 등)" :model="quickGameSt" modelKey="fxEnabled" cbStyle="form"></Checkbox>
              <Checkbox label="대기 화면 (방치 시 타이틀 → SAMPLE PLAY)" :model="quickGameSt" modelKey="attractMode" cbStyle="form"></Checkbox>
            </div>
          </div>

          <div class="quick-settings-section">
            <h3>사운드 설정</h3>
            <div class="settings-row">
              <label>BGM</label>
              <div class="slider-wrap">
                <vue-slider
                  :value="quickSound.bgmVolume"
                  :interval="0.01"
                  :min="0"
                  :max="1"
                  :contained="true"
                  :tooltip-formatter="(val) => `${Math.round(Number(val) * 100)}%`"
                  @change="onBgmVolumeChange"
                ></vue-slider>
              </div>
              <strong>{{ Math.round(quickSound.bgmVolume * 100) }}%</strong>
            </div>
            <div class="settings-row">
              <label>효과음</label>
              <div class="slider-wrap">
                <vue-slider
                  :value="quickSound.effectVolume"
                  :interval="0.01"
                  :min="0"
                  :max="1"
                  :contained="true"
                  :tooltip-formatter="(val) => `${Math.round(Number(val) * 100)}%`"
                  @change="onEffectVolumeChange"
                ></vue-slider>
              </div>
              <strong>{{ Math.round(quickSound.effectVolume * 100) }}%</strong>
            </div>
          </div>

          <!-- [외부 곡 폴더] DJON-data 불러오기 결과. 코드가 PC마다 같아야 곡 목록·채보가 같음 -->
          <div class="quick-settings-section">
            <h3>곡 폴더 (DJON-data)</h3>
            <div class="calib-msg">
              <template v-if="catalogStatus.loaded">외부 곡 {{ catalogStatus.external }}개<span v-if="catalogStatus.hidden"> (히든 {{ catalogStatus.hidden }}개)</span></template>
              <template v-else>곡 폴더 없음 · 내장 곡만 사용</template>
              · 곡 목록 코드 <strong class="lan-ip">{{ catalogStatus.hash || "-" }}</strong>
            </div>
            <div class="calib-msg catalog-error" v-if="catalogStatus.error">{{ catalogStatus.error }}</div>
            <div class="calib-msg catalog-error" v-for="m in catalogStatus.missing" :key="m.id + m.path">
              파일 없음{{ m.required ? "" : "(선택)" }}: {{ m.path }} ({{ m.id }})
            </div>
            <div class="calib-msg catalog-error" v-for="(w, i) in catalogStatus.warnings" :key="'w' + i">{{ w }}</div>
          </div>

          <!-- [LAN] 여러 PC 연결: 통합 랭킹 / 대전. 기본 = 사용 안 함 -->
          <div class="quick-settings-section">
            <h3>LAN (여러 PC 연결)</h3>
            <LanSetupPanel v-model="quickLan"></LanSetupPanel>
          </div>

          <div class="quick-settings-actions">
            <button class="settings-btn save" @click="saveQuickSettings">Apply</button>
            <button class="settings-btn" @click="closeQuickSettings">Close</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import Loading from "../components/ui/Loading.vue";
import KeyMappings from "../components/menus/KeyMappings.vue";
import Checkbox from "../components/ui/Checkbox.vue";
import VueSlider from "vue-slider-component";
import { getSheetList, getSongListCached, updateUserProfile } from "../javascript/db";
import { logEvent } from "../helpers/analytics";
import { resolveSongPreviewRange, catalogStatus, getChartForSong } from "../javascript/localCatalog";
import { MODES, MODE_LABELS, currentStageNo, isSessionDone, nextRoute, setArcadeQueue, matchHiddenRule, restoreBasePalette } from "../helpers/session";
import { saveSettings, loadSettings, DEFAULT_SETTINGS } from "../helpers/settings";
import { THEMES, applyTheme } from "../helpers/theme";
import { applyPalette } from "../helpers/palette";
import PaletteChips from "../components/ui/PaletteChips.vue";
import { loadRecords, topBySheet } from "../helpers/records";
import { isLanAvailable, getLanConfig, applyLanRole } from "../helpers/lan";
import LanSetupPanel from "../components/ui/LanSetupPanel.vue";

// [설정] 오프셋 자동 측정: 메트로놈 간격/횟수
const CALIB_INTERVAL_SEC = 0.6;
const CALIB_BEATS = 12;
const CALIB_LEAD_SEC = 1.0;

const DEFAULT_KEY_MAP = {
  a: "a",
  s: "s",
  d: "d",
  f: "f",
  " ": " ",
  j: "j",
  k: "k",
  l: "l",
  ";": ";",
};

// [모드] 곡 확인 후 SELECTED 애니메이션 길이(CSS pick-stamp/pick-fly와 맞춤)
const PICK_ANIM_MS = 650;

export default {
  name: "SongSelect",
  components: { Loading, KeyMappings, VueSlider, Checkbox, LanSetupPanel, PaletteChips },
  data() {
    return {
      artRatio: 1,
      allSongs: null,
      songList: [],
      sheetList: null,
      selectedSong: null,
      selectedIndex: 0,
      records: [], // [축제 랭킹] 이 PC 기록(화면 진입 시 1번 읽음)
      previewStopTimer: null,
      previewFadeOutTimer: null,
      previewToken: 0,
      showQuickSettings: false,
      quickGameSt: {
        noteSpeed: 1,
        randomGimmickMode: "off",
        keyBeamEnabled: true,
        noteEffectEnabled: true,
        // [설정] 새 항목(기본값 = 기존 동작)
        audioOffsetMs: DEFAULT_SETTINGS.audioOffsetMs,
        laneCover: DEFAULT_SETTINGS.laneCover,
        bgaDim: DEFAULT_SETTINGS.bgaDim,
        mirror: DEFAULT_SETTINGS.mirror,
        noFail: DEFAULT_SETTINGS.noFail,
        showFastSlow: DEFAULT_SETTINGS.showFastSlow,
        autoPlay: false,
        fxEnabled: DEFAULT_SETTINGS.fxEnabled, // [연출]
        attractMode: DEFAULT_SETTINGS.attractMode, // [대기 화면]
        theme: DEFAULT_SETTINGS.theme, // [테마]
        palette: DEFAULT_SETTINGS.palette, // [팔레트]
      },
      themeList: THEMES,
      catalogStatus, // [외부 곡 폴더] 불러오기 결과(설정 화면 표시용)
      arcadePicks: [], // [모드] Arcade에서 담은 곡 [{ sheetId, songId, title, level }]
      pickSessionId: "", // 담은 곡이 어느 세션 것인지(새 크레딧이면 비움)
      pickConfirm: null, // [모드] 확인 팝업 { sheetId, songId, title, level, cover, stageNo, hidden }
      pickAnim: false, // 확인 후 SELECTED 애니메이션 중
      // [LAN] 설정 화면 상태
      quickLan: { role: "off", host: "", pcName: "" },
      lan: { available: isLanAvailable() },
      // [설정] 오프셋 자동 측정 상태
      calib: { state: "idle", taps: [], beats: [], message: "" },
      quickPreference: {
        keyMap: { ...DEFAULT_KEY_MAP },
      },
      quickSound: {
        bgmVolume: 0.7,
        effectVolume: 0.5,
      },
    };
  },
  computed: {
    // [모드] 진행 중인 세션(없으면 null)
    session() {
      return this.$store.state.session;
    },
    isArcadePick() {
      return !!this.session && this.session.mode === MODES.arcade && !this.session.queue.length;
    },
    modeBadge() {
      if (!this.session) return "";
      const label = MODE_LABELS[this.session.mode] || "";
      if (this.isArcadePick) return `${label} ${Math.min(this.arcadePicks.length + 1, 3)}/3`;
      return `${label} · STAGE ${currentStageNo()}/3`;
    },
    // [히든곡] 담은 1·2번째 곡이 히든 규칙과 맞으면 그 규칙(3번째 칸 = ???)
    hiddenRule() {
      if (this.arcadePicks.length !== 2) return null;
      return matchHiddenRule(this.arcadePicks.map((p) => p.sheetId));
    },
    arcadePicksFull() {
      return this.arcadePicks.length >= 3 || !!this.hiddenRule;
    },

    jacketStyle() {
      const r = this.artRatio > 0 ? this.artRatio : 1;
      return { width: `min(100%, calc(44vh * ${r}))`, aspectRatio: String(r) };
    },
    coverImage() {
      if (!this.selectedSong) return '';
      if (this.selectedSong.customCoverUrl) return this.selectedSong.customCoverUrl;
      if (this.selectedSong.srcMode === 'youtube' && this.selectedSong.youtubeId) {
        return `https://img.youtube.com/vi/${this.selectedSong.youtubeId}/hqdefault.jpg`;
      }
      return 'assets/default-cover.png';
    },
    bgImage() {
      return this.coverImage ? `url(${this.coverImage})` : 'none';
    },
    // [축제 랭킹] 선택 곡의 오늘 TOP3
    miniTop() {
      const sheet = this.sheetList && this.sheetList[0];
      return sheet ? topBySheet(this.records, sheet.id, 3, { todayOnly: true }) : [];
    },
    selectedSongBpm() {
      const bpm = this.selectedSong?.bpm;
      if (typeof bpm === "number") return String(Math.round(bpm));
      if (typeof bpm === "string" && bpm.trim()) return bpm;
      return "120";
    },
    selectedSongLength() {
      const length = this.selectedSong?.length;
      if (typeof length === "number" && Number.isFinite(length)) {
        const minutes = Math.floor(length / 60);
        const seconds = Math.floor(length % 60)
          .toString()
          .padStart(2, "0");
        return `${minutes}:${seconds}`;
      }
      if (typeof length === "string" && length.trim()) return length;
      const duration = this.selectedSong?.duration;
      if (typeof duration === "string" && duration.trim()) return duration;
      return "0:00";
    }
  },
  watch: {
    async selectedSong() {
      this.sheetList = null;
      if (this.selectedSong) {
        this.sheetList = await getSheetList(this.selectedSong.id);
        logEvent("song_selected", { id: this.selectedSong.id });
        this.playSelectedSongPreview(this.selectedSong);
      }
    },
  },
  async mounted() {
    await this.getAllSongs();
    this.songList = this.allSongs || [];
    this.refreshPickList(); // [모드] Arcade 중이면 고른 곡 제외
    this.selectSong(0);
    this.initQuickSettings();
  },
  // [버그 수정] 이 화면은 keep-alive로 캐시돼서 다른 화면으로 가도 파괴되지 않음.
  // 예전엔 mounted에서 건 keydown 리스너가 게임/결과 화면에서도 살아 있어서
  // 결과 화면의 Enter → 곡 시작(speed-setup 이동), 게임 중 ESC → 숨은 설정창 토글 등이 발생했음.
  // → 화면이 보일 때(activated)만 리스너를 걸고, 떠날 때(deactivated) 제거.
  activated() {
    // [모드] 모드를 고르지 않고 들어오면 모드 선택으로, 이미 3곡을 다 쳤으면 다음 화면으로
    const session = this.$store.state.session;
    if (!session) {
      this.$router.replace("/mode");
      return;
    }
    if (isSessionDone() || (session.mode === MODES.arcade && session.queue.length)) {
      this.$router.replace(nextRoute());
      return;
    }
    if (session.mode === MODES.vs) {
      this.$router.replace("/vs");
      return;
    }
    if (this.pickSessionId !== session.id) {
      this.pickSessionId = session.id;
      this.arcadePicks = [];
      this.pickConfirm = null;
      this.pickAnim = false;
    }
    this.refreshPickList();
    this.records = loadRecords(); // [축제 랭킹] 결과 화면에서 등록한 기록 반영
    window.removeEventListener('keydown', this.handleKeydown);
    window.addEventListener('keydown', this.handleKeydown);
  },
  beforeDestroy() {
    this.stopCalibration();
    this.clearPreviewTimer();
    window.removeEventListener('keydown', this.handleKeydown);
  },
  deactivated() {
    window.removeEventListener('keydown', this.handleKeydown);
    this.clearPreviewTimer();
  },
  methods: {
    initQuickSettings() {
      const profile = this.$store.state.userProfile || {};
      const gameSt = profile.gameSt || {};
      const preference = profile.preference || {};
      const audio = this.$store.state.audio;

      const speed = Number(gameSt.noteSpeed ?? this.$store.state.speedMultiplier ?? 1);
      this.quickGameSt.noteSpeed = this.clamp(speed, 1, 9.9, 1);
      this.quickGameSt.randomGimmickMode = this.normalizeRandomGimmickMode(
        this.$store.state.randomGimmickMode
      );
      this.quickGameSt.keyBeamEnabled = gameSt.keyBeamEnabled ?? true;
      this.quickGameSt.noteEffectEnabled = gameSt.noteEffectEnabled ?? true;
      this.quickGameSt.audioOffsetMs = this.clamp(gameSt.audioOffsetMs, -200, 200, 0);
      this.quickGameSt.laneCover = this.clamp(gameSt.laneCover, 0, 0.6, 0);
      this.quickGameSt.bgaDim = this.clamp(gameSt.bgaDim, 0, 0.95, DEFAULT_SETTINGS.bgaDim);
      this.quickGameSt.mirror = gameSt.mirror === true;
      this.quickGameSt.noFail = gameSt.noFail === true;
      this.quickGameSt.showFastSlow = gameSt.showFastSlow === true;
      this.quickGameSt.fxEnabled = gameSt.fxEnabled !== false;
      this.quickGameSt.attractMode = loadSettings().attractMode; // [대기 화면]
      this.quickGameSt.autoPlay = this.$store.state.autoPlay === true;
      this.quickGameSt.theme = loadSettings().theme; // [테마] 저장된 테마
      this.quickGameSt.palette = loadSettings().palette; // [팔레트] 저장된 기본색
      this.quickPreference.keyMap = {
        ...DEFAULT_KEY_MAP,
        ...(preference.keyMap || {}),
      };

      const bgmVolume = Number(audio?.maxVolume ?? 0.7);
      const effectVolume = Number(audio?.effectVolume ?? 0.5);
      this.quickSound.bgmVolume = this.clamp(bgmVolume, 0, 1, 0.7);
      this.quickSound.effectVolume = this.clamp(effectVolume, 0, 1, 0.5);
    },
    clamp(value, min, max, fallback) {
      const num = Number(value);
      if (!Number.isFinite(num)) return fallback;
      return Math.min(max, Math.max(min, num));
    },
    openQuickSettings() {
      this.initQuickSettings();
      this.initLanSettings();
      this.showQuickSettings = true;
      this.$store.state.audio.playEffect("ui/pop");
    },
    // [LAN] 저장된 LAN 설정 불러오기(주소 표시·찾기·연결 확인은 LanSetupPanel이 함)
    initLanSettings() {
      this.quickLan = { ...getLanConfig() };
    },
    // [테마] 선택 즉시 화면에 미리 적용
    previewTheme() {
      applyTheme(this.quickGameSt.theme);
    },
    // [팔레트] 고르면 즉시 미리보기(Close하면 원래 색으로)
    previewPalette(id) {
      applyPalette(id);
    },
    closeQuickSettings() {
      this.stopCalibration();
      applyTheme(loadSettings().theme); // [테마] Apply 안 하고 닫으면 저장된 테마로 되돌림
      restoreBasePalette(); // [팔레트] 미리보기 되돌림(크레딧 색 → 저장된 기본색)
      this.showQuickSettings = false;
      this.$store.state.audio.playEffect("ui/loose");
    },
    onQuickSpeedChange(value) {
      this.quickGameSt.noteSpeed = this.clamp(value, 1, 9.9, 1);
    },
    normalizeRandomGimmickMode(mode) {
      const normalized = String(mode || "off").toLowerCase();
      const allowed = ["off", "speed", "lane", "both"];
      return allowed.includes(normalized) ? normalized : "off";
    },
    randomGimmickModeText(mode) {
      const normalized = this.normalizeRandomGimmickMode(mode);
      if (normalized === "speed") return "변속만";
      if (normalized === "lane") return "레인만";
      if (normalized === "both") return "둘 다";
      return "끄기";
    },
    onRandomGimmickModeChange() {
      this.$store.commit(
        "setRandomGimmickMode",
        this.normalizeRandomGimmickMode(this.quickGameSt.randomGimmickMode)
      );
    },
    onBgmVolumeChange(value) {
      const next = this.clamp(value, 0, 1, 0.7);
      this.quickSound.bgmVolume = next;
      const audio = this.$store.state.audio;
      if (!audio) return;
      audio.maxVolume = next;
      audio.setVolume(next);
      saveSettings({ bgmVolume: next }); // [설정 저장] 볼륨은 즉시 적용되므로 즉시 저장
    },
    onEffectVolumeChange(value) {
      const next = this.clamp(value, 0, 1, 0.5);
      this.quickSound.effectVolume = next;
      const audio = this.$store.state.audio;
      if (!audio) return;
      audio.effectVolume = next;
      audio.playEffect("ui/click2");
      saveSettings({ effectVolume: next }); // [설정 저장]
    },
    async saveQuickSettings() {
      const profile = this.$store.state.userProfile || {};
      const gameSt = {
        ...(profile.gameSt || {}),
        noteSpeed: this.quickGameSt.noteSpeed,
        keyBeamEnabled: this.quickGameSt.keyBeamEnabled,
        noteEffectEnabled: this.quickGameSt.noteEffectEnabled,
        audioOffsetMs: this.quickGameSt.audioOffsetMs,
        laneCover: this.quickGameSt.laneCover,
        bgaDim: this.quickGameSt.bgaDim,
        mirror: this.quickGameSt.mirror,
        noFail: this.quickGameSt.noFail,
        showFastSlow: this.quickGameSt.showFastSlow,
        fxEnabled: this.quickGameSt.fxEnabled,
      };
      const preference = {
        ...(profile.preference || {}),
        keyMap: { ...this.quickPreference.keyMap },
      };

      this.$store.commit("setSpeedMultiplier", this.quickGameSt.noteSpeed);
      this.$store.commit(
        "setRandomGimmickMode",
        this.normalizeRandomGimmickMode(this.quickGameSt.randomGimmickMode)
      );
      this.$store.commit("setUserProfile", {
        ...profile,
        gameSt,
        preference,
      });
      this.$store.commit("setAutoPlay", this.quickGameSt.autoPlay);

      // [설정 저장] 재시작 후에도 유지되도록 로컬에 저장(오토플레이/랜덤 기믹 테스트는 저장 안 함)
      saveSettings({
        ...gameSt,
        keyMap: preference.keyMap,
        bgmVolume: this.quickSound.bgmVolume,
        effectVolume: this.quickSound.effectVolume,
        theme: applyTheme(this.quickGameSt.theme), // [테마] 적용 + 저장
        palette: this.quickGameSt.palette, // [팔레트] 운영자 기본색 저장
        attractMode: this.quickGameSt.attractMode, // [대기 화면]
        // [LAN]
        lanRole: this.quickLan.role,
        lanHost: this.quickLan.host.trim(),
        pcName: this.quickLan.pcName.trim(),
      });
      // [LAN] 역할에 맞게 호스트 서버 켜기/끄기(LAN을 안 쓰면 꺼진 상태 유지)
      if (this.lan.available) {
        applyLanRole().then((r) => {
          if (r && !r.ok) this.$store.state.alert.error(`LAN 호스트 시작 실패: ${r.error}`);
        });
      }

      try {
        await updateUserProfile({ gameSt, preference });
      } catch (error) {
        Logger.warn("quick settings save failed", error);
      }

      restoreBasePalette(); // [팔레트] 저장한 기본색 적용(크레딧 색이 있으면 그 색 유지)
      this.$store.state.audio.playEffect("ui/slide2");
      this.showQuickSettings = false;
    },
    formatOffset(val) {
      const n = Math.round(Number(val) || 0);
      return `${n > 0 ? "+" : ""}${n}ms`;
    },
    // [설정] 오프셋 자동 측정: 일정 간격 클릭음에 맞춰 키를 누르게 하고,
    // (누른 시각 - 소리 예정 시각)의 중앙값을 오프셋으로 제안한다.
    // 소리 출력 지연 + 입력 지연이 합쳐서 측정되므로 게임 오프셋과 같은 의미.
    startCalibration() {
      this.stopCalibration();
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        this.calib.message = "이 환경에서는 측정할 수 없습니다";
        return;
      }
      const ctx = new Ctx();
      this.calibCtx = ctx;
      const audio = this.$store.state.audio;
      if (audio) audio.pause(); // 프리뷰 음악 정지(측정 방해 방지)
      ctx.resume().catch(() => {});
      const baseCtx = ctx.currentTime;
      const basePerf = performance.now();
      const beats = [];
      for (let i = 0; i < CALIB_BEATS; i += 1) {
        const when = baseCtx + CALIB_LEAD_SEC + i * CALIB_INTERVAL_SEC;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = i % 4 === 0 ? 1500 : 1000;
        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.exponentialRampToValueAtTime(0.5, when + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
        osc.connect(gain).connect(ctx.destination);
        osc.start(when);
        osc.stop(when + 0.08);
        beats.push(basePerf + (when - baseCtx) * 1000);
      }
      this.calib = { state: "running", taps: [], beats, message: "" };
      this.calibTimer = setTimeout(
        () => this.finishCalibration(),
        (CALIB_LEAD_SEC + CALIB_BEATS * CALIB_INTERVAL_SEC + 0.4) * 1000
      );
    },
    onCalibrationTap(e) {
      this.calib.taps.push(e.timeStamp || performance.now());
    },
    finishCalibration() {
      const { taps, beats } = this.calib;
      const diffs = [];
      taps.forEach((t) => {
        let best = null;
        beats.forEach((b, idx) => {
          if (idx < 2) return; // 처음 두 박은 박자 잡는 용도라 제외
          const d = t - b;
          if (best === null || Math.abs(d) < Math.abs(best)) best = d;
        });
        if (best !== null && Math.abs(best) <= 250) diffs.push(best);
      });
      this.stopCalibration();
      if (diffs.length < 4) {
        this.calib.message = "입력이 부족합니다. 다시 측정해 주세요";
        return;
      }
      diffs.sort((a, b) => a - b);
      const median = diffs[Math.floor(diffs.length / 2)];
      const value = Math.round(Math.min(200, Math.max(-200, median)));
      this.quickGameSt.audioOffsetMs = value;
      this.calib.message = `측정 결과 ${this.formatOffset(value)} (입력 ${diffs.length}회). Apply를 눌러 저장`;
    },
    stopCalibration() {
      clearTimeout(this.calibTimer);
      if (this.calibCtx) {
        this.calibCtx.close().catch(() => {});
        this.calibCtx = null;
      }
      this.calib.state = "idle";
    },
    clearPreviewTimer() {
      if (this.previewStopTimer) {
        clearTimeout(this.previewStopTimer);
        this.previewStopTimer = null;
      }
      if (this.previewFadeOutTimer) {
        clearTimeout(this.previewFadeOutTimer);
        this.previewFadeOutTimer = null;
      }
    },
    getSongPreviewRange(song) {
      return resolveSongPreviewRange(song, 60);
    },
    async playSelectedSongPreview(song) {
      const audio = this.$store?.state?.audio;
      if (!audio || !song) return;

      const songSrc = song.audioPath || song.url;
      if (!songSrc) return;

      this.previewToken += 1;
      const token = this.previewToken;
      this.clearPreviewTimer();

      const { startSec, durationSec } = this.getSongPreviewRange(song);
      if (durationSec <= 0) return;

      const durationMs = Math.floor(durationSec * 1000);
      const fadeMs = Math.max(250, Math.min(1200, Math.floor(durationMs / 3)));
      const fadeOutStartMs = Math.max(0, durationMs - fadeMs);
      const loopGapMs = 200;

      try {
        await audio.loadSong(songSrc, false);
        if (token !== this.previewToken) return;

        const runPreviewCycle = () => {
          if (token !== this.previewToken) return;

          audio.seek(startSec);
          audio.setVolume(0);
          audio.play();
          audio.fadeIn(fadeMs);

          this.previewFadeOutTimer = setTimeout(() => {
            if (token !== this.previewToken) return;
            audio.fadeOut(fadeMs);
          }, fadeOutStartMs);

          this.previewStopTimer = setTimeout(() => {
            if (token !== this.previewToken) return;
            audio.pause();
            this.previewStopTimer = setTimeout(() => {
              if (token !== this.previewToken) return;
              runPreviewCycle();
            }, loopGapMs);
          }, durationMs);
        };

        runPreviewCycle();
      } catch (error) {
        console.warn("Song preview load failed", error);
      }
    },
    onArtLoad(e) {
      const img = e.target;
      if (img.naturalWidth && img.naturalHeight) {
        this.artRatio = img.naturalWidth / img.naturalHeight;
      }
    },
    hoverSong(index) {
      if (this.selectedIndex !== index) {
        this.$store.state.audio.playHoverEffect("ui/ta");
      }
    },
    selectSong(index, shouldAutoScroll = true) {
      if (!this.songList || this.songList.length === 0) return;
      this.selectedIndex = index;
      this.selectedSong = this.songList[index];
      if (shouldAutoScroll) {
        this.scrollToSelected();
      }
    },
    handleKeydown(e) {
      // [설정] 오프셋 측정 중엔 모든 키를 탭 입력으로 사용(ESC는 측정 취소)
      if (this.calib.state === "running") {
        e.preventDefault();
        if (e.key === "Escape") {
          this.stopCalibration();
          this.calib.message = "측정을 취소했습니다";
        } else if (!e.repeat) {
          this.onCalibrationTap(e);
        }
        return;
      }

      // [모드] Arcade 확인 팝업: ENTER 확인 · ESC 취소(히든 팝업은 2번째 곡 취소). 다른 키는 막음
      if (this.pickConfirm) {
        e.preventDefault();
        if (e.repeat || this.pickAnim) return;
        if (e.key === "Enter" || e.key === " ") this.confirmPick();
        else if (e.key === "Escape" || e.key === "Backspace") this.cancelPick();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        if (this.showQuickSettings) {
          this.closeQuickSettings();
        } else {
          this.openQuickSettings();
        }
        return;
      }

      if (this.showQuickSettings) return;

      if (!this.songList || this.songList.length === 0) return;


      if (e.key === 'ArrowDown') {
        e.preventDefault();
        let next = this.selectedIndex + 1;
        if (next >= this.songList.length) next = 0;
        this.selectSong(next, true);
        this.$store.state.audio.playHoverEffect("ui/ta");
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        let next = this.selectedIndex - 1;
        if (next < 0) next = this.songList.length - 1;
        this.selectSong(next, true);
        this.$store.state.audio.playHoverEffect("ui/ta");
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (this.isArcadePick) {
          this.openPickConfirm();
        } else if (this.sheetList && this.sheetList.length > 0) {
          this.playGame(this.sheetList[0].id);
        }
      } else if (e.key === 'Backspace' && this.isArcadePick) {
        e.preventDefault();
        this.removeLastPick();
      } else if (this.session) {
        // [모드] 진행 중엔 랭킹(R)/대전(V) 이동 막음
        return;
      } else if ((e.key === 'v' || e.key === 'V') && !e.repeat) {
        // [LAN 대전] 대전 로비로
        e.preventDefault();
        this.$router.push('/vs');
      } else if ((e.key === 'r' || e.key === 'R') && !e.repeat) {
        // [축제 랭킹] 선택 곡 랭킹 화면으로
        e.preventDefault();
        const sheet = this.sheetList && this.sheetList[0];
        this.$router.push(sheet ? `/rankings?sheet=${encodeURIComponent(sheet.id)}` : '/rankings');
      }
    },
    scrollToSelected() {
      this.$nextTick(() => {
        const container = this.$refs.listContainer;
        if (!container) return;
        const activeEl = container.querySelector('.song-item.active');
        if (activeEl) {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
      });
    },
    // [모드] Arcade 곡 목록 = 전체 곡에서 이미 고른 곡을 뺀 것(다른 모드는 전체)
    refreshPickList() {
      const all = this.allSongs || [];
      const picked = new Set(this.isArcadePick ? this.arcadePicks.map((p) => p.songId) : []);
      const list = all.filter((s) => !picked.has(s.id));
      const keepId = this.selectedSong && this.selectedSong.id;
      this.songList = list;
      if (!list.length) return;
      const same = list.findIndex((s) => s.id === keepId);
      this.selectSong(same >= 0 ? same : Math.min(this.selectedIndex, list.length - 1), true);
    },
    openPickConfirm() {
      if (this.pickConfirm) return;
      if (this.arcadePicksFull) {
        this.openHiddenOrStart();
        return;
      }
      const song = this.selectedSong;
      const chart = (this.sheetList && this.sheetList[0]) || (song && getChartForSong(song.id));
      if (!song || !chart) return;
      if (this.arcadePicks.some((p) => p.sheetId === chart.id)) return; // 안전장치(목록에서 이미 빠짐)
      this.pickConfirm = {
        sheetId: chart.id,
        songId: song.id,
        title: song.title,
        level: chart.difficulty,
        cover: this.coverImage,
        stageNo: this.arcadePicks.length + 1,
        hidden: false,
      };
      this.$store.state.audio.playEffect("ui/slide2");
    },
    confirmPick() {
      const c = this.pickConfirm;
      if (!c) return;
      if (c.hidden) {
        this.pickConfirm = null;
        this.startArcade();
        return;
      }
      this.pickAnim = true; // SELECTED 도장 → 위로 날아감(CSS)
      this.$store.state.audio.playEffect("ui/slide2");
      setTimeout(() => {
        this.arcadePicks.push({ sheetId: c.sheetId, songId: c.songId, title: c.title, level: c.level });
        this.pickAnim = false;
        this.pickConfirm = null;
        this.refreshPickList();
        if (this.arcadePicks.length >= 3) this.startArcade();
        else if (this.hiddenRule) this.openHiddenOrStart();
      }, PICK_ANIM_MS);
    },
    // 2곡이 히든 조합이면 HIDDEN STAGE 팝업, 아니면(3곡 다 고름) 바로 시작
    openHiddenOrStart() {
      if (this.hiddenRule && this.arcadePicks.length === 2) {
        this.pickConfirm = { title: "???", level: "??", stageNo: 3, hidden: true };
        return;
      }
      this.startArcade();
    },
    cancelPick() {
      const hidden = this.pickConfirm && this.pickConfirm.hidden;
      this.pickConfirm = null;
      if (hidden) this.removeLastPick(); // 히든 팝업에서 뒤로 = 2번째 곡 취소
      this.$store.state.audio.playHoverEffect("ui/ta");
    },
    removeLastPick() {
      if (!this.arcadePicks.length) return;
      this.arcadePicks.pop();
      this.refreshPickList();
      this.$store.state.audio.playHoverEffect("ui/ta");
    },
    startArcade() {
      if (!this.arcadePicksFull) return;
      // 히든 규칙이 맞으면 3번째 곡은 setArcadeQueue가 히든곡으로 채운다
      setArcadeQueue(this.arcadePicks.slice(0, 3).map((p) => p.sheetId));
      this.$store.commit('setPendingGameOptions', {
        randomGimmickMode: this.normalizeRandomGimmickMode(
          this.quickGameSt.randomGimmickMode || this.$store.state.randomGimmickMode
        ),
      });
      this.$store.state.audio.playEffect("ui/slide2");
      this.$router.push(nextRoute());
    },
    playGame(sheetId) {
      // Route to speed setup step before actual game start
      this.$store.commit('setPendingSheetId', sheetId);
      const randomGimmickMode = this.normalizeRandomGimmickMode(
        this.quickGameSt.randomGimmickMode || this.$store.state.randomGimmickMode
      );
      this.$store.commit('setPendingGameOptions', {
        randomGimmickMode,
      });
      this.$store.state.audio.playEffect("ui/slide2");
      this.$router.push(`/speed-setup/${sheetId}`);
    },

    async getAllSongs() {
      if (!this.allSongs) this.allSongs = await getSongListCached();
    },
  },
};
</script>

<style scoped>
.song-select-page {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: var(--dm-bg);
  color: var(--dm-text);
  overflow: hidden;
  font-family: var(--dm-font-body);
}

.bg-blur {
  position: absolute;
  top: -8%;
  left: -8%;
  width: 116%;
  height: 116%;
  background-size: cover;
  background-position: center;
  filter: blur(28px) brightness(0.3) saturate(0.85);
  z-index: 0;
  transition: background-image 0.5s ease-in-out;
}

.bg-lines {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: repeating-linear-gradient(
    115deg,
    rgba(var(--dm-cyan-rgb), 0.05) 0,
    rgba(var(--dm-cyan-rgb), 0.05) 1px,
    transparent 1px,
    transparent 16px
  );
}

.bg-vignette {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: linear-gradient(90deg, rgba(4, 6, 12, 0.92) 0%, rgba(4, 6, 12, 0.35) 45%, rgba(4, 6, 12, 0.7) 100%);
}

/* ---------- top bar ---------- */
.top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 48px;
  border-bottom: 1px solid var(--dm-cyan-dim);
  background: linear-gradient(180deg, rgba(4, 6, 12, 0.9), rgba(4, 6, 12, 0.4));
}

.top-title {
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: 26px;
  letter-spacing: 0.08em;
  display: flex;
  align-items: center;
  gap: 14px;
}

.top-title .slashes {
  color: var(--dm-cyan);
  letter-spacing: -0.05em;
}

.top-hint {
  display: flex;
  gap: 26px;
  font-family: var(--dm-font-display);
  font-weight: 600;
  font-size: 15px;
  letter-spacing: 0.14em;
  color: var(--dm-muted);
}

.top-hint kbd {
  display: inline-block;
  min-width: 18px;
  padding: 1px 7px;
  margin-right: 5px;
  border: 1px solid var(--dm-cyan-dim);
  color: var(--dm-cyan);
  font-family: inherit;
  font-size: 13px;
  text-align: center;
}

/* ---------- layout ---------- */
.layout-container {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  height: 100%;
  padding: 96px 48px 40px;
  gap: 56px;
  box-sizing: border-box;
}

.left-panel {
  flex: 0 0 min(46%, 640px);
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.right-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* ---------- jacket ---------- */
.song-info {
  display: flex;
  flex-direction: column;
  gap: 22px;
  min-height: 0;
}

.jacket-frame {
  /* width / aspect-ratio come from the image's real size (see jacketStyle) */
  width: min(100%, 44vh);
  padding: 2px;
  background: linear-gradient(135deg, var(--dm-cyan) 0%, rgba(var(--dm-cyan-rgb), 0.15) 45%, var(--dm-cyan) 100%);
  clip-path: polygon(0 0, calc(100% - 34px) 0, 100% 34px, 100% 100%, 34px 100%, 0 calc(100% - 34px));
}

.jacket {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  clip-path: polygon(0 0, calc(100% - 33px) 0, 100% 33px, 100% 100%, 33px 100%, 0 calc(100% - 33px));
}

.album-art {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.album-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 60%, rgba(4, 6, 12, 0.55));
}

/* ---------- title ---------- */
.title-block {
  border-left: 5px solid var(--dm-cyan);
  padding-left: 18px;
}

.song-title {
  margin: 0;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: clamp(38px, 6.4vh, 68px);
  line-height: 0.98;
  text-transform: uppercase;
  letter-spacing: 0.01em;
  overflow-wrap: anywhere;
}

.song-artist {
  margin: 8px 0 0;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 600;
  font-size: 24px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--dm-cyan);
}

/* ---------- stats ---------- */
.detail-grid {
  display: flex;
  gap: 14px;
  max-width: 560px;
}

.detail-card {
  flex: 1;
  padding: 8px 16px 8px 18px;
  background: rgba(8, 16, 30, 0.82);
  border-left: 3px solid var(--dm-cyan);
  clip-path: polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%);
}

.detail-card .label {
  display: block;
  font-family: var(--dm-font-display);
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.24em;
  color: var(--dm-muted);
}

.detail-card strong {
  display: block;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 700;
  font-size: 36px;
  line-height: 1.05;
}

/* ---------- start button ---------- */
.play-panel {
  margin-top: 4px;
}

/* [축제 랭킹] 선택 곡 TOP3 */
.mini-rank {
  box-sizing: border-box;
  max-width: 560px;
  padding: 8px 14px;
  background: rgba(5, 10, 20, 0.7);
  border-left: 3px solid var(--dm-cyan);
}
.mini-rank-head {
  font-family: var(--dm-font-display);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.3em;
  color: var(--dm-cyan);
  margin-bottom: 4px;
}
.mini-rank-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  height: 26px;
  font-size: 16px;
}
.mini-rank-pos {
  width: 16px;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  color: var(--dm-cyan);
}
.mini-rank-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mini-rank-group {
  color: var(--dm-muted);
  font-size: 14px;
}
.mini-rank-score {
  width: 96px;
  text-align: right;
  font-family: var(--dm-font-display);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.play-action {
  display: flex;
  align-items: stretch;
  width: 100%;
  max-width: 560px;
  height: 72px;
  padding: 0;
  border: 0;
  cursor: pointer;
  color: #04121c;
  background: var(--dm-cyan);
  clip-path: polygon(20px 0, 100% 0, calc(100% - 20px) 100%, 0 100%);
  font-family: var(--dm-font-display);
  transition: filter 0.15s;
}

.play-action:hover {
  filter: brightness(1.18);
}

.play-mode,
.play-lv {
  display: flex;
  align-items: center;
  justify-content: center;
  font-style: italic;
  font-weight: 800;
  font-size: 34px;
  color: #eaf6ff;
  background: #071a2b;
}

.play-mode {
  padding: 0 18px 0 34px;
  color: var(--dm-cyan);
}

.play-lv {
  padding: 0 34px 0 22px;
  color: var(--dm-amber);
  gap: 6px;
  border-left: 1px solid rgba(var(--dm-cyan-rgb), 0.25);
  clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%);
  margin-right: -14px;
}

.play-lv small {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--dm-muted);
  align-self: flex-end;
  padding-bottom: 14px;
}

.play-go {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding-left: 12px;
  font-style: italic;
  font-weight: 800;
  font-size: 38px;
  letter-spacing: 0.12em;
}

.play-go .chev {
  width: 0;
  height: 0;
  border-top: 11px solid transparent;
  border-bottom: 11px solid transparent;
  border-left: 16px solid #04121c;
}

.empty-state {
  font-family: var(--dm-font-display);
  font-size: 22px;
  letter-spacing: 0.2em;
  color: var(--dm-muted);
}

/* ---------- track list ---------- */
.list-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 0 10px 26px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--dm-cyan-dim);
  font-family: var(--dm-font-display);
  font-weight: 700;
  letter-spacing: 0.24em;
  color: var(--dm-muted);
}

.list-title {
  font-size: 16px;
}

.list-count {
  font-size: 22px;
  color: var(--dm-cyan);
  letter-spacing: 0.1em;
}

.list-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 6px 4px 34px;
  margin-left: -34px;
}

.list-container::-webkit-scrollbar {
  width: 4px;
}

.list-container::-webkit-scrollbar-thumb {
  background: var(--dm-cyan-dim);
}

.song-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 18px;
  height: 66px;
  margin-bottom: 8px;
  padding: 0 40px 0 22px;
  cursor: pointer;
  background: rgba(8, 16, 30, 0.8);
  clip-path: polygon(16px 0, 100% 0, calc(100% - 16px) 100%, 0 100%);
  transition: transform 0.18s ease, background 0.18s;
}

.song-item::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  background: rgba(var(--dm-cyan-rgb), 0.22);
  transition: background 0.18s;
}

.song-item:hover {
  background: rgba(14, 30, 52, 0.9);
}

.song-item.active {
  transform: translateX(-26px);
  background: linear-gradient(90deg, rgba(9, 26, 44, 0.96), rgba(12, 38, 62, 0.96));
}

.song-item.active::before {
  background: var(--dm-cyan);
  width: 8px;
}

.song-index {
  flex: 0 0 34px;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 700;
  font-size: 26px;
  color: var(--dm-muted);
  text-align: center;
}

.song-item.active .song-index {
  color: var(--dm-cyan);
}

.song-item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.song-name {
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 700;
  font-size: 27px;
  line-height: 1.05;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-subtitle {
  font-family: var(--dm-font-display);
  font-weight: 600;
  font-size: 15px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--dm-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-item.active .song-subtitle {
  color: var(--dm-cyan);
}

.song-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-family: var(--dm-font-display);
  font-weight: 700;
  letter-spacing: 0.08em;
}

.song-lv {
  font-size: 18px;
  color: var(--dm-amber);
}

.song-len {
  font-size: 16px;
  color: var(--dm-muted);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.fade-enter {
  opacity: 0;
  transform: translateX(-16px);
}

.fade-leave-to {
  opacity: 0;
}

/* ---------- quick settings popup ---------- */
.quick-settings-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(2, 4, 10, 0.78);
  z-index: 2000;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
  box-sizing: border-box;
}

.quick-settings-panel {
  width: min(920px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  padding: 28px 32px;
  background: var(--dm-panel);
  border-top: 3px solid var(--dm-cyan);
  border-bottom: 1px solid var(--dm-cyan-dim);
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 26px), calc(100% - 26px) 100%, 0 100%);
}

.quick-settings-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 14px;
}

.quick-settings-header h2 {
  margin: 0;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: 32px;
  letter-spacing: 0.08em;
}

.quick-settings-header .hint {
  font-family: var(--dm-font-display);
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--dm-muted);
}

.quick-settings-section {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--dm-cyan-dim);
}

.quick-settings-section h3 {
  margin: 0 0 10px;
  font-family: var(--dm-font-display);
  font-weight: 700;
  font-size: 20px;
  letter-spacing: 0.1em;
  color: var(--dm-cyan);
}

.settings-row {
  display: grid;
  grid-template-columns: 160px 1fr 80px;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.settings-row label {
  font-weight: 500;
  color: var(--dm-muted);
}

.settings-row strong {
  font-family: var(--dm-font-display);
  font-style: italic;
  font-size: 22px;
  text-align: right;
}

.slider-wrap {
  min-width: 0;
}

/* [설정] 체크박스 2열 배치(모바일에선 1열) */
.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
  margin-bottom: 12px;
}

.calib-box {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex-wrap: wrap;
}

.calib-btn {
  padding: 6px 14px;
  white-space: nowrap;
}

.calib-msg {
  color: var(--dm-muted);
  font-size: 13px;
}

.calib-live {
  color: var(--dm-cyan);
  font-weight: 700;
  animation: calib-blink 0.6s steps(2) infinite;
}

@keyframes calib-blink {
  50% {
    opacity: 0.5;
  }
}

.slider-wrap select {
  width: 100%;
  padding: 8px 10px;
  color: var(--dm-text);
  background: #071a2b;
  border: 1px solid var(--dm-cyan-dim);
  border-radius: 0;
  font-family: var(--dm-font-body);
}

/* [LAN] */
.lan-input {
  flex: 1;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  color: var(--dm-text);
  background: #071a2b;
  border: 1px solid var(--dm-cyan-dim);
  font-family: var(--dm-font-body);
  font-size: 15px;
  outline: none;
}
.lan-input:focus {
  border-color: var(--dm-cyan);
}
.lan-found {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: -4px 0 10px 176px;
}
/* [모드] 모드 배지 / Arcade 곡 담기 (색은 변수만) */
.mode-badge {
  margin-left: 18px;
  padding: 2px 14px;
  font-size: 18px;
  letter-spacing: 0.14em;
  color: var(--dm-bg);
  background: var(--dm-cyan);
}
/* 낮은 화면(720p 등)에서 START 버튼이 아래로 잘리지 않게 표지·간격을 줄임 */
@media (max-height: 820px) {
  .jacket-frame {
    width: min(100%, 34vh);
  }
  .song-info {
    gap: 12px;
  }
  .detail-card strong {
    font-size: 28px;
  }
  .play-action {
    height: 60px;
  }
}
/* 칩이 붙어도 상단 바가 한 줄로 유지되게 */
.top-title {
  min-width: 0;
  white-space: nowrap;
}
.pick-chip {
  max-width: 170px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  margin-left: 10px;
  padding: 2px 12px 2px 0;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.04em;
  background: var(--dm-panel);
  border: 1px solid var(--dm-cyan-dim);
  animation: pick-chip-in 0.3s ease-out both;
}
.pick-chip b {
  padding: 2px 9px;
  color: var(--dm-bg);
  background: var(--dm-cyan);
}
.pick-chip.secret {
  color: var(--dm-amber);
  letter-spacing: 0.3em;
}
@keyframes pick-chip-in {
  from {
    opacity: 0;
    transform: translateY(18px) scale(1.3);
  }
}
.pick-overlay {
  position: fixed;
  inset: 0;
  z-index: 1500;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--dm-cyan-rgb), 0.12);
  backdrop-filter: blur(2px);
}
.pick-card {
  position: relative;
  width: min(440px, 86vw);
  padding: 26px 30px 22px;
  box-sizing: border-box;
  text-align: center;
  background: var(--dm-panel);
  border: 1px solid var(--dm-cyan-dim);
  border-top: 6px solid var(--dm-cyan);
  font-family: var(--dm-font-display);
}
.pick-stage {
  display: inline-block;
  padding: 2px 16px;
  font-weight: 800;
  font-size: 20px;
  letter-spacing: 0.24em;
  color: var(--dm-bg);
  background: var(--dm-cyan);
}
.pick-cover {
  width: 220px;
  height: 220px;
  margin: 18px auto 14px;
  overflow: hidden;
  background: #000;
}
.pick-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.pick-cover.secret {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 72px;
  letter-spacing: 0.1em;
  color: var(--dm-amber);
}
.pick-title {
  font-weight: 800;
  font-size: 34px;
  line-height: 1.05;
  overflow-wrap: anywhere;
}
.pick-lv {
  margin-top: 4px;
  font-weight: 700;
  font-size: 20px;
  color: var(--dm-amber);
}
.pick-keys {
  display: flex;
  justify-content: center;
  gap: 22px;
  margin-top: 16px;
  font-weight: 600;
  font-size: 15px;
  letter-spacing: 0.14em;
  color: var(--dm-muted);
}
.pick-keys kbd {
  margin-right: 6px;
  padding: 1px 7px;
  border: 1px solid var(--dm-cyan-dim);
  color: var(--dm-cyan);
  font-family: inherit;
}
.pick-stamp {
  position: absolute;
  left: 50%;
  top: 44%;
  padding: 6px 22px;
  font-weight: 800;
  font-size: 42px;
  letter-spacing: 0.18em;
  color: var(--dm-bg);
  background: var(--dm-amber);
  opacity: 0;
  transform: translate(-50%, -50%) rotate(-8deg) scale(2);
  pointer-events: none;
}
/* 확인: 도장(0~0.25초) → 카드가 줄어들며 위로 날아감(0.3~0.65초) */
.pick-card.selected .pick-stamp {
  animation: pick-stamp 0.25s ease-out both;
}
.pick-card.selected {
  animation: pick-fly 0.35s 0.3s ease-in both;
}
@keyframes pick-stamp {
  to {
    opacity: 1;
    transform: translate(-50%, -50%) rotate(-8deg) scale(1);
  }
}
@keyframes pick-fly {
  to {
    opacity: 0;
    transform: translate(-28vw, -44vh) scale(0.12);
  }
}
.pick-pop-enter-active,
.pick-pop-leave-active {
  transition: opacity 0.15s;
}
.pick-pop-enter,
.pick-pop-leave-to {
  opacity: 0;
}
.catalog-error {
  color: var(--dm-red);
}
.lan-ip {
  color: var(--dm-cyan);
  font-family: var(--dm-font-display);
  font-size: 16px;
  margin-left: 6px;
}

.quick-settings-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 22px;
}

.settings-btn {
  min-width: 120px;
  padding: 10px 26px;
  border: 1px solid var(--dm-cyan-dim);
  color: var(--dm-text);
  background: transparent;
  cursor: pointer;
  font-family: var(--dm-font-display);
  font-weight: 700;
  font-size: 18px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  clip-path: polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%);
}

.settings-btn:hover {
  background: var(--dm-cyan-faint);
}

.settings-btn.save {
  color: #04121c;
  background: var(--dm-cyan);
  border-color: var(--dm-cyan);
}
</style>
