@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"
set "LOG=%~dp0amivoice_test.log"

echo ============================================== > "%LOG%"
echo  AmiVoice 接続テスト >> "%LOG%"
echo  %date% %time% >> "%LOG%"
echo ============================================== >> "%LOG%"
echo. >> "%LOG%"

echo AmiVoice 接続テストを開始します...
echo （ログは amivoice_test.log に記録されます）
echo.

REM --- Python 検出 ---
set "PY=python"
py --version >nul 2>&1
if %errorlevel%==0 set "PY=py"
%PY% --version >nul 2>&1
if not %errorlevel%==0 (
  echo [ERROR] Python が見つかりません。 >> "%LOG%"
  echo Python をインストールしてください: https://www.python.org/downloads/ >> "%LOG%"
  goto :end
)
echo [OK] Python: %PY% >> "%LOG%"
%PY% --version >> "%LOG%" 2>&1
echo. >> "%LOG%"

REM --- .env 存在チェック ---
if not exist "%~dp0.env" (
  echo [ERROR] .env ファイルがありません。 >> "%LOG%"
  echo. >> "%LOG%"
  echo 対処: >> "%LOG%"
  echo   1. .env.example をコピーして「.env」という名前のファイルを作る >> "%LOG%"
  echo   2. .env をメモ帳で開く >> "%LOG%"
  echo   3. AMIVOICE_APPKEY= の右に AmiVoice MyPage の APPKEY を貼る >> "%LOG%"
  echo   4. AMIVOICE_ENGINE= の右に MyPage の接続エンジン名を貼る >> "%LOG%"
  echo   5. 保存して、このバッチをもう一度ダブルクリック >> "%LOG%"
  goto :end
)
echo [OK] .env が存在します >> "%LOG%"
echo. >> "%LOG%"

REM --- 依存インストール ---
echo --- [1/3] pip install --- >> "%LOG%"
echo [1/3] 必要なライブラリをインストール中...
%PY% -m pip install -r harness\transcribe\requirements.txt >> "%LOG%" 2>&1
echo. >> "%LOG%"

REM --- テスト wav 生成 ---
echo --- [2/3] テスト wav 生成 --- >> "%LOG%"
echo [2/3] テスト音声を生成中...
%PY% harness\transcribe\make_test_wav.py --out harness\transcribe\samples\test_5s_440hz.wav --seconds 5 >> "%LOG%" 2>&1
echo. >> "%LOG%"

REM --- 接続テスト ---
echo --- [3/3] AmiVoice 接続テスト --- >> "%LOG%"
echo [3/3] AmiVoice に接続して文字起こしテスト中...
%PY% harness\transcribe\replay_offline.py --wav harness\transcribe\samples\test_5s_440hz.wav --client_id sample-omiyage --meeting_id wstest >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo ============================================== >> "%LOG%"
echo  テスト終了 >> "%LOG%"
echo ============================================== >> "%LOG%"

:end
echo.
echo 完了しました。
echo ログをメモ帳で開きます。表示された内容を全部コピーして、チャットに貼ってください。
echo （APPKEY は自動でマスクされるので、そのまま貼って大丈夫です）
echo.
pause
notepad "%LOG%"
endlocal
