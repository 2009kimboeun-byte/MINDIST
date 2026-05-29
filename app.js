// 구글 앱스 스크립트 웹 앱 URL을 여기에 붙여넣으세요.
// 스크립트 배포 전 테스트를 위해, 주소가 비어있을 때는 브라우저 로컬 데이터베이스(Mock DB)를 사용합니다.
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycby8p4sjySbkJDUxDg8Dq0tkhwryjohB52mDJzTLDQr6NMwfdgHsxZnvagliI5otwDJr/exec"; 

// 애플리케이션 상태 관리 객체
const state = {
  currentDate: new Date(),
  selectedDate: null,
  // localStorage에 저장된 기록이 있으면 불러오고, 없으면 빈 객체로 시작합니다.
  logs: JSON.parse(localStorage.getItem('safezone_logs')) || {},
  myLogs: null,
  currentUser: JSON.parse(localStorage.getItem('safezone_logged_in_user')) || null,
  viewingUser: null
};

// 기본 예시 데이터 설정 (첫 로드 시 심심하지 않도록 2개의 이전 성공 기록을 제공합니다)
if (Object.keys(state.logs).length === 0) {
  const today = new Date();
  
  // 어제 날짜 계산
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);
  
  // 그저께 날짜 계산
  const dayBeforeYesterday = new Date();
  dayBeforeYesterday.setDate(today.getDate() - 2);
  const dayBeforeStr = getLocalDateString(dayBeforeYesterday);
  
  state.logs[yesterdayStr] = {
    status: 'safe',
    diary: '친구들이 하굣길에 코인노래방 가자고 졸랐지만, 유혹을 뿌리치고 집으로 바로 돌아와 독서를 했습니다! 🌸',
    timestamp: new Date().getTime() - 86400000
  };
  
  state.logs[dayBeforeStr] = {
    status: 'safe',
    diary: '학교 정문 근처 PC방에 들르고 싶었지만 참아내고 바로 집으로 가는 버스에 탑승 성공! 😊',
    timestamp: new Date().getTime() - 172800000
  };
  
  localStorage.setItem('safezone_logs', JSON.stringify(state.logs));
}

