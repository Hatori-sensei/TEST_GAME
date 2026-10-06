import Vue from "vue";
import Vuex from "vuex";
import { usersCollection, auth } from "./firebaseConfig";
import { logEvent, setUserId, setUserProps } from "./analytics";
import md5 from "js-md5";
import { hasSavedSettings, loadSettings, toGameSt } from "./settings";

Vue.use(Vuex);

const isDev = process.env.NODE_ENV === "development";

// [설정 저장] 저장된 로컬 설정이 있으면 시작 시 userProfile/배속에 반영.
// 저장된 설정이 없으면 아무것도 넣지 않아 기존 동작과 완전히 같다.
const savedSettings = hasSavedSettings() ? loadSettings() : null;
const initialUserProfile = savedSettings
  ? {
      gameSt: toGameSt(savedSettings),
      preference: savedSettings.keyMap ? { keyMap: { ...savedSettings.keyMap } } : {},
    }
  : {};

export const store = new Vuex.Store({
  state: {
    audio: null,
    gModal: null,
    bg: null,
    currentUser: null,
    userProfile: initialUserProfile,
    profilePicture: null,
    authed: false,
    verified: false,
    initialized: false,
    isFullscreen: false,
    visualizerArr: null,
    visualizerIns: null,
    theme: null,
    redirecting: false,
    ytVars: {
      controls: 0,
      rel: 0,
      playsinline: 1,
      disablekb: 1,
      autoplay: 0,
      modestbranding: 1,
      nocookie: true,
      fs: 0,
    },
    appVersionWithPrefix: `${process.env.VERSION_PREFIX}-${process.env.APP_VERSION}`,
    appVersion: process.env.APP_VERSION,
    build: process.env.COMMIT_HASH + (isDev ? "-dev-build" : ""),
    isDev,
    remoteConfig: null,
    // Game play settings
    speedMultiplier: savedSettings?.noteSpeed ?? 1.0,
    pendingSheetId: null,
    pendingGameOptions: null,
    randomGimmickMode: "off",
    // 오토플레이(시연용). 실수로 켜둔 채 축제 운영되지 않도록 저장하지 않고 이번 실행에만 유지.
    autoPlay: false,
  },
  actions: {
    async fetchUserProfile() {
      if (this.state.currentUser && !this.state.currentUser.isAnonymous) {
        await this.dispatch("updateUserProfile");
        await this.dispatch("fetchProfilePicture");
      } else {
        this.commit("setUserProfile", null);
        this.commit("setProfilePciture", null);
        this.commit("setTheme");
      }
      this.state.initialized = true;
    },
    async fetchProfilePicture({ commit, state }) {
      if (state.currentUser) {
        let url = state.currentUser.photoURL;
        if (url) {
          commit("setProfilePciture", url);
        } else if (state.currentUser.email) {
          let hash = md5(state.currentUser.email);
          let gravatar_link =
            "https://www.gravatar.com/avatar/" + hash + "?s=50&d=404";
          let response = await fetch(gravatar_link);
          if (response.status === 200) {
            commit("setProfilePciture", gravatar_link);
          } else {
            commit("setProfilePciture", null);
          }
        } else {
          commit("setProfilePciture", null);
        }
      }
    },
    async updateUserProfile({ commit, state }) {
      if (state.currentUser) {
        try {
          const res = await usersCollection.doc(state.currentUser.uid).get();
          let data = res.data();
          // [버그수정] 오프라인 모드에선 서버(가짜 firestore)가 항상 빈 객체를 돌려주는데,
          // 이걸로 userProfile을 통째로 바꿔서 결과 화면에 들어갈 때마다(이 액션 호출)
          // 곡 선택 화면에서 적용한 키 배치/키 빔/노트 이펙트 설정이 초기화됐음.
          // 기존 값 위에 받아온 값을 덮어쓰는 방식(merge)으로 변경.
          commit("setUserProfile", { ...(state.userProfile || {}), ...(data || {}) });
          commit("setTheme");
          logEvent("app_initialized", null, "system");
        } catch (err) {
          Logger.error(err);
        }
        // update display name and photo for first time login
        const user = auth.currentUser;
        const providerDisplayName =
          state.currentUser.providerData?.[0]?.displayName;
        let reloadRequired = false;
        if (!state.currentUser.displayName && providerDisplayName) {
          state.redirecting = true;
          await user.updateProfile({ displayName: providerDisplayName });
          reloadRequired = true;
          Logger.warn("Display name updated using provider data");
        }
        const providerPhoto = state.currentUser.providerData?.[0]?.photoURL;
        if (!state.currentUser.photoURL && providerPhoto) {
          state.redirecting = true;
          await user.updateProfile({ photoURL: providerPhoto });
          Logger.warn("Photo URL updated using provider data");
          reloadRequired = true;
        }
        Logger.log(user, state.userProfile);
        if (
          user.photoURL !== state.userProfile.photoURL ||
          user.displayName !== state.userProfile.displayName
        ) {
          await usersCollection
            .doc(user.uid)
            .set(
              { photoURL: user.photoURL, displayName: user.displayName },
              { merge: true }
            );
          state.userProfile.displayName = user.displayName;
          state.userProfile.photoURL = user.photoURL;
          Logger.warn("user profile updated");
        }
        if (reloadRequired) window.location.reload();
      }
    },
  },
  mutations: {
    setCurrentUser(state, val) {
      state.authed = val && !val.isAnonymous && val.providerData?.length > 0;
      state.verified = state.authed && val.emailVerified;
      state.currentUser = val;
      this.dispatch("fetchUserProfile");
      if (!val) return;
      const { uid, displayName, emailVerified, isAnonymous } = val;
      setUserId(uid);
      setUserProps({
        displayName,
        emailVerified,
        isAnonymous,
      });
    },
    setUserProfile(state, val) {
      state.userProfile = val;
      if (val && val.exp) {
        let level = calculateUserLevel(val.exp);
        state.userProfile.lvBefore = state.userProfile.lv ?? level;
        state.userProfile.lv = level;
        state.userProfile.lvd = Math.floor(level);
        if (val.appearanceSt?.syncYoutube) state.ytVars.nocookie = false;
      }
    },
    setTheme(state) {
      // set themes
      const darkPurple = {
        visualizer: "purpleSpace",
        buttonStyle: "colored",
        logoAsset: "logo2.png",
      };
      const flameOrange = {
        visualizer: "space",
        buttonStyle: "",
        logoAsset: "logo.png",
      };
      const userTheme = state.userProfile?.appearanceSt;
      state.theme =
        userTheme?.theme === "flameOrange" ? flameOrange : darkPurple;
      if (userTheme) {
        state.theme.visualizer = userTheme.visualizer;
        state.theme.blur = userTheme.blur;
        state.theme.themeStyle = userTheme.options?.themeStyle;
      }
    },
    setProfilePciture(state, val) {
      state.profilePicture = val;
    },
    setAudio(state, val) {
      state.audio = val;
    },
    setGlobalModal(state, val) {
      state.gModal = val;
    },
    setFloatingAlert(state, val) {
      state.alert = val;
    },
    setBackground(state, val) {
      state.bg = val;
    },
    setVisualizerArr(state, val) {
      state.visualizerArr = val;
    },
    setVisualizerIns(state, val) {
      state.visualizerIns = val;
    },
    setRemoteConfig(state, val) {
      state.remoteConfig = val;
    },
    setSpeedMultiplier(state, val) {
      // clamp to reasonable range
      const v = Math.max(0.5, Math.min(8.0, Number(val) || 1.0));
      state.speedMultiplier = v;
    },
    setPendingSheetId(state, val) {
      state.pendingSheetId = val;
    },
    setPendingGameOptions(state, val) {
      state.pendingGameOptions = val && typeof val === "object" ? { ...val } : null;
    },
    setAutoPlay(state, val) {
      state.autoPlay = !!val;
    },
    setRandomGimmickMode(state, val) {
      const mode = String(val || "off").toLowerCase();
      const allowed = ["off", "speed", "lane", "both"];
      state.randomGimmickMode = allowed.includes(mode) ? mode : "off";
    },
    async toggleFullscreen(state) {
      state.isFullscreen = document.fullscreen;
      if (state.isFullscreen) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
      state.isFullscreen = document.fullscreen;
    },
    checkFullscreen(state) {
      state.isFullscreen = document.fullscreen;
    },
  },
});

function calculateUserLevel(exp) {
  //ref https://stackoverflow.com/questions/6954874/
  const lvInc = 10;
  return (Math.sqrt(lvInc * lvInc + 100 * exp) - lvInc) / 30 + 1;
}

// partly ref https://savvyapps.com/blog/definitive-guide-building-web-app-vuejs-firebase
