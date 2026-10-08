import Vue from "vue";
import VueRouter from "vue-router";
import VueMoment from "vue-moment";
import vuescroll from "vuescroll";
import VueProgressiveImage from "vue-progressive-image";
import VueConfetti from "vue-confetti";
import App from "./App.vue";
import router from "./helpers/router";
import { store } from "./helpers/store";
import { auth, remoteConfig } from "./helpers/firebaseConfig";
import Icon from "vue-awesome/components/Icon";
import { logEvent, logError } from "./helpers/analytics";
import { getLanConfig, applyLanRole } from "./helpers/lan";

import "animate.css";

const isDev = process.env.NODE_ENV === "development";

Logger.useDefaults({ defaultLevel: isDev ? Logger.DEBUG : Logger.ERROR });

Vue.config.productionTip = false;
Vue.config.devtools = isDev;

Vue.use(VueMoment);
Vue.use(VueRouter);
Vue.use(VueProgressiveImage);
Vue.use(VueConfetti);
Vue.use(vuescroll, {
  ops: {
    scrollPanel: {
      scrollingX: false,
    },
    bar: {
      background: "#ffffff",
      opacity: 0.3,
    },
  },
  name: "v-bar",
});

Vue.component("v-icon", Icon);

const consoleHandler = Logger.createDefaultHandler();
Logger.setHandler((messages, context) => {
  consoleHandler(messages, context);
  if (context.level.value > Logger.WARN.value) {
    // ERROR level
    logError(messages[0]);
  }
});

// [LAN] 이 PC가 호스트로 설정돼 있으면 앱 시작 때 축제 서버를 켬(설정 안 했으면 아무것도 안 함)
if (getLanConfig().role === "host") {
  applyLanRole().then((r) => r && !r.ok && Logger.warn("LAN host start failed", r.error));
}

new Vue({
  router,
  store,
  created() {
    auth.onAuthStateChanged(async (user) => {
      if (this.$store.state.redirecting) {
        Logger.warn("User state change discarded", user);
        return;
      }
      Logger.log("User state changed", user);
      await this.$store.commit("setCurrentUser", user);
      if (!user && !this.$store.state.redirecting) {
        Logger.warn("User not logged in, creating anonymous profile...");
        auth.signInAnonymously().catch((error) => {
          Logger.error(error.message);
        });
        logEvent("anonymous_signin");
      }
      // log jwt, dev purpose only
      if (isDev) {
        user.getIdToken().then((jwt) => {
          Logger.log("JWT", jwt);
        });
      }
    });
    remoteConfig
      .fetchAndActivate()
      .then(() => {
        const config =
          typeof remoteConfig?.getAll === "function" ? remoteConfig.getAll() : {};
        this.$store.commit("setRemoteConfig", config);
        Logger.log("got config", config);
      })
      .catch((err) => {
        Logger.error(err);
      });
  },
  render: (h) => h(App),
}).$mount("#app");

console.log(
  "%cThank you for playing Rhythm Plus! This game is still under active development, if you have spotted a bug or have feedback, please don't hesitate to submit an issue on GitHub linked below. This is a free open source project, a star is always appreciated, thank you for your support :) https://github.com/henryz00/Rhythm-Plus-Music-Game",
  "color: #faaf4e; font-weight: bold;"
);