// UI 요소 캐싱
const calendarGrid = document.getElementById('calendarGrid');
const currentMonthText = document.getElementById('currentMonthText');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');
const tabButtons = document.querySelectorAll('.tab-btn');
const bottomNavItems = document.querySelectorAll('.bottom-nav .nav-item');
const panels = document.querySelectorAll('.tab-content-panel');
const loggingModal = document.getElementById('loggingModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalDateTitle = document.getElementById('modalDateTitle');
const optionSafeBtn = document.getElementById('optionSafeBtn');
const optionUnsafeBtn = document.getElementById('optionUnsafeBtn');
const logDiaryText = document.getElementById('logDiaryText');
const submitLogBtn = document.getElementById('submitLogBtn');
const actionCreateLog = document.getElementById('actionCreateLog');
const btnBottomAdd = document.getElementById('btnBottomAdd');

// 유저 검색 모달 및 뷰잉 모드 UI 캐싱
const searchUserModal = document.getElementById('searchUserModal');
const closeSearchModalBtn = document.getElementById('closeSearchModalBtn');
const userSearchInput = document.getElementById('userSearchInput');
const userListContainer = document.getElementById('userListContainer');
const userListLoading = document.getElementById('userListLoading');
const userList = document.getElementById('userList');
const viewingModeHeader = document.getElementById('viewingModeHeader');
const viewingUserName = document.getElementById('viewingUserName');
const btnBackToMyCalendar = document.getElementById('btnBackToMyCalendar');
const readonlyAlert = document.getElementById('readonlyAlert');

// 프로필 사진 업로드 관련 UI 캐싱
const avatarWrapper = document.getElementById('avatarWrapper');
const avatarImg = document.getElementById('avatarImg');
const profileFileInput = document.getElementById('profileFileInput');

// 로그인/회원가입 관련 UI 요소 캐싱
const authScreen = document.getElementById('authScreen');
const loginFormContainer = document.getElementById('loginFormContainer');
const signupFormContainer = document.getElementById('signupFormContainer');
const btnGoToSignup = document.getElementById('btnGoToSignup');
const btnGoToLogin = document.getElementById('btnGoToLogin');
const btnLoginSubmit = document.getElementById('btnLoginSubmit');
const btnSignupSubmit = document.getElementById('btnSignupSubmit');
const loginNameInput = document.getElementById('loginName');
const loginPasswordInput = document.getElementById('loginPassword');
const signupNameInput = document.getElementById('signupName');
const signupSchoolSelect = document.getElementById('signupSchool');
const signupPasswordInput = document.getElementById('signupPassword');
const btnLogout = document.getElementById('btnLogout');

// 통계 관련 UI 요소
const statDaysResisted = document.getElementById('statDaysResisted');
const statStreak = document.getElementById('statStreak');
const statsResistRate = document.getElementById('statsResistRate');
const statsTotalCount = document.getElementById('statsTotalCount');
const statsStreakDays = document.getElementById('statsStreakDays');
const feedPosts = document.getElementById('feedPosts');

// 현재 모달창에서 선택된 임시 상태 ('safe' 또는 'unsafe')
let currentSelectedStatus = null;

// 초기 구동
document.addEventListener('DOMContentLoaded', () => {
  checkLoginStatus();
  renderCalendar();
  updateStatsAndBadges();
  setupEventListeners();
});

// 이벤트 리스너 등록
function setupEventListeners() {
  // 로그인/회원가입 화면 전환 이벤트
  btnGoToSignup.addEventListener('click', () => {
    loginFormContainer.style.display = 'none';
    signupFormContainer.style.display = 'flex';
  });
  
  btnGoToLogin.addEventListener('click', () => {
    signupFormContainer.style.display = 'none';
    loginFormContainer.style.display = 'flex';
  });

  // 로그인 제출 이벤트
  btnLoginSubmit.addEventListener('click', handleLogin);

  // 회원가입 제출 이벤트
  btnSignupSubmit.addEventListener('click', handleSignup);

  // 로그아웃 이벤트
  btnLogout.addEventListener('click', handleLogout);

  // 이전 달 이동
  prevMonthBtn.addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() - 1);
    renderCalendar();
  });
  
  // 다음 달 이동
  nextMonthBtn.addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() + 1);
    renderCalendar();
  });

  // 로고 클릭 시 오늘 날짜의 달력으로 초기화
  document.getElementById('logoText').addEventListener('click', () => {
    state.currentDate = new Date();
    renderCalendar();
  });

  // 인스타 탭 메뉴 변경
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // 하단 탭 네비게이션
  bottomNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      if (tabId) {
        switchTab(tabId);
      } else {
        const id = item.id;
        if (id === 'btnBottomSearch') {
          openSearchModal();
        } else if (id === 'btnBottomHeart') {
          alert('❤️ 알림 피드: 친구들의 응원 메시지 및 수호 칭호 부여 소식을 모아보는 공간입니다.');
        }
      }
    });
  });

  // 모달 제어
  closeModalBtn.addEventListener('click', hideModal);
  loggingModal.addEventListener('click', (e) => {
    if (e.target === loggingModal) hideModal();
  });

  // 유혹 참아냄(성공) 버튼 클릭
  optionSafeBtn.addEventListener('click', () => {
    if (state.viewingUser) return;
    selectModalOption('safe');
  });
  
  // 유해시설 방문함 버튼 클릭
  optionUnsafeBtn.addEventListener('click', () => {
    if (state.viewingUser) return;
    selectModalOption('unsafe');
  });

  // 최종 저장
  submitLogBtn.addEventListener('click', saveLogEntry);

  // 유저 검색 모달 제어 및 검색 리스너
  closeSearchModalBtn.addEventListener('click', hideSearchModal);
  searchUserModal.addEventListener('click', (e) => {
    if (e.target === searchUserModal) hideSearchModal();
  });
  userSearchInput.addEventListener('input', filterUserList);

  // 내 달력으로 복귀 버튼 리스너
  btnBackToMyCalendar.addEventListener('click', exitViewingMode);

  // 아바타 클릭 시 프로필 변경 트리거 (본인 모드일 때만)
  if (avatarWrapper && profileFileInput) {
    avatarWrapper.addEventListener('click', () => {
      if (state.viewingUser) {
        alert('다른 대원의 프로필 사진은 변경할 수 없습니다!');
        return;
      }
      profileFileInput.click();
    });
    profileFileInput.addEventListener('change', handleProfileFileChange);
  }

  // 상단 (+) 및 하단 (+) 버튼 클릭 시 오늘 날짜 바로 기록창 띄우기
  const openTodayLogger = () => {
    const todayStr = getLocalDateString(new Date());
    openLogger(todayStr);
  };
  actionCreateLog.addEventListener('click', openTodayLogger);
  btnBottomAdd.addEventListener('click', openTodayLogger);
}

// 탭 전환 처리
function switchTab(tabId) {
  // 상단 탭 버튼 활성화 상태 표시
  tabButtons.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // 하단 탭 아이콘 변경
  bottomNavItems.forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
      const icon = item.querySelector('i');
      if (icon) {
        icon.classList.remove('fa-regular');
        icon.classList.add('fa-solid');
      }
    } else {
      item.classList.remove('active');
      const icon = item.querySelector('i');
      if (icon) {
        if (icon.classList.contains('fa-user') || icon.classList.contains('fa-heart')) {
          icon.classList.remove('fa-solid');
          icon.classList.add('fa-regular');
        }
      }
    }
  });

  // 화면 전환 애니메이션 적용 및 보이기
  panels.forEach(panel => {
    if (panel.id === tabId) {
      panel.classList.add('active');
    } else {
      panel.classList.remove('active');
    }
  });

  // 피드 탭일 때 스토리를 렌더링
  if (tabId === 'feedTab') {
    renderFeed();
  }
}

