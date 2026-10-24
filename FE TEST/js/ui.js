(function () {
  'use strict';

  function getElement(id) {
    return document.getElementById(id);
  }

  let toastTimer = null;

  function showToast(message) {
    const toastElement = getElement('toast');
    if (!toastElement) return;

    toastElement.textContent = message;
    toastElement.hidden = false;

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastElement.hidden = true;
    }, 2400);
  }

  window.FocoyaToast = showToast;

  const userMenu = getElement('menu');
  const accountBtn = getElement('acct');

  function toggleUserMenu(isOpen) {
    if (!userMenu || !accountBtn) return;
    userMenu.hidden = !isOpen;
    accountBtn.setAttribute('aria-expanded', String(isOpen));
  }

  if (accountBtn && userMenu) {
    accountBtn.onclick = function (event) {
      event.stopPropagation();
      toggleUserMenu(userMenu.hidden);
    };

    document.addEventListener('click', function (event) {
      if (!userMenu.contains(event.target)) {
        toggleUserMenu(false);
      }
    });
  }

  let previousFocusedElement = null;

  function openModal(modalId, tabName) {
    toggleUserMenu(false);
    previousFocusedElement = document.activeElement;

    const modal = getElement(modalId);
    if (!modal) return;

    modal.hidden = false;

    if (modalId === 'settings') {
      renderSettingsTab(tabName || 'theme');
    }

    const firstInput = modal.querySelector('input, button:not([data-close])');
    if (firstInput) {
      firstInput.focus();
    }
  }

  function closeModal(modalElement) {
    if (!modalElement) return;
    modalElement.hidden = true;
    if (previousFocusedElement && typeof previousFocusedElement.focus === 'function') {
      previousFocusedElement.focus();
    }
  }

  document.addEventListener('click', function (event) {
    const openBtn = event.target.closest('[data-open]');
    if (openBtn) {
      event.preventDefault();
      openModal(openBtn.dataset.open, openBtn.dataset.tab);
      return;
    }

    const placeholderBtn = event.target.closest('[data-placeholder]');
    if (placeholderBtn) {
      event.preventDefault();
      showToast(placeholderBtn.dataset.placeholder + ': Tính năng đang được hoàn thiện.');
      return;
    }

    const isCloseBtn = event.target.closest('[data-close]');
    const isOverlayBackdrop = event.target.classList.contains('overlay');
    if (isCloseBtn || isOverlayBackdrop) {
      const activeOverlay = event.target.closest('.overlay');
      closeModal(activeOverlay);
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      document.querySelectorAll('.overlay:not([hidden])').forEach(closeModal);
    }
  });

  const eyeBtn = getElement('eye');
  if (eyeBtn) {
    eyeBtn.onclick = function () {
      const pwInput = getElement('pw');
      if (pwInput) {
        pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
      }
    };
  }

  const loginForm = getElement('login-form');
  if (loginForm) {
    loginForm.onsubmit = function (event) {
      event.preventDefault();
      const emailInput = loginForm.querySelector('input[type="email"]');
      const pwInput = getElement('pw');
      const msgElement = getElement('login-msg');

      if (!emailInput.value.trim() || !pwInput.value.trim()) {
        msgElement.textContent = 'Vui lòng nhập đầy đủ email và mật khẩu.';
        return;
      }

      msgElement.textContent = 'Hệ thống chưa kết nối Backend xác thực người dùng.';
    };
  }

  const WALLPAPERS = [
    { name: 'Mặc định', src: '' },
    { name: 'Mưa', src: 'assets/rainy.jpg' },
    { name: 'Mùa thu', src: 'assets/autumn.png' },
    { name: 'Đêm', src: 'assets/midnight.png' }
  ];

  let selectedWallpaperIndex = 0;

  const SETTINGS_TABS = {
    theme: function () {
      const wallpaperListHtml = WALLPAPERS.map((item, index) => {
        const isSelected = index === selectedWallpaperIndex;
        const imgTag = item.src ? `<img src="${item.src}" alt="${item.name}">` : '';
        return `
          <button class="${isSelected ? 'on' : ''}" data-wall="${index}">
            ${imgTag}
            <span>${item.name}</span>
          </button>
        `;
      }).join('');

      return `
        <h2>Chủ đề & Giao diện</h2>
        <p class="desc">Tùy biến không gian làm việc theo cảm xúc và sở thích của bạn</p>
        <hr>

        <p style="font-size: 14px; font-weight: 600;">Bộ sưu tập Hình nền & Không gian học</p>
        <div class="wall">
          ${wallpaperListHtml}
        </div>
        <hr>

        <div class="toggle">
          <span>Hiển thị thông báo khi hết thời gian</span>
          <button class="sw" role="switch" aria-checked="true"></button>
        </div>

        <div class="toggle">
          <span>Bộ hẹn giờ tự động khởi động khi kết thúc phân đoạn</span>
          <button class="sw" role="switch" aria-checked="false"></button>
        </div>

        <h2 style="font-size: 17px; margin-top: 18px;">Âm thanh thông báo</h2>
        <p class="desc">Phát chuông báo khi một phiên tập trung hoàn tất.</p>

        <div class="sound">
          <span><span style="color: #8a8fa3">Đã chọn:</span> Lấp lánh (Sparkle)</span>
          <button class="outline" data-placeholder="Đổi âm thanh">Thay đổi</button>
        </div>

        <label class="vol">
          Âm lượng thông báo
          <input type="range" min="0" max="100" value="45">
        </label>
      `;
    },

    stats: function () {
      const daysOfWeek = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
      const weekHtml = daysOfWeek.map((day, index) => {
        const isToday = index === 6;
        return `
          <span>
            ${day}
            <i class="${isToday ? 'g' : ''}"></i>
          </span>
        `;
      }).join('');

      return `
        <h2>Thống kê học tập</h2>
        <p class="desc">Tổng hợp các chỉ số tập trung và bản đồ nhiệt theo giờ</p>

        <div class="stat-grid">
          <div class="stat">
            <div class="stat-h">
              <span>Chuỗi ngày liên tiếp</span>
              <span class="ic ic-o">🔥</span>
            </div>
            <div class="big">
              18 <small>ngày liên tục</small>
            </div>
            <p class="hint">Vượt kỷ lục cá nhân 4 ngày</p>
            <div class="week">
              ${weekHtml}
            </div>
          </div>

          <div class="stat">
            <div class="stat-h">
              <span>Tổng thời gian tuần này</span>
              <span class="ic ic-p">+</span>
            </div>
            <div class="big">34h 20m</div>
            <p class="sm">
              <b class="up">+14%</b> Đạt 114% mục tiêu 30 giờ
            </p>
            <div class="bar">
              <i style="width: 100%;"></i>
            </div>
            <p class="sm row2">
              <span>Mục tiêu: 30 giờ</span>
              <b style="color: #60a5fa">Hoàn tất (+4h20m)</b>
            </p>
          </div>
        </div>

        <div class="stat heat">
          <div class="stat-h">
            <div>
              <b>Bản Đồ Nhiệt Tập Trung Theo Giờ</b>
              <p class="sm">Hai dải giờ tập trung cao nhất: <b style="color: #60a5fa">08:00 - 11:30</b> và <b style="color: #60a5fa">14:00 - 17:00</b></p>
            </div>
            <span class="legend">
              Ít 
              <i class="h0"></i>
              <i class="h1"></i>
              <i class="h2"></i>
              <i class="h3"></i> 
              Nhiều
            </span>
          </div>

          <div class="hgrid">
            <span class="hl">KHUNG GIỜ</span>
            <span class="hh">08:00</span>
            <span class="hh">10:00</span>
            <span class="hh">12:00</span>
            <span class="hh">14:00</span>
            <span class="hh">16:00</span>
            <span class="hh">20:00</span>
            <span class="hh">22:00</span>

            <span class="hl">Thứ 2</span>
            <i class="h2"></i><i class="h3"></i><i class="h0"></i><i class="h2"></i><i class="h1"></i><i class="h0"></i><i class="h0"></i>

            <span class="hl">Thứ 3</span>
            <i class="h3"></i><i class="h3"></i><i class="h0"></i><i class="h2"></i><i class="h3"></i><i class="h1"></i><i class="h1"></i>

            <span class="hl">Thứ 4</span>
            <i class="h1"></i><i class="h3"></i><i class="h0"></i><i class="h3"></i><i class="h2"></i><i class="h0"></i><i class="h0"></i>

            <span class="hl">Thứ 5</span>
            <i class="h3"></i><i class="h3"></i><i class="h0"></i><i class="h2"></i><i class="h3"></i><i class="h1"></i><i class="h0"></i>

            <span class="hl">Thứ 6</span>
            <i class="h2"></i><i class="h3"></i><i class="h0"></i><i class="h3"></i><i class="h1"></i><i class="h0"></i><i class="h0"></i>

            <span class="hl">Thứ 7</span>
            <i class="h0"></i><i class="h1"></i><i class="h0"></i><i class="h1"></i><i class="h0"></i><i class="h2"></i><i class="h3"></i>

            <span class="hl">Chủ Nhật</span>
            <i class="h0"></i><i class="h1"></i><i class="h0"></i><i class="h2"></i><i class="h0"></i><i class="h1"></i><i class="h2"></i>
          </div>

          <span class="tip">Khuyến nghị: Nghỉ giải lao 10 phút sau chuỗi học 90 phút</span>
        </div>

        <p class="note">Dữ liệu thử nghiệm — số liệu minh họa theo đề tài SE347.</p>
      `;
    },

    account: function () {
      return `
        <h2>Tài khoản người dùng</h2>
        <p class="desc">Quản lý thông tin cá nhân và múi giờ học tập</p>

        <form class="acct-form" onsubmit="return false">
          <label>
            Địa chỉ E-mail
            <input type="email" value="se347@gmail.com">
          </label>

          <label>
            Tên hiển thị
            <input type="text" value="SE347">
          </label>

          <label>
            Họ và tên đệm (không bắt buộc)
            <input type="text" value="UIT Student">
          </label>

          <label>
            Múi giờ hệ thống:
            <select>
              <option>Châu Á / Hồ Chí Minh (GMT+7)</option>
            </select>
          </label>

          <button class="b b-save" data-placeholder="Lưu thay đổi">Lưu thay đổi</button>
          <hr>
          <button class="b b-out" data-placeholder="Đăng xuất">Đăng xuất</button>
        </form>
      `;
    },

    help: function () {
      return `
        <h2>Trung tâm Trợ giúp</h2>
        <p class="desc">Hướng dẫn sử dụng hệ thống Focoya và giải đáp thắc mắc thường gặp</p>

        <details class="acc" open>
          <summary>
            <b>Hướng dẫn sử dụng cơ bản</b>
            <small>Các bước để sử dụng nền tảng hiệu quả</small>
          </summary>
          <ul class="guide">
            <li>Bắt đầu với Focoya</li>
            <li>Phương pháp học Pomodoro</li>
            <li>Tham gia phòng học ảo</li>
            <li>Theo dõi thống kê cá nhân</li>
          </ul>
        </details>

        <details class="acc" open>
          <summary>
            <b>Câu hỏi thường gặp (FAQ)</b>
            <small>Nhấp vào từng câu hỏi để xem chi tiết</small>
          </summary>
          <details class="faq">
            <summary><span>1</span>Tại sao bộ đếm giờ Pomodoro không chạy?</summary>
            <p>Hãy kiểm tra và nhấn nút ▶ để khởi động bộ đếm. Trình duyệt cũng cần được cho phép chạy nền.</p>
          </details>
          <details class="faq">
            <summary><span>2</span>Hoàn thành Pomodoro nhưng không nhận được XP?</summary>
            <p>Tính năng điểm kinh nghiệm và bảng xếp hạng đang trong lộ trình phát triển của Sprint tiếp theo.</p>
          </details>
          <details class="faq">
            <summary><span>3</span>Tại sao tôi chưa thấy camera của thành viên khác?</summary>
            <p>Phiên bản thử nghiệm TSK-11/14 tập trung vào UI/UX trước khi tích hợp hệ thống WebRTC Media Server.</p>
          </details>
          <details class="faq">
            <summary><span>4</span>Trạng thái STUDYING / BREAK nghĩa là gì?</summary>
            <p>Trạng thái tự động cập nhật dựa trên phiên Pomodoro bạn đang tham gia để báo hiệu cho bạn cùng phòng.</p>
          </details>
          <details class="faq">
            <summary><span>5</span>Cách bật âm thanh nền thiên nhiên (Ambient)?</summary>
            <p>Nhấp vào biểu tượng đám mây ở thanh công cụ dưới góc phải trong phòng học.</p>
          </details>
          <details class="faq">
            <summary><span>6</span>Dữ liệu học tập có được đồng bộ qua thiết bị khác?</summary>
            <p>Hiện tại dữ liệu được lưu tạm trên Local Storage của trình duyệt hiện hành.</p>
          </details>
        </details>

        <div class="contact">
          <div>
            <b>Cần trợ giúp thêm?</b>
            <p>Nếu bạn gặp sự cố kỹ thuật hoặc muốn góp ý cải tiến,<br>đội ngũ Focoya luôn sẵn sàng hỗ trợ.</p>
            <p class="mail">✉ Email: <code>support@focoya.com</code></p>
          </div>
          <div class="cbtn">
            <button class="b b-out" data-placeholder="Báo cáo sự cố">▲ Báo cáo lỗi</button>
            <button class="b b-save" data-placeholder="Liên hệ hỗ trợ">Liên hệ ngay</button>
          </div>
        </div>
      `;
    }
  };

  function renderSettingsTab(tabName) {
    const asideButtons = document.querySelectorAll('.settings aside button');
    asideButtons.forEach((btn) => {
      btn.classList.toggle('on', btn.dataset.tab === tabName);
    });

    const bodyContainer = getElement('settings-body');
    if (bodyContainer && SETTINGS_TABS[tabName]) {
      bodyContainer.innerHTML = SETTINGS_TABS[tabName]();
    }
  }

  const settingsModal = getElement('settings');
  if (settingsModal) {
    settingsModal.addEventListener('click', function (event) {
      const tabBtn = event.target.closest('aside [data-tab]');
      if (tabBtn) {
        renderSettingsTab(tabBtn.dataset.tab);
        return;
      }

      const wallBtn = event.target.closest('[data-wall]');
      if (wallBtn) {
        selectedWallpaperIndex = Number(wallBtn.dataset.wall);
        renderSettingsTab('theme');

        const chosenWall = WALLPAPERS[selectedWallpaperIndex];
        const newBg = chosenWall ? (chosenWall.src || 'assets/bg.png') : 'assets/bg.png';
        if (typeof window.FocoyaSetRoomBg === 'function') {
          window.FocoyaSetRoomBg(newBg);
        }
        return;
      }

      const switchBtn = event.target.closest('.sw');
      if (switchBtn) {
        const isChecked = switchBtn.getAttribute('aria-checked') === 'true';
        switchBtn.setAttribute('aria-checked', String(!isChecked));
        return;
      }
    });
  }

  function checkInitialLogin() {
    if (location.hash.startsWith('#/login')) {
      openModal('login');
      history.replaceState(null, '', '#/');
      return;
    }

    if (!sessionStorage.getItem('focoya-login-seen')) {
      sessionStorage.setItem('focoya-login-seen', '1');
      openModal('login');
    }
  }

  window.addEventListener('hashchange', function () {
    if (location.hash.startsWith('#/login')) {
      openModal('login');
      history.replaceState(null, '', '#/');
    }
  });

  checkInitialLogin();

})();
