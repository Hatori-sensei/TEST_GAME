<template>
  <transition name="modal-fade">
    <div class="modal-backdrop" v-if="show">
      <div class="center">
        <div class="scoreCircle">
          <div class="num">{{ num }}</div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
export default {
  name: "Countdown",
  data() {
    return {
      show: false,
      interval: null,
      num: 3,
    };
  },
  methods: {
    start() {
      clearInterval(this.interval);
      this.num = 3;
      this.show = true;
      this.interval = setInterval(() => {
        this.num -= 1;
        if (this.num <= 0) {
          this.clear();
        }
      }, 1000);
    },
    clear(emitFinish = true) {
      this.show = false;
      clearInterval(this.interval);
      if (emitFinish) {
        this.$emit("finish");
      }
    },
  },
  watch: {
    num(val) {
      if (val > 0) this.$store.state.audio.playEffect("ui/event");
    },
  },
};
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  display: flex; justify-content: center; align-items: center;
  background: rgba(0,0,0,0.5);
  z-index: 1000;
}
.scoreCircle {
  width: 150px; height: 150px;
  border-radius: 50%;
  border: 10px solid #ffab2d;
  display: flex; justify-content: center; align-items: center;
  background: rgba(0,0,0,0.7);
}
.num {
  font-size: 4em;
  font-weight: bold;
  color: white;
}
</style>