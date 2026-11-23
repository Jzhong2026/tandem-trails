import { api, esc, subjectNames, gradeName, termName, time, safeOfficial } from './shared.js';
import { createBoard } from './board.js';

export function openPlayer(app, l, book, previous) {
  const duration = l.durations.reduce((a, b) => a + b, 0);
  const starts = l.durations.map((_, i) => l.durations.slice(0, i).reduce((a, b) => a + b, 0));
  const official = safeOfficial(l.officialUrl);
  app.innerHTML =
    '<a class="crumb" href="#library">‹ 返回课程书架</a><p class="meta">' +
    gradeName(l.grade) +
    ' · ' +
    subjectNames[l.subject] +
    ' · ' +
    termName(l.term) +
    '　' +
    esc(l.unit) +
    '</p><h1 class="lesson-title">' +
    esc(l.title) +
    '</h1>' +
    '<div class="study-grid"><div class="theater"><div class="stage"></div><div class="caption" aria-label="同步字幕"></div><div class="controls"><button id="play">播放</button><span class="time"></span><input class="seek" type="range" min="0" max="' +
    duration +
    '" step="0.05" value="0" aria-label="播放进度">' +
    '<button id="mute" aria-pressed="false">静音</button><select id="speed" aria-label="播放速度"><option value=".75">0.75×</option><option selected value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select><button id="full">全屏</button></div>' +
    '<audio preload="auto" src="' +
    esc(l.audio) +
    '"></audio></div><aside class="panel side"><h2>本课分镜</h2>' +
    l.scenes
      .map(
        (s, i) =>
          '<button class="scene-btn" data-scene="' +
          i +
          '">' +
          time(starts[i]) +
          '　' +
          esc(s.label) +
          '</button>',
      )
      .join('') +
    '<label class="sibling">切换本册课程<select id="jump">' +
    book
      .map(
        (x) =>
          '<option value="' +
          x.id +
          '" ' +
          (x.id === l.id ? 'selected' : '') +
          '>' +
          esc(x.title) +
          '</option>',
      )
      .join('') +
    '</select></label>' +
    (official
      ? '<a class="text-link" target="_blank" rel="noopener" href="' + esc(official) + '">观看官方课堂 ↗</a>'
      : '') +
    '</aside></div>' +
    '<div class="below"><section class="panel transcript"><h2>讲解文字</h2>' +
    l.scenes
      .map((s) => '<details><summary>' + esc(s.label) + '</summary><p>' + esc(s.say) + '</p></details>')
      .join('') +
    '</section>' +
    '<section class="panel quiz"><h2>随堂练习</h2><h3>' +
    esc(l.question) +
    '</h3><div class="choices">' +
    l.choices
      .map(
        (s, i) =>
          '<button class="choice" aria-pressed="false" data-choice="' +
          i +
          '">' +
          String.fromCharCode(65 + i) +
          '　' +
          esc(s) +
          '</button>',
      )
      .join('') +
    '</div><p class="feedback" role="status">' +
    (previous?.mastered ? '上次已答对，可以再练一次。' : '') +
    '</p></section></div><p class="hint save-status" role="status"></p>';
  const $ = (q) => app.querySelector(q);
  const audio = $('audio'),
    seek = $('.seek'),
    play = $('#play'),
    caption = $('.caption'),
    clock = $('.time'),
    saveStatus = $('.save-status');
  const scenes = [...app.querySelectorAll('.scene-btn')],
    draw = createBoard($('.stage'), l);
  let frame = 0,
    active = -1,
    live = true,
    started = false,
    lastSave = -1,
    queue = Promise.resolve(),
    lastCaption = '';
  let resume = previous?.seconds > 0 && previous.seconds < duration - 1 ? previous.seconds : 0;
  function post(data) {
    return api('/api/lessons/' + l.id + '/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }
  function save(force = false) {
    if (!started) return queue;
    const pos = audio.ended ? duration : audio.currentTime;
    if (!force && Math.abs(lastSave - pos) < 5) return queue;
    lastSave = pos;
    queue = queue
      .then(() => post({ seconds: pos }))
      .then(() => {
        saveStatus.textContent = '';
      })
      .catch(() => {
        saveStatus.textContent = '进度未能保存，请检查本地课程服务。';
      });
    return queue;
  }
  function render() {
    const t = audio.readyState ? audio.currentTime : resume;
    const i = Math.max(
      0,
      starts.findLastIndex((s) => t >= s),
    );
    const local = Math.max(0, t - starts[i]);
    if (i !== active) {
      scenes.forEach((b, j) => {
        b.classList.toggle('active', j === i);
        b.setAttribute('aria-current', j === i ? 'step' : 'false');
      });
      active = i;
    }
    draw(i, local / l.durations[i]);
    const cues = l.captions?.[i] || [];
    const current = (cues.findLast((c) => c[0] <= local + 0.06) || cues[0])?.[1] || l.scenes[i].say;
    if (current !== lastCaption) {
      caption.textContent = current;
      lastCaption = current;
    }
    clock.textContent = time(t) + ' / ' + time(duration);
    seek.value = t;
    play.textContent = audio.ended ? '重播' : audio.paused ? '播放' : '暂停';
    if (!audio.paused) save();
  }
  function tick() {
    render();
    if (live && !audio.paused) frame = requestAnimationFrame(tick);
  }
  function start() {
    audio.play().catch(() => {
      saveStatus.textContent = '音频未开始播放，请再点一次播放。';
    });
  }
  function jump(seconds) {
    resume = seconds;
    audio.currentTime = seconds;
    started = true;
    render();
    save(true);
  }
  audio.onloadedmetadata = () => {
    if (resume) audio.currentTime = resume;
    render();
  };
  audio.onplay = () => {
    started = true;
    cancelAnimationFrame(frame);
    tick();
  };
  audio.onpause = () => {
    cancelAnimationFrame(frame);
    render();
    save(true);
  };
  audio.onseeked = render;
  audio.onended = () => {
    render();
    save(true);
  };
  audio.onerror = () => {
    saveStatus.textContent = '旁白加载失败，请刷新页面重试。';
  };
  play.onclick = () => {
    if (audio.paused) {
      if (audio.ended) jump(0);
      start();
    } else audio.pause();
  };
  seek.oninput = () => {
    resume = Number(seek.value);
    audio.currentTime = resume;
    started = true;
    render();
  };
  seek.onchange = () => save(true);
  scenes.forEach((b, i) => (b.onclick = () => jump(starts[i])));
  $('#speed').onchange = (e) => {
    audio.playbackRate = Number(e.target.value);
  };
  $('#mute').onclick = (e) => {
    audio.muted = !audio.muted;
    e.target.textContent = audio.muted ? '开启声音' : '静音';
    e.target.setAttribute('aria-pressed', String(audio.muted));
  };
  $('#full').onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await $('.theater').requestFullscreen();
    } catch {
      saveStatus.textContent = '当前浏览器不支持全屏播放。';
    }
  };
  $('#jump').onchange = (e) => {
    location.hash = 'lesson/' + e.target.value;
  };
  const choices = [...app.querySelectorAll('.choice')],
    feedback = $('.feedback');
  choices.forEach(
    (b, i) =>
      (b.onclick = async () => {
        choices.forEach((x) => {
          x.disabled = true;
          x.setAttribute('aria-pressed', String(x === b));
        });
        try {
          const r = await post({ choice: i });
          feedback.textContent = (r.correct ? '答对了！' : '再想一想。') + r.explanation;
        } catch {
          feedback.textContent = '答案未能保存，请再试一次。';
        } finally {
          choices.forEach((x) => (x.disabled = false));
        }
      }),
  );
  const leaving = () => {
    if (started)
      navigator.sendBeacon(
        '/api/lessons/' + l.id + '/progress',
        new Blob([JSON.stringify({ seconds: audio.ended ? duration : audio.currentTime })], {
          type: 'application/json',
        }),
      );
  };
  window.addEventListener('pagehide', leaving);
  render();
  return () => {
    live = false;
    cancelAnimationFrame(frame);
    window.removeEventListener('pagehide', leaving);
    audio.onplay =
      audio.onpause =
      audio.onseeked =
      audio.onended =
      audio.onerror =
      audio.onloadedmetadata =
        null;
    audio.pause();
    const pending = save(true);
    audio.removeAttribute('src');
    audio.load();
    return pending;
  };
}
