// [LAN] 렌더러에 노출하는 최소 API(contextIsolation 유지, Node 기능은 직접 노출 안 함).
// 브라우저 개발 모드(npm start)에는 이 파일이 없으므로 window.djonLan 이 undefined → LAN 메뉴 비활성.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("djonLan", {
  startHost: (opts) => ipcRenderer.invoke("djon-lan:startHost", opts),
  stopHost: () => ipcRenderer.invoke("djon-lan:stopHost"),
  status: () => ipcRenderer.invoke("djon-lan:status"),
  discover: (ms) => ipcRenderer.invoke("djon-lan:discover", ms),
  request: (opts) => ipcRenderer.invoke("djon-lan:request", opts),
  subscribe: (addr) => ipcRenderer.invoke("djon-lan:subscribe", addr),
  unsubscribe: () => ipcRenderer.invoke("djon-lan:unsubscribe"),
  // 호스트 방송(SSE) 수신. 반환값을 호출하면 수신 해제
  onEvent: (cb) => {
    const handler = (_e, msg) => cb(msg && msg.event, msg && msg.data);
    ipcRenderer.on("djon-lan:event", handler);
    return () => ipcRenderer.removeListener("djon-lan:event", handler);
  },
});
