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
- 판정 기준: 채보 시간 기준(judgeY = 채보 시간에 판정선). 노트 그림은 `y = judgeY - 30`(아래 끝이 정타 시점에 판정선). 예전 "노트 아래 끝 기준"(배속마다 75/25ms 앞당겨짐)에서 변경.
- 미해결 질문/수치 불일치(배속 8.0 상한, 체력 회복량 문서 불일치)는 보고서 [C] 참고.

## 테마 (2026-10)
- 설정(곡 선택 ESC) → 화면 테마: 1 = 기존 DJMAX 스타일(기본), 2 = AFTERGLOW(해 질 녘 시티팝, Claude가 자유 디자인). localStorage `djon.settings.theme`.
- 구조: `<html data-theme="N">`. CSS는 `public/theme-afterglow.css`(테마 2 전용, 변수 덮어쓰기+장식+화면 구성 변경), 캔버스 색은 `src/helpers/theme.js` CANVAS_THEMES(곡 시작 시 고정).
- 화면 CSS의 청록은 `var(--dm-cyan)` / `rgba(var(--dm-cyan-rgb), a)`로 씀. 새 색을 넣을 때도 이 변수 사용.
- 판정 표시(MarkComboJudge, 타격 이펙트 판정색, 결과 판정 행/랭크 색)는 테마와 무관하게 고정. 테마 2에서도 변수를 테마 1 값으로 재지정해 유지.
- 테마 2는 화면 배치도 다름(곡 선택 좌우 반전, 점수 카드 기어 오른쪽 위, 일시정지 오른쪽 패널, 결과 2단). 단 판정선/기어 기하는 테마 1과 동일해야 함.
- 모바일은 지원 안 함(사용 중 화면의 모바일 CSS 삭제).

## 작업 메모
- 파일 줄바꿈이 CRLF인 파일이 많음. 스크립트로 수정할 땐 보존할 것.
- 개발 서버는 3000번 포트(`npm start`). 확인은 `node_modules/.bin/electron . --windowed --rp-debug --remote-debugging-port=9222` 후 CDP로 캡처했음. HMR 중에 게임이 시작되면 개발용 오류 오버레이가 뜨는데 실제 결함 아님.
- 일시정지는 창 blur 시 자동 발생. 버튼 글자는 CSS로 대문자라 innerText가 "START GAME".
- 원본 백업은 임시 폴더에만 있으니(사라질 수 있음) 되돌릴 땐 git HEAD 기준으로 복구할 것.
