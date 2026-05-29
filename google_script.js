/**
 * 구글 스프레드시트용 앱스 스크립트 (Google Apps Script)
 * 
 * [사용 방법]
 * 1. 연동하고자 하는 구글 스프레드시트("유해시설 기록 시트")를 엽니다.
 * 2. 상단 메뉴에서 [확장 프로그램] -> [Apps Script]를 클릭합니다.
 * 3. 기존에 써있던 코드를 전부 지우고 본 파일의 코드를 복사해서 붙여넣습니다.
 * 4. 상단 세이브 아이콘(저장)을 누른 후, 우측 상단의 [배포] -> [새 배포]를 클릭합니다.
 * 5. 유형 선택(톱니바퀴)에서 [웹 앱]을 선택합니다.
 * 6. 설정을 다음과 같이 구성합니다:
 *    - 설명: MINDIST 로그인/기록 연동
 *    - 다음 사용자 권한으로 실행: 웹 앱을 실행하는 사용자 (나 또는 스프레드시트 소유자) -> 보통 "나(본인 이메일)"로 설정해야 데이터 수정 권한이 생깁니다.
 *    - 액세스 권한이 있는 사용자: "모든 사람(Anyone)" -> 웹 앱이 외부 fetch 요청을 처리할 수 있도록 필수 선택.
 * 7. [배포] 버튼을 누르고 액세스 승인이 나오면 권한 승인을 완료합니다.
 * 8. 생성된 "웹 앱 URL"을 복사하여 우리 웹의 `app.js` 상단에 있는 `GAS_WEB_APP_URL` 변수에 입력합니다.
 */

