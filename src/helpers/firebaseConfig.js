// firebaseConfig.js (축제 오프라인용 완벽 차단 + 에러 방어 버전)

console.log("Firebase 연결 차단됨 (오프라인 시연 모드)");

// 🚨 1. usersCollection 에러 방어: doc().get(), doc().set() 체이닝 대응
const dummyCollection = {
  doc: () => ({
    get: () => Promise.resolve({ exists: false, data: () => ({}) }),
    set: () => Promise.resolve(),
    update: () => Promise.resolve(),
    collection: () => dummyCollection, // 혹시 모를 하위 컬렉션 방어
  }),
  where: () => dummyCollection,
  get: () => Promise.resolve({ docs: [], empty: true }),
};

// 🚨 2. remoteConfig 에러 방어: fetchAndActivate() 대응
const dummyRemoteConfig = {
  fetchAndActivate: () => Promise.resolve(true),
  getValue: () => ({ asString: () => "" }),
};

// 🚨 3. analytics 에러 방어: analytics() 함수 호출 대응
const dummyAnalytics = () => ({
  logEvent: () => {},
  setUserId: () => {},
  setCurrentScreen: () => {},
  setUserProperties: () => {},
});

// 가짜 유저 및 인증 로직 (이전과 동일)
const fakeUser = {
  uid: "festival-admin",
  displayName: "Player 1",
  getIdToken: () => Promise.resolve("festival-token-dummy"),
};
const dummyAuth = {
  currentUser: fakeUser,
  onAuthStateChanged: (callback) => {
    setTimeout(() => {
      callback(fakeUser);
    }, 100);
    return () => {};
  },
  signInAnonymously: () => Promise.resolve({ user: fakeUser }),
  signInWithEmailAndPassword: () => Promise.resolve({ user: fakeUser }),
  getRedirectResult: () => Promise.resolve({ user: fakeUser }),
  signOut: () => Promise.resolve(),
};

const dummyFunc = () => ({});

// export
export const db = dummyCollection;
export const firestore = dummyCollection;
export const analytics = dummyAnalytics; // 수정됨
export const auth = dummyAuth;
export const currentUser = fakeUser;
export const perf = dummyFunc;
export const functions = dummyFunc;
export const usersCollection = dummyCollection; // 수정됨
export const songsCollection = dummyCollection;
export const sheetsCollection = dummyCollection;
export const resultsCollection = dummyCollection;
export const tagsCollection = dummyCollection;
export const playsCollection = dummyCollection;
export const playlistsCollection = dummyCollection;
export const remoteConfig = dummyRemoteConfig; // 수정됨