// 현지 날짜 문자열 생성 (YYYY-MM-DD)
function getLocalDateString(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// 달력 렌더링 함수
function renderCalendar() {
  calendarGrid.innerHTML = '';
  
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  
  // 영어 월 이름 매핑 및 연도 알약 표시
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  currentMonthText.textContent = monthNames[month];
  
  const yearPill = document.getElementById('calendarYearText');
  if (yearPill) {
    yearPill.textContent = `• ${year} •`;
  }

  // 영어 요일 헤더 생성 (S, M, T, W, T, F, S)
  const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  daysOfWeek.forEach(day => {
    const dayHeader = document.createElement('div');
    dayHeader.className = 'calendar-day-header';
    dayHeader.textContent = day;
    calendarGrid.appendChild(dayHeader);
  });

  // 이전 달, 현재 달 일수 연산
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  // 이전 달 남는 칸 채우기
  for (let i = firstDayIndex; i > 0; i--) {
    const dayNum = prevMonthTotalDays - i + 1;
    const paddingCell = document.createElement('div');
    paddingCell.className = 'calendar-cell other-month';
    paddingCell.innerHTML = `<span class="cell-num">${dayNum}</span>`;
    calendarGrid.appendChild(paddingCell);
  }

  // 이번 달 일수 생성
  const todayStr = getLocalDateString(new Date());
  for (let day = 1; day <= totalDays; day++) {
    const cellDate = new Date(year, month, day);
    const dateStr = getLocalDateString(cellDate);
    const log = state.logs[dateStr];
    
    const cell = document.createElement('div');
    cell.className = 'calendar-cell';
    if (dateStr === todayStr) {
      cell.classList.add('today');
    }

    let statusClass = '';
    if (log) {
      cell.classList.add(log.status);
    }

    cell.innerHTML = `<span class="cell-num">${day}</span>`;

    cell.addEventListener('click', () => openLogger(dateStr));
    calendarGrid.appendChild(cell);
  }
}

function openLogger(dateStr) {
  state.selectedDate = dateStr;
  
  const existingLog = state.logs[dateStr];
  
  if (state.viewingUser) {
    modalDateTitle.textContent = `${dateStr} ${state.viewingUser.name} 대원의 기록`;
    logDiaryText.readOnly = true;
    logDiaryText.placeholder = "기록된 한 줄 메모가 없습니다.";
    submitLogBtn.style.display = 'none';
    readonlyAlert.style.display = 'flex';
    optionSafeBtn.style.cursor = 'default';
    optionUnsafeBtn.style.cursor = 'default';
  } else {
    modalDateTitle.textContent = `${dateStr} 실천 기록`;
    logDiaryText.readOnly = false;
    logDiaryText.placeholder = "오늘 어떤 유혹이 있었나요? 유혹을 어떻게 이겨냈는지 한 줄 적어보세요! (예: 방과 후 유해시설의 유혹을 견디고 도서관에 방문했다)";
    submitLogBtn.style.display = 'block';
    readonlyAlert.style.display = 'none';
    optionSafeBtn.style.cursor = 'pointer';
    optionUnsafeBtn.style.cursor = 'pointer';
  }
  
  if (existingLog) {
    selectModalOption(existingLog.status);
    logDiaryText.value = existingLog.diary || '';
  } else {
    selectModalOption(null);
    logDiaryText.value = '';
  }

  loggingModal.classList.add('active');
}

// 모달 닫기
function hideModal() {
  loggingModal.classList.remove('active');
}

// 모달 옵션(성공 vs 방문) 활성화 비주얼 변경
function selectModalOption(status) {
  currentSelectedStatus = status;
  if (status === 'safe') {
    optionSafeBtn.classList.add('selected');
    optionUnsafeBtn.classList.remove('selected');
  } else if (status === 'unsafe') {
    optionUnsafeBtn.classList.add('selected');
    optionSafeBtn.classList.remove('selected');
  } else {
    optionSafeBtn.classList.remove('selected');
    optionUnsafeBtn.classList.remove('selected');
  }
}

// 기록 저장 로직
function saveLogEntry() {
  if (state.viewingUser) {
    alert('다른 대원의 기록은 수정할 수 없습니다!');
    return;
  }

  if (!currentSelectedStatus) {
    alert('방문 여부를 선택해 주세요! (안전 수호 🌸 또는 방문 ⚠️)');
    return;
  }

  const diary = logDiaryText.value.trim();
  const statusInKorean = currentSelectedStatus === 'safe' ? '안전' : '방문';

  // 1. 구글 시트 API URL이 등록된 경우 실제 연동 저장
  if (GAS_WEB_APP_URL && state.currentUser) {
    submitLogBtn.disabled = true;
    submitLogBtn.textContent = '저장 중...';

    fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'saveLog',
        name: state.currentUser.name,
        date: state.selectedDate,
        school: state.currentUser.school,
        status: statusInKorean,
        memo: diary
      })
    })
    .then(res => res.json())
    .then(result => {
      if (result.success) {
        state.logs[state.selectedDate] = {
          status: currentSelectedStatus,
          diary: diary,
          timestamp: new Date().getTime()
        };
        state.myLogs = JSON.parse(JSON.stringify(state.logs));
        localStorage.setItem('safezone_logs', JSON.stringify(state.logs));
        renderCalendar();
        updateStatsAndBadges();
        hideModal();
      } else {
        alert('구글 시트 저장 실패: ' + result.message);
      }
    })
    .catch(err => {
      console.error(err);
      alert('구글 시트 연동 중 오류가 발생했습니다. 스프레드시트 배포 상태를 확인해주세요.');
    })
    .finally(() => {
      submitLogBtn.disabled = false;
      submitLogBtn.textContent = '기록 저장하기';
    });
  } 
  // 2. 구글 시트 주소가 비어있는 경우 로컬 데이터베이스 저장
  else {
    state.logs[state.selectedDate] = {
      status: currentSelectedStatus,
      diary: diary,
      timestamp: new Date().getTime()
    };
    state.myLogs = JSON.parse(JSON.stringify(state.logs));
    localStorage.setItem('safezone_logs', JSON.stringify(state.logs));
    renderCalendar();
    updateStatsAndBadges();
    hideModal();
  }
}

