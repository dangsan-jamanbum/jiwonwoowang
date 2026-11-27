# 원본 ATD 항구 게임 복구 현황

## 확보된 원본 파일
- `ATD · 세상에서 가장 간절한 항구.html`: 저장된 원본 페이지 구조와 게임 실행 진입점
- `game.js.다운로드`: 원본 게임 부트스트랩 코드
- `source/walk3d.js`: Three.js 기반 3D 월드 코드
- `source/app.js`: 게임 앱 코드 사본
- 원본 CSS: `index.D4kmmmus.css`, `harbor-chat.css`, `shrine.css`, `conversations.css`, `adventure.css`
- 번들 파일: `index-D-6W7RM_.js.다운로드`, `framework-D_rUT4EX.js.다운로드`, `rolldown-runtime-C60lm6uB.js.다운로드`
- 이미지: `crew-cardigan-face.webp`

## 실행을 막는 누락 의존성
원본 `game.js`가 직접 불러오는 모듈:
- harbor-chat.js
- browser-session.js
- presence-client.js
- conversations.js
- shrine.js
- control.js
- terminal-panel.js
- icons.js
- crew-profile.js

원본 `walk3d.js`가 직접 불러오는 모듈:
- vendor/three.module.js
- harbor-figures.js
- harbor-set.js
- cy-yard.js
- guardian-court.js
- canvas-harbor.js
- vessel-camera.js
- palm-beats.js
- shrine-gesture.js
- terminal-marquee.js
- departure-office.js
- harbor-life.js

## 주의
현재 저장소에 위 의존성 파일들이 없으므로 아직 배포 가능한 실행본이 아닙니다. 이 파일들을 임의로 새로 만들어 원본 코드인 것처럼 대체하지 않습니다. 원본 웹사이트에서 해당 정적 파일을 확보한 뒤 경로와 버전 쿼리를 유지해 연결해야 합니다.

## 다음 구현 단계
1. 누락된 원본 모듈과 Three.js 라이브러리 확보
2. 저장된 HTML의 상대경로를 저장소 구조에 맞게 정리
3. 로컬 실행 및 브라우저 콘솔 오류 확인
4. 원본 동작을 유지하면서 직접 화물 운반, 운반 중 감속, 지게차/컨테이너 캐리어, 멀티플레이 동기화를 추가


## 2026-11-27 추가 복구 작업

- 저장한 원본 HTML의 CSS/JS/이미지 경로 14곳에서 잘못된 `ATD · 세상에서 가장 간절한 항구_files/` 접두사를 제거해 저장소 루트의 실제 파일 위치와 일치시켰습니다.
- GitHub Pages가 기본 진입 파일로 인식할 수 있도록 같은 HTML을 `index.html`로 추가했습니다.
- 단, 현재 저장소에는 아래 원본 모듈이 아직 없으므로 이 상태를 실행 완료로 볼 수 없습니다.

### 아직 필요한 원본 모듈

게임 시작 모듈:
- `harbor-chat.js`
- `browser-session.js`
- `presence-client.js`
- `conversations.js`
- `shrine.js`
- `control.js`
- `terminal-panel.js`
- `icons.js`
- `crew-profile.js`

3D 월드 모듈:
- `source/vendor/three.module.js`
- `source/harbor-figures.js`
- `source/harbor-set.js`
- `source/cy-yard.js`
- `source/guardian-court.js`
- `source/canvas-harbor.js`
- `source/vessel-camera.js`
- `source/palm-beats.js`
- `source/shrine-gesture.js`
- `source/terminal-marquee.js`
- `source/departure-office.js`
- `source/harbor-life.js`

원본 웹사이트에서 이 파일들을 자동으로 내려받는 접근은 현재 차단되어 있어 아직 복구하지 못했습니다. 비슷한 코드로 대체하면 원본 3D 게임이 아니게 되므로 임의 대체하지 않습니다.


## 2026-11-27 원본 파일 재확인

- 저장소의 실제 import 구문을 다시 확인했습니다. `game.js.다운로드`는 위 게임 시작 모듈 9개를 직접 import하고, `source/walk3d.js`는 Three.js 및 12개의 3D 모듈을 import합니다.
- 원본 사이트의 다음 주소에서 파일을 직접 열어 확보하려고 시도했지만, 현재 사용 가능한 웹 접근 경로에서 모두 접근 오류가 발생했습니다.
  - `https://atd-harbor-club.blairsurvive.chatgpt.site/game.js?v=24`
  - `https://atd-harbor-club.blairsurvive.chatgpt.site/walk3d.js?v=24`
  - `https://atd-harbor-club.blairsurvive.chatgpt.site/harbor-set.js?v=22`
- 공개 GitHub 코드 검색에서도 이 게임의 고유 모듈인 `harbor-set.js`, `harbor-figures.js`, `cy-yard.js`, `departure-office.js`의 원본을 확인하지 못했습니다.
- 따라서 현재는 원본 3D 월드의 핵심 의존성이 해결되지 않았습니다. 새로 만든 대체 모듈을 넣거나 게임이 실행된다고 표시하지 않습니다.

### 다음 복구 기준

1. 원본 사이트의 정적 파일에 접근 가능한 경로를 확보합니다.
2. 누락된 파일을 원래 디렉터리 구조와 import 버전 그대로 저장소에 복원합니다.
3. 브라우저에서 실제 실행 및 콘솔 오류를 확인합니다.
4. 그 다음에만 화물 운반과 운송 장비, 동기화 기능을 원본 구조에 맞춰 추가합니다.
