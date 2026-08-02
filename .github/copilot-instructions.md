### [Copilot Project Context: Rhythm Plus]

**1. Project Overview**

* **Project Name:** Rhythm Plus
* **Platform:** Desktop Client (Windows .exe)
* **Tech Stack:** Vue.js (2.x), Electron, Webpack, HTML5 Canvas API, Howler.js
* **Design Concept:** DJMAX 스타일의 미니멀하고 세련된 UI, 5:5 화면 비율의 곡 선택 창, 하단 82% 위치에 고정된 판정선(Judgment Line).

**2. Core Architecture & Files**
코드를 제안하거나 수정할 때는 반드시 아래의 파일별 분업 구조를 엄격하게 유지해야 합니다.

* **`gameInstance.js`:** 게임의 메인 루프(`requestAnimationFrame`) 구동 및 Howler.js를 활용한 오디오-시각 시간 동기화(Time Synchronization)를 전담합니다.
* **`track.js`:** 레인(Lane) 렌더링, 키보드 입력 이벤트 처리 및 현재 활성화된 노트들의 화면 드로잉을 관리합니다.
* **`note.js`:** 노트의 생명 주기, 낙하 물리 연산, 판정 로직(Perfect, Great, Good, Miss)을 담당하며, 판정선을 지나쳤을 때의 자동 Miss 처리 및 콤보 초기화 로직이 포함되어 있습니다.

**3. Development Roadmap**
프로젝트는 다음 3단계로 진행되며, 각 단계의 작업은 병렬로 이루어질 수 있습니다.

* **Phase 1: 핵심 기믹(Gimmicks) 및 패턴 구현**
* 롱노트(Hold & Release) 처리 로직 및 렌더링 구현.
* 변속(BPM 변화, 낙하 속도 변경) 및 화면 가림(블라인드) 등의 코어 기믹 추가.
* 가비지 컬렉션(GC) 스파이크를 방지하는 객체 풀링(Object Pooling) 등 60FPS 방어 최적화.


* **Phase 2: 자체 채보 에디터(Chart Editor) 개발**
* Vue.js UI와 Canvas 타임라인을 결합한 인게임 에디터 구축.
* Howler.js의 `seek()` 메서드와 Canvas Y축 스크롤을 동기화하여 1/4, 1/8, 1/16 비트 단위의 그리드 스냅(Grid Snapping) 기능 구현.
* 채보 데이터를 1차원 JSON 배열 형태로 Export/Import 하는 직렬화 시스템 구축.


* **Phase 3: UI/UX 레이어 분리 및 컴포넌트화**
* Canvas 고속 렌더링 루프와 Vue.js DOM 업데이트 레이어를 완벽히 분리하여 병목 방지.
* 곡 선택 화면, 인게임 설정, 리절트(결과) 화면을 독립적인 Vue SFC(Single File Component)로 제작.



**4. Strict Coding Guidelines**

* **역할 침범 금지:** 렌더링 로직을 DOM에 섞거나, UI 상태 관리를 Canvas 루프 안에서 강제로 처리하지 마세요.
* **최적화 우선:** Canvas 내에서 불필요한 `ctx.save()`, `ctx.restore()` 호출을 최소화하고 리듬 게임 특유의 정확한 판정(손맛)을 보장하는 코드를 작성하세요.
