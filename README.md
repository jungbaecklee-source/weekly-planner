# 2주 플래너 — Notion 연동

## 배포 방법

### 1. GitHub에 업로드
1. [github.com](https://github.com) 에서 계정 만들기
2. 새 repository 만들기 (이름: `weekly-planner`)
3. 이 폴더의 모든 파일 업로드

### 2. Vercel 배포
1. [vercel.com](https://vercel.com) 접속 → GitHub로 로그인
2. "New Project" → 방금 만든 repository 선택
3. Deploy 클릭

### 3. 환경변수 설정 (중요!)
Vercel 프로젝트 → Settings → Environment Variables에서 추가:

| 이름 | 값 |
|------|-----|
| `NOTION_TOKEN` | Notion Internal Integration Token |
| `NOTION_DATABASE_ID` | `31ba2bc91e4580c08a9cf1ca7c15c503` |

### 4. 재배포
환경변수 저장 후 → Deployments → Redeploy

---

## 로컬 실행 방법
```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.local.example .env.local
# .env.local 파일 열어서 NOTION_TOKEN 입력

# 3. 실행
npm run dev
# http://localhost:3000 접속
```