// 통계 현황 및 뱃지 업데이트
function updateStatsAndBadges() {
  const dates = Object.keys(state.logs);
  let totalResisted = 0;
  let totalLogs = dates.length;

  dates.forEach(d => {
    if (state.logs[d].status === 'safe') totalResisted++;
  });

  // 유혹 극복율 계산
  const resistRate = totalLogs > 0 ? Math.round((totalResisted / totalLogs) * 100) : 0;

  // 스트릭 일수 확인
  const streakInfo = calculateStreaks();

  // 상단 프로필 실시간 갱신
  statDaysResisted.textContent = `${totalResisted}일`;
  statStreak.textContent = `${streakInfo.maxStreak}일`;

  // 상세 탭 데이터 갱신
  statsResistRate.textContent = `${resistRate}%`;
  statsTotalCount.textContent = `${totalResisted}회`;
  statsStreakDays.textContent = `${streakInfo.currentStreak}일`;

  // 일기 텍스트 매칭 및 뱃지 해금 상태 판단
  const hasPC = dates.some(d => state.logs[d].status === 'safe' && (state.logs[d].diary.includes('PC') || state.logs[d].diary.includes('컴퓨터')));
  const hasSing = dates.some(d => state.logs[d].status === 'safe' && (state.logs[d].diary.includes('노래방') || state.logs[d].diary.includes('코노')));
  const hasShop = dates.some(d => state.logs[d].status === 'safe' && (state.logs[d].diary.includes('성인') || state.logs[d].diary.includes('우회')));
  
  updateBadgeStatus('badge-pc', hasPC || totalResisted >= 1);
  updateBadgeStatus('badge-sing', hasSing || totalResisted >= 3);
  updateBadgeStatus('badge-shop', hasShop);
  updateBadgeStatus('badge-streak3', streakInfo.maxStreak >= 3);
  updateBadgeStatus('badge-streak7', streakInfo.maxStreak >= 7);
  updateBadgeStatus('badge-guardian', totalResisted >= 10);
}

// 뱃지 상태 업데이트
function updateBadgeStatus(id, unlocked) {
  const badgeElement = document.getElementById(id);
  if (!badgeElement) return;

  if (unlocked) {
    badgeElement.classList.add('unlocked');
  } else {
    badgeElement.classList.remove('unlocked');
  }
}

