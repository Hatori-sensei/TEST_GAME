<template>
  <!-- [LAN] 여러 PC 연결 설정(역할/PC 이름/호스트 주소). 곡 선택 ESC 설정과 VS 화면이 같이 쓴다.
       value = { role, host, pcName } (v-model). standalone이면 자체 APPLY 버튼으로 저장 + 적용 후 "applied" -->
  <div class="lan-panel">
    <div v-if="!available" class="lan-msg">설치된 앱(exe)에서만 사용할 수 있어요. (지금은 브라우저 개발 모드)</div>
    <template v-else>
      <div class="lan-row">
        <label>역할</label>
        <div class="lan-roles">
          <button
            v-for="r in roles"
            :key="r.id"
            class="lan-role"
            :class="{ on: form.role === r.id }"
            @click="set('role', r.id)"
          >
            {{ r.label }}<small>{{ r.sub }}</small>
          </button>
        </div>
      </div>
      <div class="lan-row" v-if="form.role !== 'off'">
        <label for="lanPcName">PC 이름</label>
        <input
          id="lanPcName"
          class="lan-input"
          :value="form.pcName"
          maxlength="12"
          placeholder="예: 1번 PC"
          @input="set('pcName', $event.target.value)"
        />
      </div>
      <div class="lan-row" v-if="form.role === 'client'">
        <label for="lanHostAddr">호스트 주소</label>
        <div class="lan-box">
          <input
            id="lanHostAddr"
            class="lan-input"
            :value="form.host"
            maxlength="64"
            placeholder="예: 192.168.0.10"
            @input="set('host', $event.target.value)"
          />
          <button class="lan-btn" :disabled="busy" @click="findHosts">찾기</button>
          <button class="lan-btn" :disabled="busy || !form.host" @click="testHost">연결 확인</button>
        </div>
      </div>
      <div class="lan-found" v-if="form.role === 'client' && found.length">
        <button v-for="h in found" :key="h.address" class="lan-btn" @click="set('host', h.address)">
          {{ h.name }} · {{ h.address }}
        </button>
      </div>
      <div class="lan-msg" v-if="form.role === 'host'">
        다른 PC에서 "찾기"를 누르거나 이 주소를 입력:
        <strong class="lan-ip">{{ ips.length ? ips.join(" / ") : "(네트워크 연결 없음)" }}</strong>
      </div>
      <div class="lan-msg" v-if="message">{{ message }}</div>
      <div class="lan-actions" v-if="standalone">
        <button class="lan-btn main" :disabled="busy || !canApply" @click="apply">APPLY</button>
      </div>
    </template>
  </div>
</template>

<script>
import { saveSettings } from "../../helpers/settings";
import { isLanAvailable, applyLanRole, lanStatus, discoverHosts, pingHost } from "../../helpers/lan";

export default {
  name: "LanSetupPanel",
  props: {
    value: { type: Object, required: true }, // { role: "off"|"host"|"client", host, pcName }
    standalone: { type: Boolean, default: false },
  },
  data() {
    return {
      form: { ...this.value },
      available: isLanAvailable(),
      busy: false,
      found: [],
      ips: [],
      message: "",
      roles: [
        { id: "off", label: "사용 안 함", sub: "OFF" },
        { id: "host", label: "호스트", sub: "이 PC가 서버" },
        { id: "client", label: "참가", sub: "호스트에 연결" },
      ],
    };
  },
  watch: {
    value(v) {
      this.form = { ...v };
    },
  },
  computed: {
    canApply() {
      return this.form.role !== "client" || !!String(this.form.host || "").trim();
    },
  },
  async mounted() {
    const st = await lanStatus();
    if (st) {
      this.ips = st.ips.map((ip) => `${ip}:${st.port}`);
      if (this.form.role === "host") this.message = st.hosting ? "호스트 실행 중" : "호스트가 꺼져 있어요(적용하면 켜짐)";
    }
  },
  methods: {
    // 입력값은 자체 사본(form)에 모아서 통째로 보냄(연달아 바뀌어도 앞의 값이 사라지지 않게)
    set(key, v) {
      this.form = { ...this.form, [key]: v };
      this.$emit("input", { ...this.form });
    },
    async findHosts() {
      this.busy = true;
      this.message = "같은 네트워크에서 호스트를 찾는 중...";
      this.found = await discoverHosts(1500);
      this.message = this.found.length
        ? "찾은 호스트를 눌러 선택하세요"
        : "못 찾았어요. 호스트 PC 화면의 주소를 직접 입력하세요(방화벽/같은 공유기 확인)";
      if (this.found.length === 1) this.set("host", this.found[0].address);
      this.busy = false;
    },
    async testHost() {
      this.busy = true;
      this.message = "연결 확인 중...";
      const r = await pingHost(String(this.form.host || "").trim());
      this.message = r.ok ? `연결됨: ${r.name} · 기록 ${r.records}개 · ${r.rttMs}ms` : `연결 실패: ${r.error}`;
      this.busy = false;
    },
    // standalone(VS 화면): 저장 + 호스트 서버 켜기/끄기 → applied
    async apply() {
      this.busy = true;
      saveSettings({
        lanRole: this.form.role,
        lanHost: String(this.form.host || "").trim(),
        pcName: String(this.form.pcName || "").trim(),
      });
      const r = await applyLanRole();
      this.busy = false;
      if (r && !r.ok) {
        this.message = `적용 실패: ${r.error}`;
        return;
      }
      this.$emit("applied");
    },
  },
};
</script>

<style scoped>
.lan-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.lan-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  align-items: center;
  gap: 16px;
}
.lan-row label {
  color: var(--dm-muted);
}
.lan-roles {
  display: flex;
  gap: 8px;
}
.lan-role {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 8px 14px;
  cursor: pointer;
  color: var(--dm-text);
  background: transparent;
  border: 1px solid var(--dm-cyan-dim);
  font-family: var(--dm-font-display);
  font-weight: 700;
  font-size: 18px;
}
.lan-role small {
  font-family: var(--dm-font-body);
  font-weight: 400;
  font-size: 12px;
  color: var(--dm-muted);
}
.lan-role.on {
  color: var(--dm-bg);
  background: var(--dm-cyan);
  border-color: var(--dm-cyan);
}
.lan-role.on small {
  color: var(--dm-bg);
}
.lan-box {
  display: flex;
  gap: 8px;
  min-width: 0;
}
.lan-input {
  flex: 1;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  color: var(--dm-text);
  background: var(--dm-bg);
  border: 1px solid var(--dm-cyan-dim);
  font-family: var(--dm-font-body);
  font-size: 15px;
  outline: none;
}
.lan-input:focus {
  border-color: var(--dm-cyan);
}
.lan-btn {
  padding: 6px 14px;
  white-space: nowrap;
  cursor: pointer;
  color: var(--dm-text);
  background: transparent;
  border: 1px solid var(--dm-cyan-dim);
  font-family: var(--dm-font-display);
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.1em;
}
.lan-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.lan-btn.main {
  min-width: 160px;
  padding: 10px 26px;
  font-size: 18px;
  color: var(--dm-bg);
  background: var(--dm-cyan);
  border-color: var(--dm-cyan);
}
.lan-found {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: 136px;
}
.lan-msg {
  color: var(--dm-muted);
  font-size: 13px;
}
.lan-ip {
  margin-left: 6px;
  color: var(--dm-cyan);
  font-family: var(--dm-font-display);
  font-size: 16px;
}
.lan-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
