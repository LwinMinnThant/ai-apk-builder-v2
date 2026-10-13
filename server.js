'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => res.json({
  ok: true,
  service: 'ai-apk-builder',
  aiConfigured: Boolean(process.env.GEMINI_API_KEY),
  buildConfigured: Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO)
}));

async function gemini(prompt, systemPrompt) {
  if (!process.env.GEMINI_API_KEY) {
    const e = new Error('AI API is not configured. Add GEMINI_API_KEY to server environment variables.');
    e.status = 503; throw e;
  }
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
    {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        system_instruction: {parts:[{text:systemPrompt}]},
        contents:[{role:'user',parts:[{text:prompt}]}],
        generationConfig:{temperature:0.3,maxOutputTokens:8192}
      })
    }
  );
  const data = await response.json().catch(()=>({}));
  if (!response.ok) {
    const e = new Error(data.error?.message || `Gemini request failed (${response.status})`);
    e.status = 502; throw e;
  }
  const result = data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();
  if (!result) { const e=new Error('AI returned an empty response.'); e.status=502; throw e; }
  return {result: result.replace(/^```(?:html|json)?\s*/i,'').replace(/\s*```$/,''), model};
}

app.post('/api/generate', async (req,res) => {
  try {
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) return res.status(400).json({error:'Please enter an app description.'});
    if (prompt.length > 12000) return res.status(400).json({error:'Prompt is too long (maximum 12,000 characters).'});
    const out = await gemini(prompt,
      'You create a polished standalone HTML prototype. Return ONLY a complete HTML document, no markdown. Inline CSS and JavaScript, no external dependencies. Responsive mobile-first UI. Implement working interactions. Never expose secrets or exfiltrate user data.');
    if (!/<html[\s>]/i.test(out.result) && !/<!doctype html/i.test(out.result)) {
      return res.status(502).json({error:'AI did not return a complete HTML document. Try again with a simpler prompt.'});
    }
    res.json({html:out.result,model:out.model});
  } catch(e) { res.status(e.status||500).json({error:e.message||'Generation failed.'}); }
});

/*
 * Convert a user's app description into a build manifest.
 * This initial auto-build path packages generated HTML into a Capacitor Android app.
 * It builds the generated HTML prototype, not arbitrary native Kotlin/Java code.
 */
app.post('/api/build', async (req,res) => {
  try {
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) return res.status(400).json({error:'Please enter an app description first.'});
    if (prompt.length > 12000) return res.status(400).json({error:'Prompt is too long (maximum 12,000 characters).'});
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const token = process.env.GITHUB_TOKEN;
    if (!owner || !repo || !token) {
      return res.status(503).json({error:'APK auto-build is not configured. Set GITHUB_OWNER, GITHUB_REPO and GITHUB_TOKEN on the backend. See README_MY.md.'});
    }
    const out = await gemini(prompt,
      'Create a complete responsive standalone HTML app for a Capacitor Android WebView. Return ONLY a complete HTML document, no markdown. Include all CSS and JavaScript inline; no external scripts or dependencies. Implement the requested features as well as practical using localStorage where appropriate. Mobile-first. Do not include secrets, tracking, network exfiltration, or instructions that execute outside the browser.');
    const html = out.result;
    if (!/<html[\s>]/i.test(html) && !/<!doctype html/i.test(html)) {
      return res.status(502).json({error:'AI did not return a complete HTML document. Try a simpler prompt.'});
    }

    // Use GitHub Actions workflow_dispatch to create a one-off APK from the generated HTML.
    const gh = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/build-generated-app.yml/dispatches`, {
      method:'POST',
      headers:{
        'Accept':'application/vnd.github+json',
        'Authorization':`Bearer ${token}`,
        'X-GitHub-Api-Version':'2022-11-28',
        'Content-Type':'application/json'
      },
      body:JSON.stringify({ref:process.env.GITHUB_BRANCH || 'main', inputs:{app_prompt:prompt, generated_html:html}})
    });
    if (!gh.ok) {
      const details = await gh.text();
      return res.status(502).json({error:`GitHub could not start the APK build (${gh.status}). Check token permissions, repo settings and workflow file. ${details.slice(0,300)}`});
    }
    res.json({ok:true,message:'AI created the app and queued an Android APK build. Open GitHub Actions to watch progress and download the APK artifact when finished.',actionsUrl:`https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions`,model:out.model});
  } catch(e) { res.status(e.status||500).json({error:e.message||'APK build request failed.'}); }
});

app.listen(PORT,()=>console.log(`AI APK Builder listening on port ${PORT}`));
