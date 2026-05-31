<template>
  <div class="gameover-container">
    <!-- 🚨 핵심: 화면 전체를 덮고 있다가 브라운관 TV처럼 찌그러지며 꺼지는 오버레이 -->
    <div class="crt-turn-off-overlay"></div>

    <PageBackground
      songSrc="https://assets.rhythm-plus.com/bgm/nomyn-flow.mp3"
      imageSrc="black"
      :showNav="false"
    ></PageBackground>
    
    <video autoplay muted loop class="bgVid">
      <source
        src="https://assets.rhythm-plus.com/video/blue_paint.mp4"
        type="video/mp4"
      />
    </video>
    
    <!-- 🚨 TV 꺼짐 연출이 끝난 직후에 나타날 텍스트와 버튼들 -->
    <div class="center content-wrapper">
      <div class="gameover">Game Over</div>
      <div
        class="btn-action btn-dark"
        @click="replay"
        v-if="$route.params.sheetId"
      >
        <v-icon name="redo" />
        <span>Replay</span>
      </div>
      <div class="btn-action btn-dark" @click="toMenu">
        <v-icon name="arrow-right" />
        <span>Continue</span>
      </div>
    </div>
  </div>
</template>

<script>
import PageBackground from "../components/common/PageBackground.vue";

export default {
  name: "GameOverScreen",
  components: { PageBackground },
  mounted() {
    this.$store.state.audio.playEffect("whoosh");
  },
  methods: {
    replay() {
      this.$router.push("/game/" + this.$route.params.sheetId);
    },
    toMenu() {
      this.$router.push("/menu/");
    },
  },
};
</script>

<style scoped>
/* =======================================================
   🚨 게임 오버 화면: TV 켜짐 (가로선 -> 위아래 확장)
   ======================================================= */
.gameover-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: black;
  
  /* 화면 전체가 가로선에서 위아래로 펼쳐짐 */
  transform-origin: center center;
  animation: crt_on_expand 0.4s cubic-bezier(0.23, 1, 0.32, 1) forwards;
}

@keyframes crt_on_expand {
  0% {
    transform: scale(1, 0.002); /* 극단적으로 얇은 가로선 */
    filter: brightness(10);
  }
  40% {
    transform: scale(1, 0.01); /* 선이 아주 살짝 두꺼워지며 뜸 들임 */
    filter: brightness(8);
  }
  100% {
    transform: scale(1, 1); /* 위아래로 쫙 펼쳐짐 */
    filter: brightness(1);
  }
}

/* =======================================================
   🚨 UI 및 텍스트 페이드 인 (화면 펴진 후 등장)
   ======================================================= */
/* =======================================================
   🚨 UI 및 텍스트 페이드 인 (화면 정중앙 고정 + 등장 연출)
   ======================================================= */
.content-wrapper {
  position: absolute;
  top: 50%;
  left: 50%;
  opacity: 0;
  animation: ui_fade_in 0.6s 0.4s forwards; 
  
  /* 버튼과 글씨가 가운데 예쁘게 모이도록 플렉스 정렬 추가 */
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100vw;
}

@keyframes ui_fade_in {
  from { 
    opacity: 0; 
    /* 🚨 중앙 정렬(-50%)을 유지한 상태에서 살짝 아래(+20px)에서 출발 */
    transform: translate(-50%, calc(-50% + 20px)); 
  }
  to { 
    opacity: 1; 
    /* 🚨 완벽한 화면 정중앙 고정 */
    transform: translate(-50%, -50%); 
  }
}
.bgVid {
  position: absolute;
  left: 0;
  bottom: 0;
  min-width: 100%;
  min-height: 100%;
}

.gameover {
  font-size: 8em; 
  color: white;
  margin-bottom: 70px;
  width: 100vw;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  text-shadow: 0px 0px 10px rgba(255, 0, 0, 1), 
               0px 0px 30px rgba(255, 0, 0, 0.8), 
               0px 0px 60px rgba(200, 0, 0, 0.5);
}

.btn-dark {
  background-color: rgba(0, 0, 0, 0.384);
}
.btn-dark:hover {
  background-color: white;
}
.fa-icon {
  vertical-align: middle;
  margin-right: 5px;
}

@media screen and (max-width: 600px) {
  .gameover {
    font-size: 5.5em;
  }
  .bgVid {
    left: -150%;
    min-width: 200vw;
  }
}
</style>