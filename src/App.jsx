import { useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function App() {
  const [result, setResult] = useState("未読取");

  // ✅ 台帳データ（ここを編集）
  const assetTable = {
    "ASSET-001": "えんぴつ（検証用）",
    "ASSET-002": "消しゴム（検証用）",
    "ASSET-003": "筆箱（検証用）",
  };

  const startScan = () => {
    const scanner = new Html5Qrcode("reader");

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      (decodedText) => {

        // ✅ 台帳照合処理
        if (assetTable[decodedText]) {
          setResult("✅ 棚卸対象: " + assetTable[decodedText]);
        } else {
          setResult("⚠️ 未登録: " + decodedText);
        }

        scanner.stop();
      }
    ).catch(() => {
      alert("カメラ起動失敗");
    });
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>棚卸アプリ（台帳照合）</h1>

      <button onClick={startScan}>
        QR読取開始
      </button>

      <div id="reader" style={{ width: "300px", marginTop: "20px" }} />

      <p style={{ marginTop: "20px", fontSize: "18px" }}>
        {result}
      </p>
    </div>
  );
}