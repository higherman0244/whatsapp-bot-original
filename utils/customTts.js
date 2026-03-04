const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

function randomId(length = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell",
      ["-NoProfile", "-Command", script],
      { windowsHide: true, maxBuffer: 1024 * 1024 * 4 },
      (error, stdout, stderr) => {
        if (error) return reject(new Error(stderr || error.message));
        resolve(stdout || "");
      }
    );
  });
}

async function synthesizeWithCustomVoice({
  text,
  baseDir,
  voice = "Microsoft Zira Desktop",
  rate = 0,
}) {
  if (os.platform() !== "win32") {
    throw new Error("Custom voice synthesis is currently supported on Windows only.");
  }

  const input = String(text || "").trim();
  if (!input) throw new Error("Custom TTS input text is empty.");

  const tempDir = path.join(baseDir, "media", "temp");
  const txtPath = path.join(tempDir, `tts_input_${Date.now()}_${randomId()}.txt`);
  const wavPath = path.join(tempDir, `tts_custom_${Date.now()}_${randomId()}.wav`);
  fs.writeFileSync(txtPath, input.slice(0, 4000), "utf8");

  const psTxt = txtPath.replace(/'/g, "''");
  const psWav = wavPath.replace(/'/g, "''");
  const psVoice = String(voice || "").replace(/'/g, "''");
  const safeRate = Math.max(-10, Math.min(10, Number(rate || 0)));

  const script = `
Add-Type -AssemblyName System.Speech
$text = Get-Content -Raw -Path '${psTxt}'
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$desiredVoice = '${psVoice}'
if ($desiredVoice -and $desiredVoice.Trim().Length -gt 0) {
  $match = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Name -eq $desiredVoice } | Select-Object -First 1
  if ($match) { $synth.SelectVoice($desiredVoice) }
}
$synth.Rate = ${safeRate}
$synth.Volume = 100
$synth.SetOutputToWaveFile('${psWav}')
$synth.Speak($text)
$synth.Dispose()
`;

  try {
    await runPowerShell(script);
  } finally {
    if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
  }

  if (!fs.existsSync(wavPath)) {
    throw new Error("Custom voice synthesis did not generate audio output.");
  }
  return wavPath;
}

module.exports = {
  synthesizeWithCustomVoice,
};