// 연속 극복일 계산 (연속 스트릭 산출)
function calculateStreaks() {
  const dates = Object.keys(state.logs)
    .filter(d => state.logs[d].status === 'safe')
    .sort((a, b) => new Date(a) - new Date(b));

  if (dates.length === 0) {
    return { currentStreak: 0, maxStreak: 0 };
  }

  let currentStreak = 0;
  let maxStreak = 0;
  let tempStreak = 0;
  let lastDate = null;

  for (let i = 0; i < dates.length; i++) {
    const currDate = new Date(dates[i]);
    if (lastDate === null) {
      tempStreak = 1;
    } else {
      const diffTime = Math.abs(currDate - lastDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        tempStreak++;
      } else if (diffDays > 1) {
        if (tempStreak > maxStreak) maxStreak = tempStreak;
        tempStreak = 1;
      }
    }
    lastDate = currDate;
  }
  
  if (tempStreak > maxStreak) maxStreak = tempStreak;

  // 오늘 또는 어제 성공 여부로 현재 스트릭 결정
  const todayStr = getLocalDateString(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);

  const hasToday = state.logs[todayStr] && state.logs[todayStr].status === 'safe';
  const hasYesterday = state.logs[yesterdayStr] && state.logs[yesterdayStr].status === 'safe';

  if (hasToday || hasYesterday) {
    let runningStreak = 0;
    let checkDate = new Date();
    if (!hasToday && hasYesterday) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    while (true) {
      const checkStr = getLocalDateString(checkDate);
      if (state.logs[checkStr] && state.logs[checkStr].status === 'safe') {
        runningStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    currentStreak = runningStreak;
  } else {
    currentStreak = 0;
  }

  return { currentStreak, maxStreak };
}

// 인스타그램 피드 탭 렌더링
function renderFeed() {
  feedPosts.innerHTML = '';
  const dates = Object.keys(state.logs)
    .sort((a, b) => new Date(b) - new Date(a));

  if (dates.length === 0) {
    feedPosts.innerHTML = `
      <div style="text-align: center; color: var(--text-secondary); padding: 50px 0;">
        <i class="fa-regular fa-paper-plane" style="font-size: 2.5rem; margin-bottom: 12px; display: block; opacity: 0.4; color: var(--accent-pink);"></i>
        아직 기록된 극복 일기가 없어요.<br>
        달력의 빈 날짜를 눌러 첫 수호 이야기를 남겨주세요!
      </div>
    `;
    return;
  }

  dates.forEach(dateStr => {
    const log = state.logs[dateStr];
    const item = document.createElement('div');
    item.className = 'feed-item';

    const isSafe = log.status === 'safe';
    const statusText = isSafe ? '안전 수호 🌸' : '유해업소 방문 ⚠️';
    const badgeClass = isSafe ? 'safe' : 'unsafe';
    const diaryContent = log.diary ? log.diary : (isSafe ? '오늘 하루도 근처 유해시설에 가지 않고 안전한 하루를 지켜냈습니다!' : '유해시설 주변을 거쳐갔거나 방문했습니다. 내일은 우회하여 가도록 하겠습니다.');

    const displayName = state.viewingUser 
      ? `${state.viewingUser.name} 대원` 
      : (state.currentUser ? `${state.currentUser.name} 대원` : '양진고 안전대원');

    item.innerHTML = `
      <div class="feed-header">
        <div class="feed-avatar">🌸</div>
        <div class="feed-user-info">
          <span class="feed-username">${escapeHtml(displayName)}</span>
          <span class="feed-date">${dateStr}</span>
        </div>
        <span class="feed-badge ${badgeClass}">${statusText}</span>
      </div>
      <div class="feed-body">
        <p class="feed-text">${escapeHtml(diaryContent)}</p>
      </div>
      <div class="feed-footer">
        <span><i class="fa-regular fa-heart"></i> 응원하기</span>
        <span><i class="fa-regular fa-comment"></i> 소감 나누기</span>
      </div>
    `;

    feedPosts.appendChild(item);
  });
}

// XSS 보안용 문자 치환 함수
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- 로그인/회원가입 비즈니스 로직 ---

// 로그인 상태 체크
function checkLoginStatus() {
  if (state.currentUser) {
    authScreen.style.display = 'none';
    btnLogout.style.display = 'inline-block';
    updateProfileUI();
    state.myLogs = JSON.parse(JSON.stringify(state.logs));
    // 구글 시트로부터 기존 기록 자동 동기화
    fetchUserLogs();
  } else {
    authScreen.style.display = 'flex';
    btnLogout.style.display = 'none';
  }
}

// 구글 시트로부터 사용자의 최신 로그 데이터 가져오기
function fetchUserLogs() {
  if (!GAS_WEB_APP_URL || !state.currentUser) return;
  
  fetch(GAS_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'getLogs', name: state.currentUser.name })
  })
  .then(res => res.json())
  .then(result => {
    if (result.success && result.logs) {
      state.logs = result.logs;
      if (!state.viewingUser) {
        state.myLogs = JSON.parse(JSON.stringify(state.logs));
      }
      localStorage.setItem('safezone_logs', JSON.stringify(state.logs));
      renderCalendar();
      updateStatsAndBadges();
    }
  })
  .catch(err => {
    console.error('기록 자동 동기화 오류:', err);
  });
}

// 로그인 성공 시 프로필 정보 업데이트
function updateProfileUI() {
  const profileNameEl = document.querySelector('.profile-name');
  const profileBioTextEl = document.querySelector('.profile-bio-text');

  if (state.viewingUser) {
    if (profileNameEl) {
      profileNameEl.textContent = `${state.viewingUser.name} 대원 (구경 중)`;
    }
    if (profileBioTextEl) {
      profileBioTextEl.innerHTML = `
        ${state.viewingUser.school} 안전 수호 대원 🌸<br>
        다른 대원의 안전 수호 달력과 극복 현황을 구경하고 있습니다.
      `;
    }
    renderAvatar(state.viewingUser.profile);
  } else if (state.currentUser) {
    if (profileNameEl) {
      profileNameEl.textContent = `${state.currentUser.name} 학생`;
    }
    if (profileBioTextEl) {
      profileBioTextEl.innerHTML = `
        ${state.currentUser.school} 안전 수호 대원 🌸<br>
        스스로 실천한 소소한 일상을 기록하고 가디언즈 뱃지를 모아보세요!
      `;
    }
    renderAvatar(state.currentUser.profile);
  }
}

