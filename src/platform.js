// start.ng owns sign-in. The game never sees passwords, tokens or emails and never calls the
// start.ng API: it asks a hidden start.ng/connect page who is signed in.

function findStartNg() {
  const { hostname } = location;
  if (hostname.endsWith('.start.ng')) return 'https://start.ng';
  if (hostname.endsWith('.start.localhost')) return 'http://start.localhost:5173'; // local testing
  return null; // anywhere else: guest only
}

/** start.ng's address, or null when the game runs somewhere start.ng can't reach. */
export const START_NG = findStartNg();

let frame;
function connectFrame() {
  frame ??= new Promise((resolve, reject) => {
    const el = document.createElement('iframe');
    el.src = `${START_NG}/connect`;
    el.hidden = true;
    el.title = 'start.ng sign-in check';
    el.addEventListener('load', () => resolve(el), { once: true });
    el.addEventListener('error', reject, { once: true });
    document.body.append(el);
  });
  return frame;
}

// Resolves to start.ng's reply, or undefined if it isn't there or didn't answer in 3 seconds.
async function ask(message, replyType, timeoutMs = 3000) {
  if (!START_NG) return undefined;
  let el;
  try { el = await connectFrame(); } catch { return undefined; }
  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);
    const done = (reply) => { clearTimeout(timer); removeEventListener('message', onMessage); resolve(reply); };
    const timer = setTimeout(() => done(undefined), timeoutMs);
    function onMessage(e) {
      if (e.origin !== START_NG || e.source !== el.contentWindow) return;
      if (e.data?.type === replyType && e.data.requestId === requestId) done(e.data);
    }
    addEventListener('message', onMessage);
    el.contentWindow.postMessage({ ...message, requestId }, START_NG);
  });
}

// The user, null (signed out), or undefined (start.ng didn't answer).
async function check() {
  if (!START_NG) return null;
  const reply = await ask({ type: 'startng:whoami' }, 'startng:user');
  return reply && (reply.user ?? null);
}

/** The signed-in start.ng user ({ id, name, style }), or null. */
export async function getCurrentUser() {
  return (await check()) ?? null;
}

/** Re-checks when the tab becomes visible or gains focus. Checks that got no answer are ignored. */
export function onUserChange(fn) {
  const recheck = async () => {
    if (document.visibilityState !== 'visible') return;
    const user = await check();
    if (user !== undefined) fn(user);
  };
  document.addEventListener('visibilitychange', recheck);
  addEventListener('focus', recheck);
}

/** Sends the player to start.ng to sign in; start.ng brings them back afterwards. */
export function signIn() {
  location.href = `${START_NG}/?return_to=${encodeURIComponent(location.href)}`;
}
