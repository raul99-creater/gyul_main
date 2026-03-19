# 귤귤 메인 포털 배포 가이드 (Vercel)

## 1) 이 zip으로 하는 일
- 회원 로그인 페이지
- 토큰 회원가입 페이지
- 내 강의 대시보드
- Supabase 실데이터 연결

## 2) 배포 전 꼭 알아둘 점
- 이 프로젝트는 **정적 HTML/CSS/JS** 입니다.
- Vercel에서 Framework Preset은 **Other** 로 두면 됩니다.
- 지금 config.js에는 네 Supabase URL / anon key가 이미 들어가 있습니다.
- `assets/js/config.js` 의 `adminAppUrl` 은 **어드민 앱 배포 주소**로 나중에 넣어야 합니다.

## 3) GitHub 업로드
1. GitHub에서 새 저장소 생성
   - 예: `gyulgyul-main`
2. 이 zip 압축 해제
3. 압축 해제된 파일 전체를 저장소 루트에 업로드
4. `main` 브랜치에 커밋

## 4) Vercel 배포
1. Vercel 로그인
2. **Add New → Project**
3. 방금 만든 GitHub 저장소 선택
4. 프로젝트명 입력
   - 예: `gyulgyul-main`
5. Framework Preset: **Other**
6. Root Directory: 그대로 `/`
7. Deploy 클릭

Vercel은 GitHub 저장소를 연결하면 푸시마다 자동 배포되고, 프로젝트 생성 시 Git 저장소를 import한 뒤 프로젝트 설정을 구성하는 흐름을 공식 지원합니다. 또한 모노레포가 아니어도 Root Directory를 설정할 수 있습니다. citeturn369238search0turn369238search8

## 5) 첫 확인
배포 URL에서 아래가 보이면 성공
- `/index.html` 로그인 화면
- `/signup.html?token=...` 회원가입 화면
- `/dashboard.html` 로그인 후 대시보드

## 6) 어드민 주소 연결
어드민 앱을 배포한 뒤 `assets/js/config.js` 에서 아래 값을 수정
```js
adminAppUrl: 'https://네-어드민-주소.vercel.app',
```
수정 후 GitHub에 push 하면 Vercel이 재배포합니다. Git 연결 프로젝트는 푸시마다 자동 배포됩니다. citeturn369238search4turn369238search12

## 7) Supabase 확인 포인트
- Authentication → Email 로그인 사용 가능 상태
- SQL Editor에서 `supabase/schema.sql` 먼저 실행
- 필요하면 `supabase/seed.sql` 실행

Supabase 클라이언트는 브라우저에서 Project URL과 클라이언트용 키로 초기화하며, 최신 문서에서는 클라이언트용으로 publishable key를 우선 권장합니다. legacy 프로젝트는 anon 키를 계속 사용할 수 있습니다. citeturn369238search2turn369238search6turn369238search13

## 8) 회원가입 방식
- 회원가입은 메인 앱의 `/signup.html?token=토큰값`
- 토큰 하나가 특정 강사/기수 강의에 연결됨
- 회원가입 성공 시 해당 강의 membership 생성

Supabase Auth는 이메일/비밀번호 기반 signup을 공식 지원합니다. citeturn369238search3turn369238search7turn369238search14

## 9) 문제 생기면 먼저 볼 것
- 로그인은 되는데 강의가 안 보임 → membership 없음
- signup 페이지에서 유효하지 않은 토큰 → signup_tokens 테이블 확인
- 어드민 버튼이 안 보임 → `adminAppUrl` 미입력 가능성
