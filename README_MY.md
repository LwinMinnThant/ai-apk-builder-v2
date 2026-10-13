# AI APK Builder — Auto APK workflow (မြန်မာလမ်းညွှန်)

## ပါဝင်တာ
- AI Prompt ကနေ standalone HTML app prototype ဖန်တီးခြင်း
- Preview နဲ့ HTML download
- **APK Build ခလုတ်**: AI က HTML app ကို ဖန်တီးပြီး GitHub Actions workflow ကို ခေါ်ကာ APK artifact ထုတ်ပေးခြင်း
- Backend `/api/health`, `/api/generate`, `/api/build`

## အရေးကြီးတဲ့ ကန့်သတ်ချက်
ဒီ auto-build feature က AI-generated **HTML/WebView prototype** ကို Capacitor Android APK အဖြစ် package လုပ်ပေးတာပါ။ Prompt တစ်ခုချင်းစီကနေ arbitrary native Kotlin/Java project ထုတ်ပြီး ဘယ် app မဆို native APK ဖြစ်အောင် compile လုပ်တဲ့ universal system မဟုတ်ပါ။ Native hardware features, background services, complex plugins တို့အတွက် manual development လိုနိုင်ပါတယ်။ Build က GitHub Actions Free quota/limits ပေါ်မူတည်ပါတယ်။

## 1. Repository ထဲတင်ရန်
ZIP ကို extract လုပ်ပြီး ဖိုင်အားလုံးကို GitHub repository ရဲ့ root ထဲ upload/commit လုပ်ပါ။ အထူးသဖြင့်:
- `server.js`
- `package.json`
- `public/index.html`
- `.github/workflows/build-apk.yml`
- `.github/workflows/build-generated-app.yml`

GitHub repository ရဲ့ Actions tab မှာ workflows ကို ခွင့်ပြုထားပါ။

## 2. Backend deploy လုပ်ရန် (Render ဥပမာ)
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Root directory: repository root
- Environment variables:
  - `GEMINI_API_KEY` = Google AI Studio API key
  - `GEMINI_MODEL` = `gemini-2.5-flash`
  - `GITHUB_OWNER` = GitHub username/org
  - `GITHUB_REPO` = repository name
  - `GITHUB_BRANCH` = `main`
  - `GITHUB_TOKEN` = server-side GitHub token

Gemini key: https://aistudio.google.com/

### GitHub token
Create a fine-grained token limited to this repository. Grant only the permissions required to dispatch workflows (Actions: read/write; Contents: read, if needed by your repository settings). Never put this token in frontend code or commit it to GitHub. Store it only in backend environment variables. If workflow dispatch returns 404/403, check token permissions, repository name/owner, workflow file path, and Actions settings.

## 3. Test backend
Open `/api/health` on the deployed server. It should return:
- `aiConfigured: true`
- `buildConfigured: true`

If either is false, fix the environment variables and redeploy.

## 4. Generate and build an app
1. Open the deployed website.
2. Enter a specific prompt describing the app.
3. Click **AI နဲ့ ဖန်တီးမယ်** to preview first.
4. If satisfied, click **APK Build လုပ်မယ်**.
5. Wait for confirmation and open the GitHub Actions link.
6. Open the latest **Build Generated App APK** run.
7. Wait for green checkmark.
8. Under Artifacts, download `generated-app-apk`, extract ZIP, install `app-debug.apk`.

Build takes several minutes. Each request sends generated HTML as a workflow input; keep prompts modest and do not submit private data.

## 5. Local run
Node.js 20+:
```bash
npm install
npm run check
npm start
```
Set environment variables before starting.

## Troubleshooting
- `AI API is not configured`: set `GEMINI_API_KEY`.
- `APK auto-build is not configured`: set `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_TOKEN`.
- GitHub 403/404: verify workflow dispatch permission, repository access, workflow name, branch and Actions enabled.
- Actions build fails: open the failed run and inspect the first error in logs.
- `Failed to fetch`: check that the site and API use the same backend origin, HTTPS and server deployment status.
- Generated app uses HTML, not native Kotlin/Java. Some prompts cannot be implemented fully by a single HTML page.

## Security
- Keep API and GitHub tokens in backend environment variables.
- Never accept arbitrary native build scripts from AI and execute them without sandboxing/review.
- This starter only writes generated HTML into the build workflow, avoiding execution of AI-generated Gradle or shell scripts.