// 로그인 처리 함수
async function handleLogin() {
  const name = loginNameInput.value.trim();
  const password = loginPasswordInput.value.trim();

  if (!name || !password) {
    alert('이름과 비밀번호를 모두 입력해 주세요!');
    return;
  }

  // 1. 구글 시트 API URL이 등록된 경우 실제 연동
  if (GAS_WEB_APP_URL) {
    btnLoginSubmit.disabled = true;
    btnLoginSubmit.textContent = '로그인 중...';

    try {
      const response = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // CORS preflight 회피용
        body: JSON.stringify({ action: 'login', name: name, password: password })
      });
      const result = await response.json();

      if (result.success) {
        state.currentUser = { name: name, school: result.school, profile: result.profile };
        localStorage.setItem('safezone_logged_in_user', JSON.stringify(state.currentUser));
        
        // 구글 시트에서 반환된 해당 유저의 기존 로그 동기화
        if (result.logs) {
          state.logs = result.logs;
          localStorage.setItem('safezone_logs', JSON.stringify(state.logs));
        }
        state.myLogs = JSON.parse(JSON.stringify(state.logs));

        checkLoginStatus();
        renderCalendar();
        updateStatsAndBadges();
        alert(`${name}님, 환영합니다!`);
      } else {
        alert(result.message || '등록된 사용자가 존재하지 않거나 비밀번호가 다릅니다.');
      }
    } catch (error) {
      console.error(error);
      alert('네트워크 오류가 발생했습니다. 구글 앱스 스크립트 웹 앱 구성을 확인해주세요.');
    } finally {
      btnLoginSubmit.disabled = false;
      btnLoginSubmit.textContent = '로그인';
    }
  } 
  // 2. 구글 시트 주소가 비어있는 경우 로컬 Mock 데이터베이스를 이용한 로그인 시뮬레이션
  else {
    const mockUsers = JSON.parse(localStorage.getItem('safezone_mock_users')) || [];
    const matchedUser = mockUsers.find(u => u.name === name);

    if (matchedUser) {
      if (matchedUser.password === password) {
        state.currentUser = { name: name, school: matchedUser.school, profile: matchedUser.profile };
        localStorage.setItem('safezone_logged_in_user', JSON.stringify(state.currentUser));
        checkLoginStatus();
        alert(`[테스트 모드] ${name}님, 로그인되었습니다!`);
      } else {
        alert('비밀번호가 일치하지 않습니다.');
      }
    } else {
      alert('사용자가 존재하지 않습니다. 회원가입을 먼저 진행해 주세요.');
    }
  }
}

// 회원가입 처리 함수
async function handleSignup() {
  const name = signupNameInput.value.trim();
  const school = signupSchoolSelect.value;
  const password = signupPasswordInput.value.trim();

  if (!name || !school || !password) {
    alert('모든 입력 칸을 채우고 학교를 선택해 주세요!');
    return;
  }

  // 1. 구글 시트 API URL이 등록된 경우 실제 연동
  if (GAS_WEB_APP_URL) {
    btnSignupSubmit.disabled = true;
    btnSignupSubmit.textContent = '등록 중...';

    try {
      const response = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'signup', name: name, school: school, password: password })
      });
      const result = await response.json();

      if (result.success) {
        alert('회원가입이 완료되었습니다! 로그인해 주세요.');
        signupFormContainer.style.display = 'none';
        loginFormContainer.style.display = 'flex';
        // 가입 폼 초기화
        signupNameInput.value = '';
        signupSchoolSelect.value = '';
        signupPasswordInput.value = '';
      } else {
        alert(result.message || '회원가입에 실패했습니다.');
      }
    } catch (error) {
      console.error(error);
      alert('네트워크 오류가 발생했습니다. 구글 앱스 스크립트 웹 앱 구성을 확인해주세요.');
    } finally {
      btnSignupSubmit.disabled = false;
      btnSignupSubmit.textContent = '회원가입 완료';
    }
  } 
  // 2. 구글 시트 주소가 비어있는 경우 로컬 Mock 데이터베이스 시뮬레이션
  else {
    const mockUsers = JSON.parse(localStorage.getItem('safezone_mock_users')) || [];
    
    if (mockUsers.some(u => u.name === name)) {
      alert('이미 존재하는 이름입니다. 다른 이름을 사용하세요.');
      return;
    }

    mockUsers.push({ name: name, school: school, password: password });
    localStorage.setItem('safezone_mock_users', JSON.stringify(mockUsers));
    
    alert('[테스트 모드] 회원가입이 성공했습니다! 로그인해 주세요.');
    signupFormContainer.style.display = 'none';
    loginFormContainer.style.display = 'flex';
    signupNameInput.value = '';
    signupSchoolSelect.value = '';
    signupPasswordInput.value = '';
  }
}

