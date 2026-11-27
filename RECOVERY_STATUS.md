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
