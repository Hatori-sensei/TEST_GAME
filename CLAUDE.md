# 프로젝트 인수인계: DJ@ON (학교 축제용 리듬게임)

## 응답 규칙
- 항상 한국어로 답변할 것. 코드, 파일 경로, 명령어, 에러 메시지는 원문 그대로 두되 설명은 한국어로 쓴다.

## 개요
- 경로: C:\Users\user\TEST_GAME (git 브랜치 master)
- 원작 웹 리듬게임 "Rhythm Plus"를 변형한 것. Vue 2 + webpack 5 + Howler + Electron 25 + electron-builder
- 오프라인 축제 시연용이라 Firebase는 firebaseConfig.js에서 가짜 객체로 대체되어 있고, 곡/채보는 src/javascript/localCatalog.js, db.js에 있음. 곡 6개(kamui, 초 나이트 오브 나이츠, the EmpErroR, Mammal, Do it, Apollo).
- 기록은 브라우저/앱 저장소(로컬)에만 남음. 결과(result)는 메모리에만 있어서 결과 화면(/result/..)에서 새로고침하면 사라짐(오류 팝업이 뜸, 정상).
- 위 변경은 모두 커밋됨: `c18d4ce`(축제용 엔진/디자인/배포 정리, 삭제 파일 24개 포함), `7102b64`(채보 JSON 로딩 public/charts/*.json, 키 배치 버그 수정, 결과/설정 화면 다듬기). 원격 master에 반영되어 있음.

## 절대 건드리지 말 것 (사용자 지시)
- 판정선 위치(Game.vue `.judgment-line`: bottom 320px, height 18px)와 캔버스 판정선(checkHitLineY = canvas.height - 320)
- 기어 너비(500px, 레인 125px x 4). 디자인은 색/그림만 변경 가능.

## 게임 로직 변경 (src/javascript/{note,track,gameInstance}.js, Game.vue)
- note.js의 죽은 판정 코드 삭제. 판정 계산은 track.js `_calculateJudgePercent` 한 곳.
- `missed` 플래그 추가(noteFailed는 "제거 대상" 의미로만 사용). 롱노트를 일찍 떼거나 못 치면 밝은 회색으로 계속 내려감. 롱노트 끝에 릴리즈용 노트 블록 추가 표시(그림만, 판정 무관).
- 노트 스폰: 시작 시 전체 생성 → 매 프레임 `gameTimingLoop()`가 화면 위치(visualPos 거리) 기준으로 순차 스폰(기믹/배속에서도 갑자기 생기지 않게).
- 곡 시작 전 2초 리드인(LEAD_IN_SEC, 음수 시간으로 노트가 내려옴). 채보 에디터(playMode false)는 제외.
- 재시작 버그 수정: loadAudio에서 캐시된 Howl은 load가 생성자 안에서 끝나 Promise가 영원히 안 끝났음 → `state()==="loaded"`면 즉시 resolve.
- 창 리사이즈 중에도 reposition(캔버스는 실제 컨테이너 크기 기준 + 200ms 뒤 재측정), 영상 싱크는 드리프트 200ms 이상 + 500ms 쿨다운으로만 보정.
- FPS 표시(gameInstance.js `SHOW_FPS`), 체력 회복량 감소(완벽 +6, 좋음 +3, 롱 완벽 +3; 미스 -9 그대로), 기어 배경 불투명도 0.8.

## Electron / 배포
- background.js 재작성: `app://` 프로토콜(SPA 폴백, Range 지원), 곡/영상은 resources/public에서 서빙, 기본 전체화면, F11 토글, F12/줌/새로고침 차단, 단일 인스턴스. 플래그 `--windowed`, `--rp-debug`. nodeIntegration 꺼짐.
- package.json 스크립트: `electron:dev`, `electron:prod`(dist를 exe와 같게 테스트), `electron:pack`, `electron:build`(설치 파일 + 포터블은 build_exe/).
- **`build.nsis.preCompressedFileExtensions: []`는 지우면 안 됨**(nsis+portable 동시 빌드 시 포터블에서 mp4가 빠지는 electron-builder 문제 회피).
- 이 PC에서는 winCodeSign 심볼릭 링크 오류를 캐시 수동 복사로 우회함. 다른 PC에서 같은 오류가 나면 Windows 개발자 모드 또는 관리자 권한.
- 원래 코드 버그 수정: router.js 캐치올 무한 리다이렉트, pathResolver 상대경로(./songs)를 절대경로로, audio.js의 localhost:3000 고정 제거, Sentry(원작자 DSN) 제거, index.html의 jQuery/gtag 외부 로드 제거(window.gtag는 no-op 스텁).
- 영상 6개를 ffmpeg로 재압축(293MB → 162MB, 720p H.264, 오디오 트랙 제거). mp3는 싱크 문제 때문에 일부러 안 건드림.
- 마지막 exe 빌드는 디자인 변경 **이전**에 검증함. 디자인 이후 `npm run build`(웹팩)만 통과 확인했고 exe 재빌드는 안 함.

## 정리(삭제)한 것
DemoGame.vue와 옛 엔진(src/gameInstance.js, track.js, note.js), 미사용 컴포넌트 5개, 루트 track.js, vue.config.js, server.js(Express 미디어 서버), apply-neon-patch.bat, gameplay.gif, 서비스워커/offline.html/_redirects 등. 의존성 제거: axios, hammerjs, vue-smooth-reflow, register-service-worker, @sentry/*, vue2-circle-progress, express.

## 디자인 (DJMAX RESPECT V 느낌: 각진 모서리, 청록 #19d3ff, 이탤릭 대문자, 검은 배경)
- 공통: public/style.css의 `:root` 변수(--dm-cyan, --dm-font-display 등), 폰트는 public/fonts의 Barlow/Barlow Condensed(오프라인용 woff2 8개). 전역 `.modal`, `.btn-action` 각진 스타일. 아이콘은 `.btn-action .fa-icon { fill: currentColor }`.
- 완료: Home(시작), SongSelect, SpeedSetup, Game(기어/노트/HUD/점수/세로 라이프 바), GameLoadingScreen(신규 컴포넌트, "Song Loading..." 대체, 최소 1.8초), Modal/일시정지 메뉴(Advanced 항목 삭제), GameOver, Result(계정 안내 카드 삭제).
- 판정 텍스트 색상: 클래스명 버그를 고쳐 judge-max/high/mid/low/break로 색 구분.
- 곡 선택 표지는 이미지 실제 비율에 맞춰 표시(onArtLoad에서 artRatio 계산).
- 남은 화면(미디자인): 설정/계정(Auth), 채보 에디터, MyStudio, Rankings, Navbar 등.

## 알려진 문제 / 다음 후보
1. /account, /editor는 Firebase가 가짜라 열면 콘솔 오류(원래 있던 문제). 축제용이면 이 화면들 + 관련 파일 삭제를 검토(메뉴에서 연결된 버튼도 정리 필요).
2. audio.js, db.js에 원작 서버 주소(assets.rhythm-plus.com)가 남아 있음(현재 영향 없음).
3. 터치 키오스크로 운영하면 오디오 언락이 keydown/mousedown에만 걸려 있음(Electron은 autoplay 정책으로 해결됨, 브라우저는 미확인).
4. 실제 축제 PC 해상도/모니터에서 판정선 정렬, 기록 유지 여부, 장시간 구동 확인 필요.
5. exe 재빌드 후 전체 플레이 확인, 저작권(곡/영상, 원작 라이선스) 확인.
6. 남은 잡일: `.claude/launch.json`(불필요, 삭제 가능), `.husky`/`.github`/firebase.json은 손대지 않음. ESLint의 prettier 경고는 기존(줄바꿈 CRLF)이라 무시.

## 2026-10 점검 (브랜치 claude/pensive-hopper-pj91pf, 상세: docs/점검보고서_2026-10.md)
- 버그 수정: 시작 전/종료 중 ESC 이중 재생, 카운트다운 중 blur, blur 시 키/롱노트 상태 잔류, Restart 중복 노트, Game 리스너 누수, 결과 화면이 설정 초기화, 효과음 0% 무시, 키 배치 변경 시 레인 색.
- 설정 저장: `src/helpers/settings.js` (localStorage `djon.settings`, version 1, 저장값 없으면 기존 동작 그대로). 곡 선택 ESC 설정에 오디오 오프셋(+자동 측정), 레인 커버, 배경 어둡게, 미러, No Fail, 오토플레이(저장 안 함), FAST/SLOW(기본 끔) 추가.
- 오프셋은 `currentTime = 오디오 시간 - audioOffsetSec` (판정 범위 불변, 영상은 audioTime 기준).
- 결과 화면 TIMING 카드(result.timing: fast/slow/sumMs/count, 메모리만).
- 판정 기준: 채보 시간 기준(judgeY = 채보 시간에 판정선). 노트 그림은 `y = judgeY - 9 - 15`(정타 시점에 노트 중앙 = 판정선 중앙). 예전 "노트 아래 끝 기준"(배속마다 75/25ms 앞당겨짐)에서 변경.
- 미해결 질문/수치 불일치(배속 8.0 상한, 체력 회복량 문서 불일치)는 보고서 [C] 참고.

## 테마 (2026-10)
- 설정(곡 선택 ESC) → 화면 테마: 1 = 기존 DJMAX 스타일(기본), 2 = AFTERGLOW(해 질 녘 시티팝, Claude가 자유 디자인), 3 = MONOCHROME(화이트/블랙, MUSYNX RETURN 스크린샷 참고). localStorage `djon.settings.theme`.
- 테마 3: `public/theme-monochrome.css`(흰 도면 격자+십자, 검은 라벨 상자, 경고 줄무늬, 포인트 주황 #ff5a1f, 정자체·사선 없음). 화면 배치는 테마 1과 같고 색/선/장식만 다름. 노트는 CANVAS_THEMES[3].noteStyle "bracket"(note.js `_drawNoteHead`, 같은 30px 사각형 안에 검은 테두리+흰 모서리 꺾쇠). BGA는 흑백 55%, 배경 어둡게 막은 CSS invert로 흰 막(설정값 그대로). 고정 판정 색(밝은 색)은 결과 화면에서 검은 상자/검은 행 안에 둠.
- 구조: `<html data-theme="N">`. CSS는 `public/theme-afterglow.css`(테마 2 전용, 변수 덮어쓰기+장식+화면 구성 변경), 캔버스 색은 `src/helpers/theme.js` CANVAS_THEMES(곡 시작 시 고정).
- 화면 CSS의 청록은 `var(--dm-cyan)` / `rgba(var(--dm-cyan-rgb), a)`로 씀. 새 색을 넣을 때도 이 변수 사용.
- 판정 표시도 테마별(사용자 요청으로 2026-10 변경, 예전엔 고정): MarkComboJudge는 CSS 변수(--j-*, --combo-*, --fs-*, --fever-*, 기본값 = 테마 1 원래 값)를 테마 CSS의 `html[data-theme] .judge`에서 덮어씀. 타격 이펙트는 CANVAS_THEMES[n].hitFx(색 + shape circle/diamond, 테마 3 = 마름모), 결과 랭크 색은 theme.js RANK_COLORS, 결과 판정 행은 테마 변수.
- 피버 표시: 콤보 아래 "FEVER xN + 게이지"(MarkComboJudge, result.feverMultiplier/feverGauge를 judge 때 복사. 반응형 아님). 옛 fever(gameMixin fever.percent, FeverEffect.js)는 게이지가 안 오르는 죽은 코드라 손대지 않음.
- 풀콤보 연출: `components/game/FullComboBanner.vue`(섬광 → 띠 열림 → FULL COMBO 글자, 2초, 테마 변수 --fc-*). 예전 ZoomText "Full Combo" + confetti + wow 효과음은 제거(소리 없음).
- 테마 2는 화면 배치도 다름(곡 선택 좌우 반전, 점수 카드 기어 오른쪽 위, 일시정지 오른쪽 패널, 결과 2단). 단 판정선/기어 기하는 테마 1과 동일해야 함.
- 모바일은 지원 안 함(사용 중 화면의 모바일 CSS 삭제).
- 롱노트: 테마 팔레트의 long(전용 색)/longHold(누르는 중) 사용. 보류 중: 강조색 직접 지정 기능.

## 차별화 기능 (2026-10, 운영 방법: docs/축제_LAN_운영가이드.md)
- 축제 랭킹: `src/helpers/records.js`(localStorage `djon.records` {version:1, entries}, 이름 8자/소속 10자, 빈 소속=GUEST). 항목 `kind` "song"(곡 기록, 예전 기록 포함)/"final"(Arcade 최종 점수, 상한 500만, songs 배열). `/rankings` 보드 = 왼쪽 Arcade 최종 점수 TOP10, 오른쪽 TAB 곡별 TOP10/미션 도장(오늘/전체 T, Ctrl+Shift+Delete 초기화). 곡 선택 TOP3 유지. **소속 대항전은 삭제**(2026-10, 사용자 요청). `electron/lan-server.js` sanitizeRecord도 같은 kind 규칙.
- 미션: `src/helpers/missions.js`(결과만 보고 평가). 기본 5개, 차트에 `missions` 배열로 교체 가능. `result.longStats`(롱노트 성공/실패)는 note.js에서 집계만 함. 오토플레이 결과는 등록/미션 불가(`result.autoPlay`).
- 연출 기믹: `src/javascript/fx.js`(flash/blackout/tint/pulse/beat). 판정·노트·판정선/기어 기하 불변. 설정 `fxEnabled`(기본 켜짐). 작성법 docs/채보_연출기믹.md.
- LAN: `electron/lan-server.js`(호스트 HTTP+SSE 서버, TCP 41235, 기록은 userData/djon-festival-records.json), `electron/lan-main.js`(IPC, UDP 41234 찾기, 요청 대행), `electron/preload.js`(window.djonLan). app://는 http LAN fetch가 mixed content로 막혀서 통신은 전부 메인 프로세스가 함. 설정 lanRole(off/host/client)/lanHost/pcName, 기본 off.
- LAN 대전: `/vs`(VsLobby.vue), `src/helpers/vs.js`, `components/game/VsHud.vue`. store `vs`가 있을 때만 Game.vue 분기(시작 시각 동기, 일시정지/게임오버 없음, 종료 보고). 최대 4명.
- 확인: Node 단독 서버 테스트, 실제 Electron 25(Linux, Xvfb) 호스트 + 브라우저 참가 PC로 통합 랭킹/2인 대전/끊김 처리. **Windows exe·실제 여러 PC·방화벽은 미확인**(가이드의 체크리스트).
- 대기 화면: `src/helpers/attract.js`(IDLE_TO_TITLE_SEC 60 / TITLE_TO_DEMO_SEC 10). 메뉴·배속·결과·게임오버·일시정지 방치 → 타이틀 → SAMPLE PLAY(`/game/<채보>?demo=1`, 오토+No Fail, 기본 곡 끝까지, 아무 키나 클릭 시 타이틀, 결과/기록 없음) → 끝나면 타이틀 → 10초 뒤 다음 곡. 화면이 바뀌면 대기 시간 리셋. 재생 목록은 localCatalog `DEMO_PLAYLIST`({chartId, from?, lengthSec?}, 차례로 반복). 랭킹·대전·플레이 중엔 동작 안 함. 설정 attractMode(기본 켜짐).
- 샘플 채보 `public/charts/Doit.sample.json`(Doit.json과 별개, BPM 129/첫 박 0.028s 분석값). localCatalog `DEMO_CHARTS`에만 있어 목록엔 안 나옴.
- 타격 이펙트: `track.js` `HitEffect`(코어 3겹 후광+이중 선 메인 링+서브 링+스파크, 최대 지름 = 레인 폭 x `FX_SCALE`, 풀 재사용, shadowBlur 없음). 판정선(DOM 흰 띠, z-index 4 안)에 가려지지 않게 `#effectCanvas`(Game.vue z-index 5)에 그림. 롱노트 누르는 동안 `HOLD_FX_INTERVAL_SEC`(0.1초)마다 반복. 크기/시간/개수는 track.js FX_* 상수에서 조정. 판정별 색은 테마와 무관하게 고정. **실제 모양/동작은 코드 검토만 했고 직접 확인하지 못함(사용자 확인 예정).**
- 곡 선택 화면은 keep-alive라 키 리스너는 activated/deactivated에서 붙이고 뗌(예전엔 결과 화면 Enter가 곡 시작으로 새던 버그).

## 축제 모드 (2026-10)
- 타이틀 → `/mode`(ModeSelect.vue) → Free Play / Arcade / VS Match. 어느 모드든 한 크레딧 최대 3곡(판). 세션은 `src/helpers/session.js` + store `session`(메모리만), 타이틀(Home mounted)·모드 선택 진입 시 삭제. 세션 없이 `/menu`에 오면 `/mode`로.
- Free Play: 곡 선택 → … → 결과 NEXT → 3곡 후 `/final`(FinalResult.vue) 요약. 랭킹 등록 없음.
- Arcade: `/arcade-entry`(이름/소속) → 곡 선택에서 3곡 담기(ENTER 담기, BACKSPACE 빼기, 중복 불가) → START → 곡마다 배속 설정(ENTER 시작, Cancel 없음) → 결과 NEXT STAGE. 곡 기록은 자동 등록(kind song, 오토플레이 제외). 게임오버·일시정지 "End Song"은 그 시점 점수로 곡 마감(failed)하고 다음 곡. 3곡 후 `/final`에서 최종 점수 자동 등록 + 오늘 순위.
- 최종 점수 = Σ 곡 점수 × (1 + 레벨 × 0.02), 레벨 1~30으로 자름(`src/helpers/finalScore.js` BONUS_PER_LEVEL/LEVEL_MAX). 곡별 점수 계산은 그대로.
- 히든곡: Arcade 1·2번째 곡이 규칙 `picks`(순서 포함)와 같고 두 곡 모두 `minAccuracy` 이상·게임오버 없음이면 3번째 곡이 `hiddenChartId`로 바뀜(결과 화면에 HIDDEN STAGE UNLOCKED). 규칙/히든곡은 DJON-data `catalog.json`(`hiddenRules`, `"hidden": true`) 또는 localCatalog `HIDDEN_RULES`. 지금은 히든곡 없음(사용자가 나중에 추가).
- VS Match: 기존 `/vs` 로비, 판 수 표시(MATCH n/3), 3판 후 ENTER → 방 나가기 → `/final`. 다음 대전에 끌려가지 않게 3판 완료면 시작 안 함. LAN 꺼짐이면 모드 카드 비활성. 로비 슬롯에 PC별 곡 목록 코드가 다르면 "곡 목록 다름"(join에 catalogHash, 서버가 중계).
- 모드 진행 중: 일시정지 Restart·결과/게임오버 Replay 숨김, 곡 선택 R/V 막음(R은 모드 선택 화면에서). attract는 `/mode`, `/arcade-entry`, `/final`도 방치 시 타이틀로.
- 새 화면 3개는 테마가 아직 하나로 정해지지 않아 색을 `--dm-*` 변수로만 씀(테마별 CSS 없음). 테마 확정 후 그 테마만 다듬고 나머지 테마 삭제 예정.
- 확인: `RP_PROD=1 electron . --data-dir=…` + CDP로 Free 3곡, Arcade(중복 막힘·히든 열림·LV99→30·게임오버 곡 진행·합계 손계산 일치·랭킹 표시), End Song, 테마 1/2/3 화면. **VS 3판 제한은 실제 LAN 대전으로 확인 못 함(코드만).**

## 외부 곡 폴더 DJON-data (2026-10, 외부 제안 패치를 우리 코드에 직접 옮김)
- exe 옆 `DJON-data/`(songs/charts/videos/covers/catalog.json)를 내장 파일보다 먼저 찾음. 없으면 기존과 동일. 찾는 순서: `--data-dir=` → `DJON_DATA_DIR` → exe 옆(포터블은 PORTABLE_EXECUTABLE_DIR) → 개발 실행은 프로젝트 루트. `background.js` `findMediaFile`, 폴더 밖 경로 차단.
- `catalog.json`은 내장 곡 뒤에 추가(같은 id면 덮어씀). `localCatalog.js` `loadCatalog/applyCatalog`, `main.js`가 앱 시작 전에 부르고 `db.js refreshCatalogData()`. 형식은 차트매니저(별도 웹 도구, Chrome/Edge)와 공유 → 바꾸면 매니저도 고쳐야 함.
- 추가한 것: `"hidden": true` 곡/차트는 목록에서 빠지고 id로만 찾음(HIDDEN_SONGS/CHARTS), 최상위 `hiddenRules`(Arcade용, 모드 작업에서 사용). 숫자로만 된 곡 id 건너뜀. 필수 파일(mp3/채보) 없는 외부 곡은 목록에서 뺌. `catalogStatus`(외부 곡 수/오류/없는 파일/곡 목록 코드 hash)를 설정(ESC) "곡 폴더" 칸에 표시. hash는 곡·차트 id·난이도·채보 내용으로 만든 6자리 → PC 4대가 같아야 함.
- 차트매니저 주의: 채보를 매니저로 다시 저장하면 연출 기믹(flash 등, `time` 필드)과 채보 최상위 `missions` 등이 사라짐(변속/정지/레인 이동/노트는 유지). 덮어쓴 파일은 `DJON-data/.backup/`.
- 확인: `RP_PROD=1 electron . --data-dir=...`로 곡 추가·플레이·표지·히든·숫자 id·파일 누락·깨진 json·폴더 없음·경로 탈출. **포터블/설치형 exe는 미확인.**

## 작업 메모
- 파일 줄바꿈이 CRLF인 파일이 많음. 스크립트로 수정할 땐 보존할 것.
- 개발 서버는 3000번 포트(`npm start`). 확인은 `node_modules/.bin/electron . --windowed --rp-debug --remote-debugging-port=9222` 후 CDP로 캡처했음. HMR 중에 게임이 시작되면 개발용 오류 오버레이가 뜨는데 실제 결함 아님.
- 일시정지는 창 blur 시 자동 발생. 버튼 글자는 CSS로 대문자라 innerText가 "START GAME".
- 원본 백업은 임시 폴더에만 있으니(사라질 수 있음) 되돌릴 땐 git HEAD 기준으로 복구할 것.