// 로그아웃 처리 함수
function handleLogout() {
  if (confirm('로그아웃 하시겠습니까?')) {
    // 구경 모드라면 복구 처리
    if (state.viewingUser) {
      exitViewingMode();
    }
    state.currentUser = null;
    localStorage.removeItem('safezone_logged_in_user');
    checkLoginStatus();
    
    // 입력 칸 초기화
    loginNameInput.value = '';
    loginPasswordInput.value = '';
  }
}

// --- 유저 검색 & 구경 모드 헬퍼 함수들 ---

// 검색 모달 열기
let cachedUsers = [];
function openSearchModal() {
  if (!state.currentUser) {
    alert('로그인 후 이용할 수 있는 기능입니다!');
    return;
  }
  
  userSearchInput.value = '';
  userList.innerHTML = '';
  userListLoading.style.display = 'flex';
  searchUserModal.classList.add('active');
  
  fetchUsers();
}

// 검색 모달 닫기
function hideSearchModal() {
  searchUserModal.classList.remove('active');
}

// 구글 시트/로컬 Mock 에서 가입 대원 목록 조회
function fetchUsers() {
  if (GAS_WEB_APP_URL) {
    fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'getUsers' })
    })
    .then(res => res.json())
    .then(result => {
      if (result.success && result.users) {
        cachedUsers = result.users.filter(u => u.name !== state.currentUser.name);
        renderUserList(cachedUsers);
      } else {
        loadMockUsersForSearch();
      }
    })
    .catch(err => {
      console.error('구글 시트 유저 로드 실패:', err);
      loadMockUsersForSearch();
    });
  } else {
    loadMockUsersForSearch();
  }
}

// Mock 유저 로드 (로컬 테스트용)
function loadMockUsersForSearch() {
  const mockUsers = JSON.parse(localStorage.getItem('safezone_mock_users')) || [];
  cachedUsers = mockUsers
    .filter(u => u.name !== state.currentUser.name)
    .map(u => ({ name: u.name, school: u.school, profile: u.profile }));
  renderUserList(cachedUsers);
}

// 유저 목록 카드형 렌더링
function renderUserList(usersToRender) {
  userListLoading.style.display = 'none';
  userList.innerHTML = '';
  
  if (usersToRender.length === 0) {
    userList.innerHTML = `
      <div style="text-align: center; color: var(--text-secondary); padding: 30px 0; font-size: 0.85rem;">
        <i class="fa-regular fa-face-smile" style="font-size: 1.8rem; margin-bottom: 8px; display: block; opacity: 0.4;"></i>
        검색 조건에 맞는 대원이 없습니다.
      </div>
    `;
    return;
  }
  
  usersToRender.forEach(user => {
    const item = document.createElement('div');
    item.className = 'user-item';
    
    const avatarStyle = user.profile ? `style="background-image: url(${user.profile}); background-size: cover; background-position: center; font-size: 0;"` : '';
    const avatarChar = user.profile ? '' : '🌸';

    item.innerHTML = `
      <div class="user-avatar" ${avatarStyle}>${avatarChar}</div>
      <div class="user-info">
        <span class="user-name">${escapeHtml(user.name)}</span>
        <span class="user-school">${escapeHtml(user.school)}</span>
      </div>
      <i class="fa-solid fa-chevron-right user-action-arrow"></i>
    `;
    
    item.addEventListener('click', () => {
      selectUserToView(user);
    });
    userList.appendChild(item);
  });
}

// 실시간 검색어 필터링
function filterUserList() {
  const query = userSearchInput.value.trim().toLowerCase();
  if (!query) {
    renderUserList(cachedUsers);
    return;
  }
  
  const filtered = cachedUsers.filter(user => 
    user.name.toLowerCase().includes(query) || 
    user.school.toLowerCase().includes(query)
  );
  renderUserList(filtered);
}

