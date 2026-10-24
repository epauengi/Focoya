(function () {
  'use strict';

  const THEMES = ['All Rooms', 'Study', 'Café', 'Nature', 'Gaming', 'Chill'];

  const appContainer = document.getElementById('app');

  const appState = {
    selectedTheme: 'All Rooms',
    searchQuery: '',
    isLoading: true
  };

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getRoomById(roomId) {
    if (!window.ROOMS || !Array.isArray(window.ROOMS)) return null;
    return window.ROOMS.find((room) => String(room.id) === String(roomId));
  }

  async function joinRoom(room) {
    throw new Error('Tính năng kết nối phòng trực tiếp chưa khả dụng.');
  }

  function createRoomCardHtml(room) {
    const isBusy = room.online >= 15;
    return `
      <a class="card" href="#/rooms/${room.id}">
        <div class="thumb">
          <img src="${room.image}" alt="${escapeHtml(room.name)}" loading="lazy">
          <span class="tag">${escapeHtml(room.theme)}</span>
        </div>
        <div class="meta">
          <h3>${escapeHtml(room.name)}</h3>
          <span class="online">
            <span class="dot ${isBusy ? 'busy' : ''}"></span>
            ${room.online} online
          </span>
        </div>
      </a>
    `;
  }

  function createSkeletonCardHtml() {
    return `
      <div class="card">
        <div class="thumb sk"></div>
        <div class="meta">
          <div class="sk sk-line" style="width: 130px"></div>
          <div class="sk sk-line" style="width: 64px"></div>
        </div>
      </div>
    `;
  }

  function renderGrid() {
    const query = appState.searchQuery.trim().toLowerCase();
    const filteredRooms = (window.ROOMS || []).filter((room) => {
      const matchTheme = appState.selectedTheme === 'All Rooms' || room.theme === appState.selectedTheme;
      const matchQuery = room.name.toLowerCase().includes(query);
      return matchTheme && matchQuery;
    });

    const chipsContainer = document.getElementById('chips');
    if (chipsContainer) {
      chipsContainer.innerHTML = THEMES.map((theme) => {
        const isActive = theme === appState.selectedTheme;
        return `
          <button class="chip ${isActive ? 'on' : ''}" data-t="${theme}" role="tab" aria-selected="${isActive}">
            ${theme}
          </button>
        `;
      }).join('');
    }

    const gridContainer = document.getElementById('grid');
    if (!gridContainer) return;

    if (appState.isLoading) {
      gridContainer.style.display = '';
      gridContainer.innerHTML = Array(6).fill(0).map(createSkeletonCardHtml).join('');
      return;
    }

    if (filteredRooms.length === 0) {
      gridContainer.style.display = 'block';
      gridContainer.innerHTML = `
        <div class="panel">
          <h2>Không tìm thấy phòng nào</h2>
          <p>Hãy thử tìm kiếm với từ khóa khác hoặc chọn chủ đề khác.</p>
          <button class="btn" id="reset">Xem tất cả phòng</button>
        </div>
      `;
      return;
    }

    gridContainer.style.display = '';
    gridContainer.innerHTML = filteredRooms.map(createRoomCardHtml).join('');
  }

  function renderExplorePage() {
    appContainer.innerHTML = `
      <section class="hero">
        <div>
          <h1>Explore Rooms</h1>
          <p class="lead">Khám phá không gian học tập, kết nối cùng bạn bè và nâng cao hiệu suất.</p>
        </div>
        <input 
          class="search" 
          id="search" 
          placeholder="Tìm kiếm phòng học…" 
          aria-label="Tìm kiếm phòng học" 
          value="${escapeHtml(appState.searchQuery)}"
        >
      </section>

      <div class="chips" id="chips" role="tablist"></div>
      <div class="grid" id="grid"></div>
    `;

    renderGrid();

    const searchInput = document.getElementById('search');
    if (searchInput) {
      searchInput.oninput = function (event) {
        appState.searchQuery = event.target.value;
        renderGrid();
      };
    }

    appContainer.onclick = function (event) {
      const chipBtn = event.target.closest('[data-t]');
      if (chipBtn) {
        appState.selectedTheme = chipBtn.dataset.t;
        renderGrid();
        return;
      }

      if (event.target.id === 'reset') {
        appState.selectedTheme = 'All Rooms';
        appState.searchQuery = '';
        renderExplorePage();
        return;
      }
    };

    if (appState.isLoading) {
      setTimeout(() => {
        appState.isLoading = false;
        renderGrid();
      }, 900);
    }
  }

  function renderPreviewPage(roomId) {
    appContainer.onclick = null;
    const room = getRoomById(roomId);
    const backButtonHtml = `<a class="btn-ghost" href="#/">← Quay lại Khám phá</a>`;

    if (!room) {
      appContainer.innerHTML = `
        ${backButtonHtml}
        <div class="panel" style="max-width: 440px; margin: 40px auto 0;">
          <h2>Không tìm thấy phòng</h2>
          <p>Không tìm thấy phòng học với mã ID “${escapeHtml(roomId)}”.</p>
          <a class="btn" href="#/">Quay lại Khám phá</a>
        </div>
      `;
      return;
    }

    const availableSlots = Math.max(room.maxSlots - room.online, 0);

    appContainer.innerHTML = `
      ${backButtonHtml}
      <div class="preview">
        <div class="scene">
          <img src="${room.image}" alt="${escapeHtml(room.name)}">
          <span class="tag">${escapeHtml(room.theme)}</span>
        </div>

        <section class="info">
          <span class="pill">${escapeHtml(room.theme)}</span>
          <h1>${escapeHtml(room.name)}</h1>
          <p class="lead">${escapeHtml(room.description)}</p>

          <dl class="stats">
            <div>
              <dt>Đang học</dt>
              <dd>${room.online}</dd>
            </div>
            <div>
              <dt>Tối đa</dt>
              <dd>${room.maxSlots}</dd>
            </div>
            <div>
              <dt>Chỗ trống</dt>
              <dd>${availableSlots}</dd>
            </div>
          </dl>

          <p class="note">Dữ liệu thử nghiệm — số lượng chỗ chỉ mang tính chất minh họa.</p>

          <div class="cta">
            <button id="join" ${availableSlots > 0 ? '' : 'disabled'}>
              ${availableSlots > 0 ? 'Vào phòng học' : 'Phòng đã đầy'}
            </button>
            <p class="status">Chế độ xem thử — chưa kết nối máy chủ phòng.</p>
          </div>
        </section>
      </div>
    `;

    const joinBtn = document.getElementById('join');
    if (joinBtn) {
      joinBtn.onclick = async function () {
        joinBtn.disabled = true;
        joinBtn.textContent = 'Đang vào phòng…';
        try {
          await joinRoom(room);
        } catch (error) {}
        location.hash = '#/room/' + room.id;
      };
    }
  }

  const TIMER_MODES = {
    focus: { name: 'Tập trung', minutes: 25 },
    short: { name: 'Nghỉ ngắn', minutes: 5 },
    long: { name: 'Nghỉ dài', minutes: 15 }
  };

  let pomodoroTimer = null;

  function renderRoomView(roomId) {
    const room = getRoomById(roomId) || window.ROOMS[0];
    let currentMode = 'focus';
    let timeLeft = TIMER_MODES.focus.minutes * 60;

    document.body.classList.add('in-room');

    appContainer.innerHTML = `
      <div class="room" style="background-image: url('${room.image}')">
        <div class="room-top">
          <a href="#/" class="room-logo">Focoya</a>
          <span class="room-name">${escapeHtml(room.name)} · ${room.online} online</span>
        </div>

        <div class="live-corner" id="live-corner" hidden></div>

        <div class="room-center">
          <div id="live-view" class="live-view">
            <p class="greet" id="greet"></p>
            <div class="live" id="live"></div>
            <button class="timer-toggle" id="to-timer">⏱ Hẹn giờ Pomodoro</button>
          </div>

          <div id="timer-view" hidden class="timer-view">
            <div class="modes">
              <button data-mode="focus" class="on">Tập trung</button>
              <button data-mode="short">Nghỉ ngắn</button>
              <button data-mode="long">Nghỉ dài</button>
            </div>

            <div class="clock-card">
              <div class="clock" id="clock">25:00</div>
              <div class="clock-ctrl">
                <button id="play" aria-label="Bắt đầu">▶</button>
                <button id="reset-timer" aria-label="Đặt lại">↺</button>
              </div>
            </div>

            <button class="timer-toggle" id="to-live">✕ Tắt hẹn giờ</button>
          </div>
        </div>

        <div class="room-bottom">
          <div class="tasks-wrap">
            <button class="tool" id="tasks-btn" title="Danh sách công việc" aria-label="Danh sách task">☰</button>
            <div class="tasks" id="tasks" hidden>
              <div class="tasks-h">
                <b>Công việc cần làm</b>
                <small>Lưu tạm trên trình duyệt</small>
              </div>
              <ul id="task-list"></ul>
              <form id="task-form">
                <input placeholder="Thêm công việc mới…" aria-label="Công việc mới">
                <button type="submit">+</button>
              </form>
            </div>
          </div>

          <div class="tools">
            <div class="modes-dock" role="tablist">
              <button class="on" data-dock="ambient" title="Âm thanh nền (Ambient)" aria-label="Ambient">
                <img src="assets/cloud.svg" alt="" width="18" height="18">
              </button>
              <button data-dock="home" title="Trang chủ" aria-label="Trang chủ">
                <img src="assets/home.svg" alt="" width="18" height="18">
              </button>
              <button data-dock="tips" title="Mẹo học tập" aria-label="Gợi ý">
                <img src="assets/bulb.svg" alt="" width="18" height="18">
              </button>
            </div>

            <button class="tool" data-open="settings" data-tab="theme" title="Cài đặt" aria-label="Cài đặt">
              <img src="assets/settings.svg" alt="" width="18" height="18">
            </button>

            <button class="tool" id="fs" title="Toàn màn hình" aria-label="Toàn màn hình">
              <img src="assets/fullscreen.svg" alt="" width="18" height="18">
            </button>
          </div>
        </div>
      </div>
    `;

    const clockElement = document.getElementById('clock');
    const playButton = document.getElementById('play');

    function updateTimerDisplay() {
      const minutes = String(Math.floor(timeLeft / 60)).padStart(2, '0');
      const seconds = String(timeLeft % 60).padStart(2, '0');
      clockElement.textContent = `${minutes}:${seconds}`;
    }

    function stopTimer() {
      if (pomodoroTimer) {
        clearInterval(pomodoroTimer);
        pomodoroTimer = null;
      }
      playButton.textContent = '▶';
    }

    updateTimerDisplay();

    function updateLiveClock() {
      const now = new Date();
      const hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const timeString = `${hours}:${minutes}`;

      let greeting = 'Chào buổi tối';
      let message = 'Thư giãn một chút nhé!';

      if (hours < 11) {
        greeting = 'Chào buổi sáng';
        message = 'Bắt đầu ngày mới thật năng suất!';
      } else if (hours < 14) {
        greeting = 'Chào buổi trưa';
        message = 'Nạp năng lượng cho buổi chiều nào!';
      } else if (hours < 18) {
        greeting = 'Chào buổi chiều';
        message = 'Cùng tập trung học tập nào!';
      }

      const liveDisplay = document.getElementById('live');
      const liveCorner = document.getElementById('live-corner');
      const greetDisplay = document.getElementById('greet');

      if (liveDisplay) liveDisplay.textContent = timeString;
      if (liveCorner) liveCorner.textContent = timeString;
      if (greetDisplay) greetDisplay.textContent = `${greeting}, SE347. ${message}`;
    }

    updateLiveClock();
    clearInterval(window.__liveTick);
    window.__liveTick = setInterval(updateLiveClock, 1000);

    function toggleTimerView(showTimer) {
      document.getElementById('live-view').hidden = showTimer;
      document.getElementById('timer-view').hidden = !showTimer;
      document.getElementById('live-corner').hidden = !showTimer;
      if (!showTimer) {
        stopTimer();
      }
    }

    const taskItems = [
      { text: 'Ôn tập chương 3 kiến trúc phần mềm', completed: false },
      { text: 'Làm bài tập lớn SE347 UI/UX', completed: true }
    ];

    function renderTaskList() {
      const taskListElement = document.getElementById('task-list');
      if (!taskListElement) return;

      if (taskItems.length === 0) {
        taskListElement.innerHTML = '<li class="muted">Chưa có công việc nào.</li>';
        return;
      }

      taskListElement.innerHTML = taskItems.map((task, index) => `
        <li>
          <label>
            <input type="checkbox" data-index="${index}" ${task.completed ? 'checked' : ''}>
            <span>${escapeHtml(task.text)}</span>
          </label>
          <button type="button" data-delete="${index}" aria-label="Xóa">×</button>
        </li>
      `).join('');
    }

    renderTaskList();

    const taskForm = document.getElementById('task-form');
    if (taskForm) {
      taskForm.onsubmit = function (event) {
        event.preventDefault();
        const input = taskForm.querySelector('input');
        const text = input ? input.value.trim() : '';
        if (text) {
          taskItems.push({ text: text, completed: false });
          input.value = '';
          renderTaskList();
        }
      };
    }

    const taskListElement = document.getElementById('task-list');
    if (taskListElement) {
      taskListElement.onchange = function (event) {
        const index = event.target.dataset.index;
        if (index != null && taskItems[index]) {
          taskItems[index].completed = event.target.checked;
        }
      };
    }

    appContainer.onclick = function (event) {
      const modeBtn = event.target.closest('[data-mode]');
      if (modeBtn) {
        stopTimer();
        currentMode = modeBtn.dataset.mode;
        timeLeft = TIMER_MODES[currentMode].minutes * 60;
        updateTimerDisplay();

        appContainer.querySelectorAll('[data-mode]').forEach((btn) => {
          btn.classList.toggle('on', btn === modeBtn);
        });
        return;
      }

      if (event.target.id === 'play') {
        if (pomodoroTimer) {
          stopTimer();
          return;
        }

        playButton.textContent = '❚❚';
        pomodoroTimer = setInterval(() => {
          timeLeft = Math.max(timeLeft - 1, 0);
          updateTimerDisplay();

          if (timeLeft === 0) {
            stopTimer();
            if (window.FocoyaToast) {
              window.FocoyaToast('Hết giờ ' + TIMER_MODES[currentMode].name + '!');
            }
          }
        }, 1000);
        return;
      }

      if (event.target.id === 'reset-timer') {
        stopTimer();
        timeLeft = TIMER_MODES[currentMode].minutes * 60;
        updateTimerDisplay();
        return;
      }

      if (event.target.closest('#to-timer')) {
        toggleTimerView(true);
        return;
      }

      if (event.target.closest('#to-live')) {
        toggleTimerView(false);
        return;
      }

      const dockBtn = event.target.closest('[data-dock]');
      if (dockBtn) {
        appContainer.querySelectorAll('[data-dock]').forEach((btn) => {
          btn.classList.toggle('on', btn === dockBtn);
        });

        if (dockBtn.dataset.dock === 'home') {
          location.hash = '#/';
        } else if (window.FocoyaToast) {
          window.FocoyaToast(dockBtn.title + ': tính năng đang phát triển.');
        }
        return;
      }

      if (event.target.closest('#tasks-btn')) {
        const tasksBox = document.getElementById('tasks');
        if (tasksBox) {
          tasksBox.hidden = !tasksBox.hidden;
        }
        return;
      }

      const delBtn = event.target.closest('[data-delete]');
      if (delBtn) {
        const delIndex = Number(delBtn.dataset.delete);
        taskItems.splice(delIndex, 1);
        renderTaskList();
        return;
      }

      if (event.target.closest('#fs')) {
        const notifyFailure = () => {
          if (window.FocoyaToast) {
            window.FocoyaToast('Trình duyệt không cho phép toàn màn hình hoặc cần mở trong tab riêng.');
          }
        };

        try {
          const rootElement = document.documentElement;
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(notifyFailure);
          } else if (document.fullscreenEnabled && rootElement.requestFullscreen) {
            rootElement.requestFullscreen().catch(notifyFailure);
          } else {
            notifyFailure();
          }
        } catch (error) {
          notifyFailure();
        }
      }
    };
  }

  window.FocoyaSetRoomBg = function (imageSrc) {
    const roomElement = document.querySelector('.room');
    if (roomElement && imageSrc) {
      roomElement.style.backgroundImage = `url('${imageSrc}')`;
    }
  };

  function handleRouting() {
    if (pomodoroTimer) {
      clearInterval(pomodoroTimer);
      pomodoroTimer = null;
    }
    clearInterval(window.__liveTick);
    document.body.classList.remove('in-room');

    const currentHash = location.hash;
    const isMyRooms = currentHash.startsWith('#/my-rooms');

    document.querySelectorAll('[data-nav]').forEach((navLink) => {
      const isTarget = (navLink.dataset.nav === 'my') === isMyRooms;
      navLink.classList.toggle('active', isTarget);
    });

    const roomMatch = currentHash.match(/^#\/room\/([^/]+)/);
    if (roomMatch) {
      renderRoomView(decodeURIComponent(roomMatch[1]));
      return;
    }

    if (isMyRooms) {
      renderRoomView(1);
      return;
    }

    const previewMatch = currentHash.match(/^#\/rooms\/([^/]+)/);
    window.scrollTo(0, 0);

    if (previewMatch) {
      renderPreviewPage(decodeURIComponent(previewMatch[1]));
    } else {
      renderExplorePage();
    }
  }

  window.addEventListener('hashchange', handleRouting);
  handleRouting();

})();
