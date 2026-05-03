<template>
  <div id="app" class="unselectable">
    <PageBackground
      v-if="
        $store.state.audio &&
        $route.meta.requireBg &&
        showOnPageRequireSignin &&
        !maintenanceMsg
      "
    ></PageBackground>
    <ModalGlobal ref="gm"></ModalGlobal>
    <FloatingAlert ref="alert"></FloatingAlert>
    <transition name="fade" v-if="$store.state.audio">
      <div class="center" v-if="false"> <h1>{{ maintenanceMsg ? maintenanceMsg.title : '' }}</h1>
        <div v-html="maintenanceMsg ? maintenanceMsg.body : ''"></div>
        <img src="/assets/logo2.png" class="maintenance_logo" />
        <div
          v-if="maintenanceMsg && maintenanceMsg.showUpdateButton"
          class="btn-action btn-dark"
          @click="reload"
        >
          Update
        </div>
        <div style="opacity: 0.2">
          {{ maintenanceMsg ? maintenanceMsg.currentVersion : '' }} - {{ maintenanceMsg ? maintenanceMsg.build : '' }}
        </div>
      </div>
      <keep-alive
        :include="['SongSelect', 'MyStudio']"
        v-else-if="showOnPageRequireSignin && !$store.state.redirecting"
      >
        <router-view class="routerView" :key="$route.path" />
      </keep-alive>
      <div v-else>
        <div class="center blink_me">
          <img src="/assets/logo2.png" class="loading_logo" />
          <div>Logging you in...</div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
// 올바른 경로로 완벽하게 수정됨!
import Audio from "./javascript/audio.js";
import ModalGlobal from "./components/ui/ModalGlobal.vue";
import FloatingAlert from "./components/ui/FloatingAlert.vue";
import PageBackground from "./components/common/PageBackground.vue";
import { logEvent } from "./helpers/analytics";
import semver from "semver";
import "vue-awesome/icons/volume-up";
import "vue-awesome/icons/volume-mute";
import "vue-awesome/icons/expand";
import "vue-awesome/icons/compress";
import "vue-awesome/icons/plus";
import "vue-awesome/icons/redo";
import "vue-awesome/icons/cog";
import "vue-awesome/icons/sign-out-alt";
import "vue-awesome/icons/play";
import "vue-awesome/icons/pause";
import "vue-awesome/icons/arrow-right";

export default {
  name: "App",
  components: {
    ModalGlobal,
    FloatingAlert,
    PageBackground,
  },
  mounted() {
    this.$store.commit("setAudio", new Audio());
    this.$store.commit("setGlobalModal", this.$refs.gm);
    this.$store.commit("setFloatingAlert", this.$refs.alert);
    this.listenToUpdates();
    window.addEventListener("online", this.updateOnlineStatus);
    window.addEventListener("offline", this.updateOnlineStatus);
    this.updateOnlineStatus();
  },
  beforeDestroy() {
    window.removeEventListener("online", this.updateOnlineStatus);
    window.removeEventListener("offline", this.updateOnlineStatus);
  },
  data() {
    return {
      refreshing: false,
      registration: null,
      maintenanceMsg: null,
    };
  },
  methods: {
    updateOnlineStatus(e) {
      if (!e?.type) return;
      const isOnline = e.type === "online" || window.navigator.onLine;
      if (isOnline) this.$store.state.alert.success("You are back online!");
      else this.$store.state.alert.error("No internet connection");
      logEvent("online_status_changed", isOnline, "system");
    },
    listenToUpdates() {
      // 오지랖 넓은 업데이트 감지 기능 주석 처리 (비활성화)
      /*
      document.addEventListener("swUpdated", this.updateAvailable, {
        once: true,
      });

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (this.refreshing) return;
        this.refreshing = true;
        window.location.reload();
      });
      */
    },
    reload() {
      window.location.reload(true);
      logEvent("game_force_updated", null, "system");
    },
    async updateAvailable(event) {
      // 알림 무시
    },
  },
  computed: {
    showOnPageRequireSignin() {
      return (
        !this.$route.meta.requireSignin ||
        (this.$store.state.initialized && this.$route.meta.requireSignin)
      );
    },
  },
  watch: {
    async "$store.state.remoteConfig"(config) {
      if (!config) return;
      const currentVersion = this.$store.state.appVersion;
      const minimumVersion = config.minimumVersion._value;

      // 버전 체크 및 업데이트 알림 강제 차단 (조건문을 모조리 false로 변경)
      if (false) {
      } else if (false) {
      } else if (false) {
      }

      // 게임 화면을 가리는 점검 메시지 변수를 무조건 null로 고정
      this.maintenanceMsg = null;
    },
    $route(to) {
      const pageTitle = to.meta.title ? to.meta.title + " - " : "";
      document.title = pageTitle + "Rhythm+ Music Game";
    },
  },
};
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: 0.5s;
}
.fade-enter, .fade-leave-to {
  opacity: 0;
}

.routerView {
  position: fixed;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  overflow-y: scroll;
}

.maintenance_logo {
  margin-top: 50px;
  max-width: 150px;
  opacity: 0.5;
}

.center a {
  color: rgb(127, 255, 255);
  text-decoration: underline;
}
</style>