import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const OUTPUT_DIR = path.resolve('screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) {
            reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          } else {
            resolve(msg.result);
          }
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('Launching headless browser from:', CHROME_PATH);
  const port = 9222;
  const browserProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--window-size=1440,900',
    ],
    { stdio: 'ignore' },
  );

  try {
    let versionData = null;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (res.ok) {
          versionData = await res.json();
          break;
        }
      } catch {
        await sleep(300);
      }
    }

    if (!versionData) {
      throw new Error('Failed to connect to browser DevTools port');
    }

    console.log('Connected to DevTools Protocol.');

    let target = null;
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const list = await listRes.json();
    target = list.find((t) => t.type === 'page');
    if (!target) {
      const targetRes = await fetch(`http://127.0.0.1:${port}/json/new?http://localhost:3000`, {
        method: 'PUT',
      });
      target = await targetRes.json();
    }
    const client = new CDPClient(target.webSocketDebuggerUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');

    async function setViewport(width, height, isMobile = false, scale = 2) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: scale,
        mobile: isMobile,
      });
    }

    async function captureScreenshot(filename, clip = null) {
      const params = { format: 'png' };
      if (clip) {
        params.clip = { ...clip, scale: 1 };
      }
      const result = await client.send('Page.captureScreenshot', params);
      const buffer = Buffer.from(result.data, 'base64');
      const filePath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(filePath, buffer);
      console.log(`✓ Saved: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
    }

    async function evaluate(expression) {
      const res = await client.send('Runtime.evaluate', { expression, returnByValue: true });
      return res?.result?.value;
    }

    // ==========================================
    // PART 1: DESKTOP HD SCREENSHOTS (1440 x 900)
    // ==========================================
    console.log('\n--- CAPTURING DESKTOP SCREENSHOTS ---');
    await setViewport(1440, 900, false, 2);

    // 1. Desktop Home
    await client.send('Page.navigate', { url: 'http://localhost:3000' });
    await sleep(2200);
    await captureScreenshot('desktop_01_homepage.png');

    // 2. Desktop Live Arena
    await client.send('Page.navigate', { url: 'http://localhost:3000/live' });
    await sleep(2200);
    await captureScreenshot('desktop_02_live_arena.png');

    // 3. Desktop Sports
    await client.send('Page.navigate', { url: 'http://localhost:3000/sports' });
    await sleep(2000);
    await captureScreenshot('desktop_03_sports_directory.png');

    // 4. Desktop Schedule
    await client.send('Page.navigate', { url: 'http://localhost:3000/schedule' });
    await sleep(2000);
    await captureScreenshot('desktop_04_schedule.png');

    // 5. Desktop Leaderboard
    await client.send('Page.navigate', { url: 'http://localhost:3000/standings' });
    await sleep(2000);
    await captureScreenshot('desktop_05_leaderboard_medals.png');

    // 6. Desktop Tournament Bracket
    await client.send('Page.navigate', { url: 'http://localhost:3000/bracket' });
    await sleep(2000);
    await captureScreenshot('desktop_06_tournament_bracket.png');

    // 7. Desktop Gallery (Fixed & verified)
    await client.send('Page.navigate', { url: 'http://localhost:3000/gallery' });
    await sleep(2200);
    await captureScreenshot('desktop_07_media_gallery.png');

    // 8. Desktop FAQ (With smooth open accordion)
    await client.send('Page.navigate', { url: 'http://localhost:3000/faq' });
    await sleep(2000);
    await captureScreenshot('desktop_08_faq_smooth_animated.png');

    // 9. Desktop Audience Pass Kiosk (/pass)
    await client.send('Page.navigate', { url: 'http://localhost:3000/pass' });
    await sleep(2200);
    await captureScreenshot('desktop_09_audience_pass_kiosk.png');

    // 10. Desktop Security Gate Desk (/security)
    await client.send('Page.navigate', { url: 'http://localhost:3000/security' });
    await sleep(2000);
    // Click quick test "Rahul Sharma (Athlete)" to populate dossier
    await evaluate(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const rahulBtn = btns.find(b => b.textContent.includes('Rahul Sharma'));
      if (rahulBtn) rahulBtn.click();
    })()`);
    await sleep(1000);
    await captureScreenshot('desktop_10_security_gate_desk.png');

    // 11. Desktop Organizer Google Login (/login)
    await client.send('Page.navigate', { url: 'http://localhost:3000/login' });
    await sleep(2000);
    await captureScreenshot('desktop_11_organizer_google_login.png');

    // 12. Desktop About Page
    await client.send('Page.navigate', { url: 'http://localhost:3000/about' });
    await sleep(2000);
    await captureScreenshot('desktop_12_about_convoquer.png');

    // 13. Desktop Campus Map
    await client.send('Page.navigate', { url: 'http://localhost:3000/campus-map' });
    await sleep(2000);
    await captureScreenshot('desktop_13_campus_masterplan.png');

    // 14. Desktop Participating Institutes
    await client.send('Page.navigate', { url: 'http://localhost:3000/institutes' });
    await sleep(2000);
    await captureScreenshot('desktop_14_participating_institutes.png');

    // 15. Desktop Organizer Command Overview (/organizer)
    await client.send('Page.navigate', { url: 'http://localhost:3000/organizer' });
    await sleep(2200);
    await captureScreenshot('desktop_15_organizer_overview.png');

    // 16. Desktop Field-Side Scorer Portal (/scorer)
    await client.send('Page.navigate', { url: 'http://localhost:3000/scorer' });
    await sleep(2200);
    await captureScreenshot('desktop_16_scorer_portal.png');

    // 17. Desktop Tournament Manager (/tournaments)
    await client.send('Page.navigate', { url: 'http://localhost:3000/tournaments' });
    await sleep(2200);
    await captureScreenshot('desktop_17_tournament_manager.png');

    // 18. Desktop Match Manager & Fixtures Desk (/matches)
    await client.send('Page.navigate', { url: 'http://localhost:3000/matches' });
    await sleep(2200);
    await captureScreenshot('desktop_18_match_manager.png');

    // 19. Desktop Match Approvals & Results Desk (/results/approvals)
    await client.send('Page.navigate', { url: 'http://localhost:3000/results/approvals' });
    await sleep(2200);
    await captureScreenshot('desktop_19_match_approvals.png');

    // 20. Desktop User Manager & RBAC Access Control (/rbac)
    await client.send('Page.navigate', { url: 'http://localhost:3000/rbac' });
    await sleep(2200);
    await captureScreenshot('desktop_20_rbac_access_control.png');

    // 21. Desktop Sports Operations & Fixture Manager (/sports/manager)
    await client.send('Page.navigate', { url: 'http://localhost:3000/sports/manager' });
    await sleep(2200);
    await captureScreenshot('desktop_21_sports_operations.png');

    // ==========================================
    // PART 2: MOBILE VIEWPORTS (iPhone 390 x 844)
    // ==========================================
    console.log('\n--- CAPTURING MOBILE SCREENSHOTS (iPhone 390x844) ---');
    await setViewport(390, 844, true, 2);

    // 15. Mobile Home Hero
    await client.send('Page.navigate', { url: 'http://localhost:3000' });
    await sleep(2200);
    await captureScreenshot('mobile_01_home_hero.png');

    // 16. Mobile Navigation Menu Drawer (Opened)
    await evaluate(`(() => {
      const burger = document.querySelector('button[aria-label="Open Navigation Menu"]');
      if (burger) burger.click();
    })()`);
    await sleep(800);
    await captureScreenshot('mobile_02_navbar_drawer.png');

    // 17. Mobile Live Arena
    await client.send('Page.navigate', { url: 'http://localhost:3000/live' });
    await sleep(2200);
    await captureScreenshot('mobile_03_live_arena.png');

    // 18. Mobile Sports Directory
    await client.send('Page.navigate', { url: 'http://localhost:3000/sports' });
    await sleep(2000);
    await captureScreenshot('mobile_04_sports_directory.png');

    // 19. Mobile Schedule
    await client.send('Page.navigate', { url: 'http://localhost:3000/schedule' });
    await sleep(2000);
    await captureScreenshot('mobile_05_schedule.png');

    // 20. Mobile Leaderboard / Standings
    await client.send('Page.navigate', { url: 'http://localhost:3000/standings' });
    await sleep(2000);
    await captureScreenshot('mobile_06_leaderboard.png');

    // 21. Mobile Tournament Bracket
    await client.send('Page.navigate', { url: 'http://localhost:3000/bracket' });
    await sleep(2000);
    await captureScreenshot('mobile_07_bracket.png');

    // 22. Mobile Gallery
    await client.send('Page.navigate', { url: 'http://localhost:3000/gallery' });
    await sleep(2200);
    await captureScreenshot('mobile_08_media_gallery.png');

    // 23. Mobile FAQ (Smooth Animated Accordions)
    await client.send('Page.navigate', { url: 'http://localhost:3000/faq' });
    await sleep(2000);
    await captureScreenshot('mobile_09_faq_accordion.png');

    // 24. Mobile Audience Pass Kiosk (/pass)
    await client.send('Page.navigate', { url: 'http://localhost:3000/pass' });
    await sleep(2200);
    await captureScreenshot('mobile_10_audience_pass_kiosk.png');

    // 25. Mobile Security Desk (/security)
    await client.send('Page.navigate', { url: 'http://localhost:3000/security' });
    await sleep(2000);
    // Click quick test "Rahul Sharma (Athlete)" to populate dossier
    await evaluate(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const rahulBtn = btns.find(b => b.textContent.includes('Rahul Sharma'));
      if (rahulBtn) rahulBtn.click();
    })()`);
    await sleep(1000);
    await captureScreenshot('mobile_11_security_desk.png');

    // 26. Mobile Organizer Google Login (/login)
    await client.send('Page.navigate', { url: 'http://localhost:3000/login' });
    await sleep(2000);
    await captureScreenshot('mobile_12_organizer_google_login.png');

    // 27. Mobile About Convoquer
    await client.send('Page.navigate', { url: 'http://localhost:3000/about' });
    await sleep(2000);
    await captureScreenshot('mobile_13_about.png');

    // 28. Mobile Campus Venues
    await client.send('Page.navigate', { url: 'http://localhost:3000/venues' });
    await sleep(2000);
    await captureScreenshot('mobile_14_venues.png');

    // 29. Mobile Organizer Overview (/organizer)
    await client.send('Page.navigate', { url: 'http://localhost:3000/organizer' });
    await sleep(2200);
    await captureScreenshot('mobile_15_organizer_overview.png');

    // 30. Mobile Scorer Portal (/scorer)
    await client.send('Page.navigate', { url: 'http://localhost:3000/scorer' });
    await sleep(2200);
    await captureScreenshot('mobile_16_scorer_portal.png');

    // 31. Mobile Tournament Manager (/tournaments)
    await client.send('Page.navigate', { url: 'http://localhost:3000/tournaments' });
    await sleep(2200);
    await captureScreenshot('mobile_17_tournament_manager.png');

    // 32. Mobile Match Manager & Fixtures Desk (/matches)
    await client.send('Page.navigate', { url: 'http://localhost:3000/matches' });
    await sleep(2200);
    await captureScreenshot('mobile_18_match_manager.png');

    // 33. Mobile Match Approvals & Results Desk (/results/approvals)
    await client.send('Page.navigate', { url: 'http://localhost:3000/results/approvals' });
    await sleep(2200);
    await captureScreenshot('mobile_19_match_approvals.png');

    // 34. Mobile User Manager & RBAC Access Control (/rbac)
    await client.send('Page.navigate', { url: 'http://localhost:3000/rbac' });
    await sleep(2200);
    await captureScreenshot('mobile_20_rbac_access_control.png');

    // 35. Mobile Sports Operations & Fixture Manager (/sports/manager)
    await client.send('Page.navigate', { url: 'http://localhost:3000/sports/manager' });
    await sleep(2200);
    await captureScreenshot('mobile_21_sports_operations.png');

    console.log('\nAll 35 HD desktop and mobile screenshots captured successfully!');
    await client.close();
  } catch (err) {
    console.error('Error during screenshot capture:', err);
  } finally {
    try {
      browserProcess.kill();
    } catch {}
  }
}

main();
