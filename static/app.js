// Window manager and app behaviors
(() => {
  const windowsRoot = document.getElementById('windows-root');
  let zIndexCounter = 200;
  let winCounter = 0;

  // Basic app content stubs (replace with richer UIs if you want)
  function appContentFor(name) {
    if (name === 'Command Prompt' || name === 'Terminal') {
      return createTerminalContent();
    }
    // simple stub content for other apps
    return `<div style="padding:12px;font-size:14px">
      <h3>${escapeHtml(name)}</h3>
      <p>This is a fake ${escapeHtml(name)} window.</p>
    </div>`;
  }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // create a new window element
  function createWindow(title, htmlContent) {
    const winId = `appwin-${++winCounter}`;
    const el = document.createElement('div');
    el.className = 'app-window';
    el.id = winId;
    el.style.left = `${60 + (winCounter * 20) % 300}px`;
    el.style.top = `${40 + (winCounter * 10) % 120}px`;
    el.style.zIndex = ++zIndexCounter;

    el.innerHTML = `
      <div class="titlebar">
        <div class="title"><span class="dot"></span><span>${escapeHtml(title)}</span></div>
        <div class="controls">
          <span class="ctrl-btn min" title="Minimize"></span>
          <span class="ctrl-btn max" title="Maximize"></span>
          <span class="ctrl-btn close" title="Close"></span>
        </div>
      </div>
      <div class="content">${typeof htmlContent === 'string' ? htmlContent : ''}</div>
    `;

    // if htmlContent is DOM element, append it
    if (typeof htmlContent !== 'string') {
      const content = el.querySelector('.content');
      content.innerHTML = '';
      content.appendChild(htmlContent);
    }

    // add draggable titlebar
    const titlebar = el.querySelector('.titlebar');
    let isDragging = false;
    let dragOffset = {x:0,y:0};

    titlebar.addEventListener('mousedown', e => {
      if (e.target.classList.contains('ctrl-btn')) return;
      isDragging = true;
      dragOffset.x = e.clientX - el.getBoundingClientRect().left;
      dragOffset.y = e.clientY - el.getBoundingClientRect().top;
      bringToFront(el);
      titlebar.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', e => {
      if (!isDragging) return;
      el.style.left = (e.clientX - dragOffset.x) + 'px';
      el.style.top = (e.clientY - dragOffset.y) + 'px';
    });
    window.addEventListener('mouseup', () => {
      isDragging = false;
      titlebar.style.cursor = 'grab';
    });

    // controls
    const btnMin = el.querySelector('.ctrl-btn.min');
    const btnMax = el.querySelector('.ctrl-btn.max');
    const btnClose = el.querySelector('.ctrl-btn.close');

    btnMin.addEventListener('click', e => {
      e.stopPropagation();
      el.classList.toggle('minimized');
      if (!el.classList.contains('minimized')) {
        bringToFront(el);
      }
    });
    btnMax.addEventListener('click', e => {
      e.stopPropagation();
      el.classList.toggle('fullscreen');
      bringToFront(el);
      // reset position for fullscreen windows
      if (el.classList.contains('fullscreen')) {
        el.style.left = '0px';
        el.style.top = '0px';
      }
    });
    btnClose.addEventListener('click', e => {
      e.stopPropagation();
      el.remove();
    });

    // focus on click
    el.addEventListener('mousedown', () => bringToFront(el));

    windowsRoot.appendChild(el);
    bringToFront(el);
    return el;
  }

  function bringToFront(el) {
    zIndexCounter++;
    el.style.zIndex = zIndexCounter;
    // add visual focused class and remove from others
    document.querySelectorAll('.app-window').forEach(w => w.classList.remove('focused'));
    el.classList.add('focused');
  }

  // create terminal DOM which wires to server
  function createTerminalContent() {
    const wrapper = document.createElement('div');
    wrapper.className = 'terminal';
    const output = document.createElement('div'); output.className = 'terminal-output';
    const inputWrapper = document.createElement('div'); inputWrapper.className = 'terminal-input-wrapper';
    const input = document.createElement('input'); input.className = 'terminal-input';
    input.placeholder = 'Type a command and press Enter (runs on server)';
    const send = document.createElement('button'); send.className = 'terminal-send'; send.textContent = 'Send';
    inputWrapper.appendChild(input);
    inputWrapper.appendChild(send);
    wrapper.appendChild(output);
    wrapper.appendChild(inputWrapper);

    function appendLine(text, isErr=false) {
      const el = document.createElement('div');
      el.textContent = text;
      el.style.whiteSpace = 'pre-wrap';
      if (isErr) el.style.color = '#ff8080';
      output.appendChild(el);
      output.scrollTop = output.scrollHeight;
    }

    async function sendCommand(cmd) {
      if (!cmd.trim()) return;
      appendLine(`$ ${cmd}`);
      try {
        const res = await fetch('/run', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({cmd})
        });
        if (!res.ok) {
          appendLine(`(error) HTTP ${res.status}`, true);
          return;
        }
        const data = await res.json();
        if (data.stdout) appendLine(data.stdout);
        if (data.stderr) appendLine(data.stderr, true);
        appendLine(`[exit ${data.returncode}]`);
      } catch (err) {
        appendLine('(network error) ' + err.message, true);
      }
    }

    // handle Enter
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const v = input.value;
        input.value = '';
        sendCommand(v);
      }
    });
    send.addEventListener('click', () => {
      const v = input.value;
      input.value = '';
      sendCommand(v);
    });

    return wrapper;
  }

  // wire icons and dock
  function wireLaunchpad() {
    document.querySelectorAll('.icon, .dock-icon').forEach(el => {
      el.addEventListener('click', () => {
        const app = el.dataset.app || 'App';
        if (app === 'Command Prompt' || app === 'Terminal') {
          createWindow('Terminal', createTerminalContent());
        } else {
          createWindow(app, appContentFor(app));
        }
      });
    });
  }

  // init
  wireLaunchpad();

  // expose for console
  window._fakeGUI = { createWindow, createTerminalContent };

})();
