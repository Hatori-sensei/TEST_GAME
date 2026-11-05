<template>
  <!-- [팔레트] 강조색 고르기(색 칩 5개). v-model = 팔레트 id. 설정(ESC)과 Arcade 입장 화면이 같이 씀 -->
  <div class="pal-chips" role="radiogroup">
    <button
      v-for="p in palettes"
      :key="p.id"
      type="button"
      class="pal-chip"
      :class="{ on: value === p.id }"
      :style="{ '--chip': p.accent }"
      role="radio"
      :aria-checked="value === p.id"
      @click="$emit('input', p.id)"
    >
      <i></i>{{ p.name }}
    </button>
  </div>
</template>

<script>
import { PALETTES } from "../../helpers/palette";

export default {
  name: "PaletteChips",
  props: {
    value: { type: String, default: "orange" },
  },
  data() {
    return { palettes: Object.values(PALETTES) };
  },
};
</script>

<style scoped>
.pal-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.pal-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 8px;
  cursor: pointer;
  color: var(--dm-text);
  background: transparent;
  border: 2px solid var(--dm-cyan-dim);
  font-family: var(--dm-font-display);
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.12em;
}
.pal-chip i {
  width: 18px;
  height: 18px;
  background: var(--chip);
}
.pal-chip.on {
  border-color: var(--chip);
  box-shadow: 4px 4px 0 var(--chip);
}
</style>