function doPost(e) {
  var output = ContentService.createTextOutput();

  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action; // "signup", "login", "saveLog", "getLogs"

    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getSheetByName("사용유저");

    // 만약 "사용유저" 시트가 없으면 생성하고 헤더를 넣습니다.
    if (!sheet) {
      sheet = doc.insertSheet("사용유저");
      sheet.appendRow(["이름", "학교", "비밀번호"]);
    }

    var data = sheet.getDataRange().getValues();

    if (action === "signup") {
      var name = params.name;
      var school = params.school;
      var password = params.password;

      // 이미 같은 이름으로 가입된 사용자가 있는지 중복 확인
      for (var i = 1; i < data.length; i++) {
        if (safeString(data[i][0]) === name.trim()) {
          return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: "이미 등록된 사용자 이름입니다."
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      // 구글 시트에 가입자 추가 (프로필 빈칸 추가)
      sheet.appendRow([name, school, password, ""]);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "회원가입이 완료되었습니다."
      })).setMimeType(ContentService.MimeType.JSON);

    } else if (action === "login") {
      var name = params.name;
      var password = params.password;
      var foundUser = false;
      var userSchool = "";
      var userProfileData = "";

      // 이름과 비밀번호 일치 확인
      for (var i = 1; i < data.length; i++) {
        var rowName = safeString(data[i][0]);
        var rowSchool = safeString(data[i][1]);
        var rowPassword = safeString(data[i][2]);
        var rowProfile = safeString(data[i][3]); // D열 프로필 데이터

        if (rowName === name.trim()) {
          if (rowPassword === password.toString().trim()) {
            foundUser = true;
            userSchool = rowSchool;
            userProfileData = rowProfile;
            break;
          } else {
            return ContentService.createTextOutput(JSON.stringify({
              success: false,
              message: "비밀번호가 잘못되었습니다."
            })).setMimeType(ContentService.MimeType.JSON);
          }
        }
      }

      if (foundUser) {
        // 로그인 성공 시 해당 사용자의 기존 수호 일기 기록도 불러와서 반환합니다.
        var userLogs = {};
        var logSheet = doc.getSheetByName("기록") || doc.getSheetByName("시트1");
        if (logSheet) {
          // getDisplayValues를 사용하면 날짜와 텍스트를 화면에 표시된 문자열 그대로 읽어와 시차 에러를 방지합니다.
          var logData = logSheet.getDataRange().getDisplayValues();
          for (var j = 1; j < logData.length; j++) {
            var logName = safeString(logData[j][0]);
            var logDate = normalizeDate(logData[j][1]); // 날짜 문자열 YYYY-MM-DD 포맷 표준화
            var logSchool = safeString(logData[j][2]);
            var logStatus = safeString(logData[j][3]); // "안전" 또는 "방문"
            var logMemo = safeString(logData[j][4]);

            if (logName === name.trim() && logDate) {
              userLogs[logDate] = {
                status: (logStatus === "안전") ? "safe" : "unsafe",
                diary: logMemo,
                timestamp: new Date(logDate.replace(/-/g, '/')).getTime()
              };
            }
          }
        }

        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          school: userSchool,
          profile: userProfileData,
          logs: userLogs,
          message: "로그인 성공!"
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: "등록된 사용자가 존재하지 않습니다."
        })).setMimeType(ContentService.MimeType.JSON);
      }

    } else if (action === "saveLog") {
      var name = params.name;
      var date = params.date; // "YYYY-MM-DD"
      var school = params.school;
      var status = params.status; // "안전" 또는 "방문"
      var memo = params.memo;

      var logSheet = doc.getSheetByName("기록") || doc.getSheetByName("시트1");
      if (!logSheet) {
        logSheet = doc.insertSheet("기록");
        logSheet.appendRow(["이름", "날짜", "학교", "기록상태", "한줄메모"]);
      }

      var logData = logSheet.getDataRange().getDisplayValues();
      var isUpdated = false;

      // 동일 사용자 및 날짜 중복 검사
      for (var k = 1; k < logData.length; k++) {
        var rowName = safeString(logData[k][0]);
        var rowDate = normalizeDate(logData[k][1]);

        if (rowName === name.trim() && rowDate === date.trim()) {
          var rowNum = k + 1; // 1-indexed 스프레드시트 행 번호
          logSheet.getRange(rowNum, 3).setValue(school); // 학교 업데이트
          logSheet.getRange(rowNum, 4).setValue(status); // 기록상태 업데이트
          logSheet.getRange(rowNum, 5).setValue(memo);   // 한줄메모 업데이트
          isUpdated = true;
          break;
        }
      }

      // 중복이 없으면 새로운 행으로 등록
      if (!isUpdated) {
        logSheet.appendRow([name, date, school, status, memo]);
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "기록이 저장되었습니다."
      })).setMimeType(ContentService.MimeType.JSON);

    } else if (action === "getLogs") {
      var name = params.name;
      var userLogs = {};

      var logSheet = doc.getSheetByName("기록") || doc.getSheetByName("시트1");
      if (logSheet) {
        var logData = logSheet.getDataRange().getDisplayValues();
        for (var j = 1; j < logData.length; j++) {
          var logName = safeString(logData[j][0]);
          var logDate = normalizeDate(logData[j][1]);
          var logStatus = safeString(logData[j][3]); // "안전" 또는 "방문"
          var logMemo = safeString(logData[j][4]);

          if (logName === name.trim() && logDate) {
            userLogs[logDate] = {
              status: (logStatus === "안전") ? "safe" : "unsafe",
              diary: logMemo,
              timestamp: new Date(logDate.replace(/-/g, '/')).getTime()
            };
          }
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        logs: userLogs,
        message: "기록 조회 성공!"
      })).setMimeType(ContentService.MimeType.JSON);

    } else if (action === "getUsers") {
      var userList = [];
      var userSheet = doc.getSheetByName("사용유저");
      if (userSheet) {
        var userData = userSheet.getDataRange().getValues();
        for (var i = 1; i < userData.length; i++) {
          var userName = safeString(userData[i][0]);
          var userSchool = safeString(userData[i][1]);
          var userProfile = safeString(userData[i][3]); // D열 프로필 데이터
          if (userName) {
            userList.push({
              name: userName,
              school: userSchool,
              profile: userProfile
            });
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        users: userList,
        message: "유저 목록 조회 성공!"
      })).setMimeType(ContentService.MimeType.JSON);

    } else if (action === "updateProfile") {
      var name = params.name;
      var profileData = params.profile; // Base64 이미지 데이터
      
      var userSheet = doc.getSheetByName("사용유저");
      if (userSheet) {
        var userData = userSheet.getDataRange().getValues();
        for (var i = 1; i < userData.length; i++) {
          if (safeString(userData[i][0]) === name.trim()) {
            var rowNum = i + 1;
            userSheet.getRange(rowNum, 4).setValue(profileData); // D열 업데이트
            return ContentService.createTextOutput(JSON.stringify({
              success: true,
              message: "프로필 이미지가 저장되었습니다."
            })).setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "사용자를 찾을 수 없습니다."
      })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "서버 오류: " + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// CORS 통신 시 발생할 수 있는 OPTIONS 요청에 대응
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}

// null 이나 undefined 값을 안전하게 빈 문자열로 정렬하는 헬퍼 함수
function safeString(val) {
  if (val === null || val === undefined) {
    return "";
  }
  return val.toString().trim();
}

// 셀에 입력된 날짜 텍스트를 "YYYY-MM-DD" 포맷 문자열로 표준화하는 함수
function normalizeDate(str) {
  var s = safeString(str);
  if (!s) return "";

  // 숫자 2~4자리, 1~2자리, 1~2자리 추출 (예: 2026-05-15, 2026/5/15, 2026. 5. 15. 등 대응)
  var matches = s.match(/(\d{4}|\d{2})[-./\s]+(\d{1,2})[-./\s]+(\d{1,2})/);
  if (matches) {
    var y = matches[1];
    if (y.length === 2) y = "20" + y; // 2자리 연도는 2000년대로 가정
    var m = matches[2].length === 1 ? "0" + matches[2] : matches[2];
    var d = matches[3].length === 1 ? "0" + matches[3] : matches[3];
    return y + "-" + m + "-" + d;
  }

  // 만약 단순 "YYYY-MM-DD" 형태인데 구분자가 다른 경우
  if (s.indexOf("T") !== -1) {
    s = s.split("T")[0];
  }
  return s;
}