// 구경할 유저 선택 완료
function selectUserToView(user) {
  hideSearchModal();
  
  // 내 원래 로그 백업
  if (!state.myLogs) {
    state.myLogs = JSON.parse(JSON.stringify(state.logs));
  }
  
  state.viewingUser = { name: user.name, school: user.school, profile: user.profile };
  viewingUserName.textContent = user.name;
  viewingModeHeader.style.display = 'flex';
  
  // 달력 로딩 비주얼
  calendarGrid.innerHTML = `
    <div style="grid-column: span 7; text-align: center; padding: 60px 0; color: var(--accent-pink);">
      <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2rem; margin-bottom: 12px;"></i>
      <p style="font-size: 0.85rem;">${user.name} 대원의 기록을 불러오는 중...</p>
    </div>
  `;
  
  if (GAS_WEB_APP_URL) {
    fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'getLogs', name: user.name })
    })
    .then(res => res.json())
    .then(result => {
      if (result.success && result.logs) {
        state.logs = result.logs;
      } else {
        state.logs = {};
      }
      renderViewingCalendarAndStats();
    })
    .catch(err => {
      console.error('타 대원 로그 조회 실패:', err);
      loadMockUserLogs(user.name);
    });
  } else {
    loadMockUserLogs(user.name);
  }
}

// 타 대원 로컬 가상 로그 조회
function loadMockUserLogs(userName) {
  const mockLogs = JSON.parse(localStorage.getItem('safezone_mock_logs_' + userName));
  state.logs = mockLogs || {};
  renderViewingCalendarAndStats();
}

// 구경 모드 리프레시
function renderViewingCalendarAndStats() {
  renderCalendar();
  updateStatsAndBadges();
  updateProfileUI();
  
  // 만약 피드 탭 활성화되어 있다면 피드도 갱신
  const activeTab = document.querySelector('.tab-btn.active');
  if (activeTab && activeTab.getAttribute('data-tab') === 'feedTab') {
    renderFeed();
  }
}

// 구경 모드 종료 및 복귀
function exitViewingMode() {
  state.viewingUser = null;
  viewingModeHeader.style.display = 'none';
  
  if (state.myLogs) {
    state.logs = JSON.parse(JSON.stringify(state.myLogs));
    state.myLogs = null;
  } else {
    state.logs = JSON.parse(localStorage.getItem('safezone_logs')) || {};
  }
  
  renderCalendar();
  updateStatsAndBadges();
  updateProfileUI();
  
  const activeTab = document.querySelector('.tab-btn.active');
  if (activeTab && activeTab.getAttribute('data-tab') === 'feedTab') {
    renderFeed();
  }
}

// --- 프로필 사진 처리 헬퍼 함수들 ---

function handleProfileFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('이미지 파일만 업로드할 수 있습니다!');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      // Canvas를 사용하여 120x120px 크기로 압축 리사이징
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const maxSize = 120;
      let width = img.width;
      let height = img.height;
      
      if (width > height) {
        if (width > maxSize) {
          height *= maxSize / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width *= maxSize / height;
          height = maxSize;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      // JPEG 포맷, 0.75 품질로 압축하여 Base64 생성 (용량 최소화)
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
      
      uploadProfilePhoto(compressedBase64);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

// 압축된 프로필 사진 구글 시트에 업데이트
function uploadProfilePhoto(base64Data) {
  if (!state.currentUser) return;
  
  // UI 선반영 (낙관적 렌더링)
  renderAvatar(base64Data);
  
  if (GAS_WEB_APP_URL) {
    fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'updateProfile',
        name: state.currentUser.name,
        profile: base64Data
      })
    })
    .then(res => res.json())
    .then(result => {
      if (result.success) {
        state.currentUser.profile = base64Data;
        localStorage.setItem('safezone_logged_in_user', JSON.stringify(state.currentUser));
        // 캐싱된 다른 대원 목록 갱신
        fetchUsers();
      } else {
        alert('프로필 사진 저장 실패: ' + result.message);
        restoreMyAvatar();
      }
    })
    .catch(err => {
      console.error('프로필 업로드 에러:', err);
      updateMockProfile(base64Data);
    });
  } else {
    updateMockProfile(base64Data);
  }
}

// Mock 모드 전용 프로필 업데이트
function updateMockProfile(base64Data) {
  state.currentUser.profile = base64Data;
  localStorage.setItem('safezone_logged_in_user', JSON.stringify(state.currentUser));
  
  const mockUsers = JSON.parse(localStorage.getItem('safezone_mock_users')) || [];
  const uIndex = mockUsers.findIndex(u => u.name === state.currentUser.name);
  if (uIndex !== -1) {
    mockUsers[uIndex].profile = base64Data;
    localStorage.setItem('safezone_mock_users', JSON.stringify(mockUsers));
  }
  
  loadMockUsersForSearch();
  console.log('[테스트 모드] 프로필이 로컬에 저장되었습니다.');
}

// 아바타 이미지 DOM 렌더링 헬퍼
function renderAvatar(profileData) {
  if (profileData && profileData.trim() !== '') {
    avatarImg.style.backgroundImage = `url(${profileData})`;
    avatarImg.textContent = '';
  } else {
    avatarImg.style.backgroundImage = 'none';
    avatarImg.textContent = '🌸';
  }
}

// 내 원래 아바타 복구
function restoreMyAvatar() {
  if (state.currentUser && state.currentUser.profile) {
    renderAvatar(state.currentUser.profile);
  } else {
    renderAvatar(null);
  }
}
