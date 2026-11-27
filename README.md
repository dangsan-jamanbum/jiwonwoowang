# ATD Harbor — 원본 3D 게임 복구 작업

이 저장소는 기존 2D 프로토타입이 아니라, 사용자가 제공한 원본 항구 게임의 Three.js 소스를 기준으로 복구·확장하기 위한 작업 공간입니다.

## 확인된 원본 코드
- `walk3d.js`: Three.js 기반 3D 월드, 캐릭터, 카메라, 이동, 상호작용, 다른 플레이어 표시 로직
- `app.js`: 게임 화면 시작, HUD, 대화·항구 UI, presence 연결 및 서버 API 호출 로직

## 아직 확보되지 않은 필수 파일
현재 제공된 코드의 import를 기준으로 다음 모듈과 정적 에셋이 더 필요합니다.
- `harbor-set.js`, `harbor-figures.js`, `cy-yard.js`
- `guardian-court.js`, `canvas-harbor.js`, `vessel-camera.js`
- `palm-beats.js`, `shrine-gesture.js`, `terminal-marquee.js`
- `departure-office.js`, `harbor-life.js`
- 앱 UI 모듈: `harbor-chat.js`, `browser-session.js`, `presence-client.js`, `conversations.js`, `shrine.js`, `control.js`, `terminal-panel.js`, `icons.js`, `crew-profile.js`
- Three.js vendor 파일, 이미지/모델 등 원본 정적 에셋, HTML/CSS, 서버 API

## 구현 원칙
1. 원본 3D 월드·캐릭터·카메라·조작을 교체하지 않습니다.
2. 화물은 인벤토리에 넣지 않고 월드 오브젝트를 직접 집어 운반합니다.
3. 운반 중 이동 속도를 낮춥니다.
4. 지게차와 컨테이너 캐리어를 월드 안에서 움직이게 하고 충돌/통행 방해를 구현합니다.
5. 멀티플레이어 presence에 운반 중인 화물 상태를 추가해 다른 플레이어에게 동기화합니다.

## 현재 상태
원본의 핵심 3D 코드 두 파일은 대화에서 확보했지만, 이 저장소에 실행 가능한 게임을 구성하려면 위 의존 파일과 원본 정적 에셋이 추가로 필요합니다. 누락된 모듈을 임의로 새로 만들어 원본과 다른 게임으로 대체하지 않습니다.
