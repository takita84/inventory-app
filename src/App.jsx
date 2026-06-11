import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

const READER_ID = "reader";

// 検証用ダミー台帳
const assetTable = {
  "ASSET-001": {
    name: "鉛筆（検証）",
    category: "固定資産",
    location: "棚A-1"
  },
  "ASSET-002": {
    name: "消しゴム（検証）",
    category: "予備品",
    location: "棚A-2"
  },
  "ASSET-003": {
    name: "筆箱（検証）",
    category: "貯蔵品",
    location: "棚B-1"
  }
};

export default function App() {
  const [mode, setMode] = useState("inventory"); // inventory | search
  const [targetCode, setTargetCode] = useState("ASSET-002");
  const [status, setStatus] = useState("待機中");
  const [result, setResult] = useState("未読取");
  const [isScanning, setIsScanning] = useState(false);
  const [found, setFound] = useState(false);
  const [history, setHistory] = useState([]);

  const scannerRef = useRef(null);
  const cooldownRef = useRef(false);

  // 音通知（外部音声ファイル不要）
  const playBeep = (type = "success") => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (type === "success") {
        oscillator.frequency.value = 1046.5; // 高めの音
      } else if (type === "duplicate") {
        oscillator.frequency.value = 523.25;
      } else {
        oscillator.frequency.value = 220;
      }

      oscillator.type = "sine";
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);

      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.25);
    } catch (e) {
      console.log("音再生不可:", e);
    }
  };

  const stopScan = async () => {
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
    } catch (e) {
      console.log("停止時エラー:", e);
    } finally {
      setIsScanning(false);
    }
  };

  const resetView = () => {
    setStatus("待機中");
    setResult("未読取");
    setFound(false);
  };

  const handleInventoryScan = (decodedText) => {
    const item = assetTable[decodedText];

    // 重複防止
    const alreadyScanned = history.some((h) => h.code === decodedText);
    if (alreadyScanned) {
      setStatus("重複読取");
      setResult(`⚠️ 既に棚卸済: ${decodedText}`);
      setFound(false);
      playBeep("duplicate");
      return;
    }

    const now = new Date().toLocaleString("ja-JP");

    if (item) {
      const text = `✅ 棚卸対象: ${item.name} / ${item.category} / ${item.location}`;
      setStatus("登録済みQRを検知");
      setResult(text);
      setFound(true);
      playBeep("success");

      setHistory((prev) => [
        {
          code: decodedText,
          label: item.name,
          category: item.category,
          location: item.location,
          status: "登録済",
          scannedAt: now
        },
        ...prev
      ]);
    } else {
      const text = `⚠️ 未登録: ${decodedText}`;
      setStatus("未登録QRを検知");
      setResult(text);
      setFound(false);
      playBeep("error");

      setHistory((prev) => [
        {
          code: decodedText,
          label: "未登録",
          category: "-",
          location: "-",
          status: "未登録",
          scannedAt: now
        },
        ...prev
      ]);
    }
  };

  const handleSearchScan = async (decodedText) => {
    // 探索モードはターゲット以外には反応しない
    if (decodedText !== targetCode) {
      return;
    }

    const item = assetTable[decodedText];

    if (item) {
      setStatus("探索対象を発見");
      setResult(`🎯 発見: ${item.name} / ${item.category} / ${item.location}`);
      setFound(true);
      playBeep("success");

      // 見つけたら停止
      await stopScan();
    } else {
      // targetCode 自体が台帳未登録なら一応エラー表示
      setStatus("探索対象が台帳未登録");
      setResult(`⚠️ ターゲット未登録: ${decodedText}`);
      setFound(false);
      playBeep("error");
      await stopScan();
    }
  };

  const onScanSuccess = async (decodedText) => {
    // 同じフレーム連打対策
    if (cooldownRef.current) return;
    cooldownRef.current = true;
    setTimeout(() => {
      cooldownRef.current = false;
    }, 1200);

    if (mode === "inventory") {
      handleInventoryScan(decodedText);
    } else {
      await handleSearchScan(decodedText);
    }
  };

  const startScan = async () => {
    resetView();

    try {
      // 既存インスタンスをクリア
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          await scannerRef.current.clear();
        } catch (e) {
          console.log("既存scanner後処理:", e);
        }
      }

      scannerRef.current = new Html5Qrcode(READER_ID);

      setStatus("カメラ起動中...");
      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        onScanSuccess,
        () => {
          // 読取失敗は無視
        }
      );

      setIsScanning(true);

      if (mode === "inventory") {
        setStatus("棚卸モードでスキャン中");
      } else {
        setStatus(`探索モードでスキャン中（対象: ${targetCode}）`);
      }
    } catch (e) {
      console.log(e);
      setStatus("カメラ起動失敗");
      setResult("⚠️ カメラを起動できませんでした");
      setFound(false);
      setIsScanning(false);
      alert("カメラ起動失敗");
    }
  };

  useEffect(() => {
    return () => {
      stopScan();
    };
  }, []);

  const panelStyle = {
    padding: "20px",
    fontFamily: "sans-serif",
    maxWidth: "720px",
    margin: "0 auto",
    backgroundColor: found ? "#e8ffe8" : "#ffffff",
    minHeight: "100vh"
  };

  const badgeStyle = {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: "999px",
    background: mode === "inventory" ? "#0ea5e9" : "#16a34a",
    color: "#fff",
    fontSize: "14px",
    marginBottom: "12px"
  };

  const buttonStyle = {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "none",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    marginRight: "8px",
    fontSize: "14px"
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    background: "#64748b"
  };

  const modeButton = (currentMode, label) => ({
    ...buttonStyle,
    background: mode === currentMode ? "#111827" : "#cbd5e1",
    color: mode === currentMode ? "#fff" : "#111827"
  });

  return (
    <div style={panelStyle}>
      <h1 style={{ marginBottom: "8px" }}>棚卸アプリ（棚卸モード + 探索モード）</h1>
      <p style={{ marginTop: 0, color: "#475569" }}>
        棚卸モードでは登録済み/未登録を判定、探索モードでは指定したQRだけに反応します。
      </p>

      <div style={badgeStyle}>
        {mode === "inventory" ? "棚卸モード" : "探索モード"}
      </div>

      {/* モード切替 */}
      <div style={{ marginBottom: "16px" }}>
        <button
          style={modeButton("inventory", "棚卸モード")}
          onClick={() => {
            setMode("inventory");
            resetView();
          }}
        >
          棚卸モード
        </button>

        <button
          style={modeButton("search", "探索モード")}
          onClick={() => {
            setMode("search");
            resetView();
          }}
        >
          探索モード
        </button>
      </div>

      {/* 探索対象設定 */}
      {mode === "search" && (
        <div
          style={{
            padding: "12px",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            marginBottom: "16px",
            background: "#f8fafc"
          }}
        >
          <div style={{ marginBottom: "8px", fontWeight: "bold" }}>探索対象QRコード</div>

          <select
            value={targetCode}
            onChange={(e) => setTargetCode(e.target.value)}
            style={{
              padding: "8px",
              borderRadius: "6px",
              width: "100%",
              maxWidth: "320px",
              marginBottom: "10px"
            }}
          >
            {Object.keys(assetTable).map((key) => (
              <option key={key} value={key}>
                {key} - {assetTable[key].name}
              </option>
            ))}
          </select>

          <div style={{ fontSize: "14px", color: "#334155" }}>
            現在の対象: <strong>{targetCode}</strong>
          </div>
          <div style={{ fontSize: "14px", color: "#334155" }}>
            {assetTable[targetCode]?.name} / {assetTable[targetCode]?.category} / {assetTable[targetCode]?.location}
          </div>
        </div>
      )}

      {/* 操作ボタン */}
      <div style={{ marginBottom: "16px" }}>
        {!isScanning ? (
          <button style={buttonStyle} onClick={startScan}>
            カメラ起動
          </button>
        ) : (
          <button style={secondaryButtonStyle} onClick={stopScan}>
            スキャン停止
          </button>
        )}

        <button style={secondaryButtonStyle} onClick={resetView}>
          表示リセット
        </button>
      </div>

      {/* 読取画面 */}
      <div
        id={READER_ID}
        style={{
          width: "100%",
          maxWidth: "360px",
          minHeight: "260px",
          border: "1px solid #cbd5e1",
          borderRadius: "8px",
          marginBottom: "16px",
          overflow: "hidden",
          background: "#000"
        }}
      />

      {/* 状態表示 */}
      <div
        style={{
          padding: "14px",
          borderRadius: "8px",
          background: found ? "#dcfce7" : "#f8fafc",
          border: found ? "1px solid #22c55e" : "1px solid #cbd5e1",
          marginBottom: "16px"
        }}
      >
        <div style={{ fontSize: "14px", color: "#475569", marginBottom: "6px" }}>
          状態: {status}
        </div>
        <div style={{ fontSize: "18px", fontWeight: "bold" }}>
          {result}
        </div>
      </div>

      {/* 台帳表示（検証用） */}
      <div
        style={{
          padding: "12px",
          border: "1px solid #cbd5e1",
          borderRadius: "8px",
          marginBottom: "16px"
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: "8px" }}>検証用台帳</div>
        <ul style={{ margin: 0, paddingLeft: "18px" }}>
          {Object.entries(assetTable).map(([key, value]) => (
            <li key={key} style={{ marginBottom: "6px" }}>
              <strong>{key}</strong> : {value.name} / {value.category} / {value.location}
            </li>
          ))}
        </ul>
      </div>

      {/* 履歴表示（棚卸モードのみ） */}
      {mode === "inventory" && (
        <div
          style={{
            padding: "12px",
            border: "1px solid #cbd5e1",
            borderRadius: "8px"
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "8px" }}>
            読取履歴（{history.length}件）
          </div>

          {history.length === 0 ? (
            <div style={{ color: "#64748b" }}>まだ読取履歴はありません</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #cbd5e1" }}>コード</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #cbd5e1" }}>名称</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #cbd5e1" }}>区分</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #cbd5e1" }}>場所</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #cbd5e1" }}>状態</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #cbd5e1" }}>時刻</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, idx) => (
                  <tr key={`${item.code}-${idx}`}>
                    <td style={{ padding: "8px", borderBottom: "1px solid #e2e8f0" }}>{item.code}</td>
                    <td style={{ padding: "8px", borderBottom: "1px solid #e2e8f0" }}>{item.label}</td>
                    <td style={{ padding: "8px", borderBottom: "1px solid #e2e8f0" }}>{item.category}</td>
                    <td style={{ padding: "8px", borderBottom: "1px solid #e2e8f0" }}>{item.location}</td>
                    <td style={{ padding: "8px", borderBottom: "1px solid #e2e8f0" }}>{item.status}</td>
                    <td style={{ padding: "8px", borderBottom: "1px solid #e2e8f0" }}>{item.scannedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
``