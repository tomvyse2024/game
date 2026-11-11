// ==============================
// BOX COUNTER - JAVASCRIPT
// ==============================

const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "BOX_COUNTER_DATA";

let count = 0;
let mode = "load";
let logs = [];
let undoStack = [];

let recognition = null;
let isListening = false;
let cameraStream = null;


// ==============================
// LOAD SAVED DATA
// ==============================

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (saved) {
      count = Number(saved.count) || 0;
      mode = saved.mode || "load";
      logs = Array.isArray(saved.logs) ? saved.logs : [];

      $("truckNumber").value = saved.truck || "";
      $("operator").value = saved.operator || "";
    }
  } catch (error) {
    console.log("Could not load saved data.");
  }

  updateUI();
}

function saveData() {
  const data = {
    count,
    mode,
    logs,
    truck: $("truckNumber").value,
    operator: $("operator").value
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}


// ==============================
// UPDATE DISPLAY
// ==============================

function updateUI() {
  $("count").textContent = count.toLocaleString();

  if (mode === "load") {
    $("counterLabel").textContent = "စုစုပေါင်း တင်ပြီးသောဖာ";
  } else {
    $("counterLabel").textContent = "စုစုပေါင်း ချပြီးသောဖာ";
  }

  document.querySelectorAll(".mode-btn").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.mode === mode
    );
  });

  renderHistory();
}


// ==============================
// MODE SELECTION
// ==============================

document.querySelectorAll(".mode-btn").forEach(button => {
  button.addEventListener("click", () => {
    mode = button.dataset.mode;
    undoStack = [];

    updateUI();
    saveData();
  });
});


// ==============================
// COUNT SYSTEM
// ==============================

function changeCount(amount, source) {
  const previous = count;
  const next = Math.max(0, count + amount);

  if (next === previous) return;

  undoStack.push(previous);

  count = next;

  logs.push({
    time: new Date().toLocaleString(),
    mode,
    amount,
    total: count,
    source
  });

  if (logs.length > 100) {
    logs = logs.slice(-100);
  }

  updateUI();
  saveData();
}

$("plusBtn").addEventListener("click", () => {
  changeCount(1, "Manual +1");
});

$("minusBtn").addEventListener("click", () => {
  changeCount(-1, "Manual -1");
});

document.querySelectorAll("[data-add]").forEach(button => {
  button.addEventListener("click", () => {
    const amount = Number(button.dataset.add);
    changeCount(amount, "Manual +" + amount);
  });
});

$("undoBtn").addEventListener("click", () => {
  if (undoStack.length === 0) {
    alert("ပြန်ဖျက်စရာ မရှိသေးပါ။");
    return;
  }

  count = undoStack.pop();

  logs.push({
    time: new Date().toLocaleString(),
    mode,
    amount: 0,
    total: count,
    source: "Undo"
  });

  updateUI();
  saveData();
});


// ==============================
// HISTORY
// ==============================

function renderHistory() {
  const container = $("history");
  container.innerHTML = "";

  if (logs.length === 0) {
    container.innerHTML =
      '<p class="empty">မှတ်တမ်းမရှိသေးပါ။</p>';
    return;
  }

  logs.slice().reverse().forEach(item => {
    const row = document.createElement("div");
    row.className = "history-item";

    const left = document.createElement("span");
    left.textContent =
      item.time + " | " + item.source;

    const right = document.createElement("strong");
    right.textContent =
      item.total.toLocaleString() + " ဖာ";

    row.appendChild(left);
    row.appendChild(right);

    container.appendChild(row);
  });
}


// ==============================
// VOICE NUMBER RECOGNITION
// ==============================

function parseSpeechNumber(text) {

  // Myanmar digits -> English digits
  const myDigits = "၀၁၂၃၄၅၆၇၈၉";

  text = text.replace(/[၀-၉]/g, digit => {
    return myDigits.indexOf(digit);
  });

  // 1. Check numeric digits first
  const digitMatch = text.match(/\d+/);

  if (digitMatch) {
    return Number(digitMatch[0]);
  }

  // 2. English number words
  const words = text.toLowerCase()
    .replace(/-/g, " ")
    .replace(/[.,!?]/g, " ")
    .split(/\s+/);

  const ones = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19
  };

  const tens = {
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90
  };

  let total = 0;
  let current = 0;
  let found = false;

  for (const word of words) {

    if (ones[word] !== undefined) {
      current += ones[word];
      found = true;
    }

    else if (tens[word] !== undefined) {
      current += tens[word];
      found = true;
    }

    else if (word === "hundred") {
      current = (current || 1) * 100;
      found = true;
    }

    else if (word === "thousand") {
      total += (current || 1) * 1000;
      current = 0;
      found = true;
    }
  }

  if (found) {
    return total + current;
  }

  // 3. Burmese number words
  const burmese = text.replace(/\s/g, "");

  const burmeseUnits = [
    ["ခုနစ်", 7],
    ["ခုနှစ်", 7],
    ["ခြောက်", 6],
    ["ရှစ်", 8],
    ["ကိုး", 9],
    ["သုံး", 3],
    ["နှစ်", 2],
    ["တစ်", 1],
    ["လေး", 4],
    ["ငါး", 5]
  ];

  function findBurmeseUnit(value) {
    for (const [word, number] of burmeseUnits) {
      if (value.includes(word)) {
        return number;
      }
    }
    return 0;
  }

  // Example: နှစ်ဆယ့်ငါး = 25
  if (burmese.includes("ဆယ်")) {

    const parts = burmese.split("ဆယ်");

    const prefix = parts[0];
    const suffix = parts.slice(1).join("ဆယ်")
      .replace(/^[့့်]/, "");

    const tensValue = prefix
      ? findBurmeseUnit(prefix) * 10
      : 10;

    const unitValue = findBurmeseUnit(suffix);

    return tensValue + unitValue;
  }

  // Example: နှစ်ဖာ = 2
  if (burmese.includes("ရာ")) {
    const prefix = burmese.split("ရာ")[0];
    return (findBurmeseUnit(prefix) || 1) * 100;
  }

  const unit = findBurmeseUnit(burmese);

  if (unit > 0) {
    return unit;
  }

  return null;
}


// ==============================
// START VOICE
// ==============================

function startVoice() {

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert(
      "ဒီ Browser မှာ Voice Recognition မရနိုင်ပါ။ Chrome Browser ဖြင့် စမ်းကြည့်ပါ။"
    );
    return;
  }

  if (isListening) return;

  recognition = new SpeechRecognition();

  recognition.lang = $("voiceLanguage").value;
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  isListening = true;

  $("startVoice").disabled = true;
  $("stopVoice").disabled = false;

  $("voiceStatus").textContent = "🎤 အသံနားထောင်နေပါပြီ...";

  recognition.onresult = (event) => {

    for (
      let i = event.resultIndex;
      i < event.results.length;
      i++
    ) {

      if (!event.results[i].isFinal) continue;

      const transcript =
        event.results[i][0].transcript.trim();

      $("lastSpeech").textContent =
        "ကြားလိုက်သောအသံ: " + transcript;

      const amount = parseSpeechNumber(transcript);

      if (amount !== null && amount > 0) {

        changeCount(amount, "Voice: " + transcript);

        $("voiceStatus").textContent =
          amount + " ဖာ ထည့်ပြီးပါပြီ။";

      } else {

        $("voiceStatus").textContent =
          "အရေအတွက်ကို ရှင်းရှင်းလင်းလင်း ပြောပေးပါ။";
      }
    }
  };

  recognition.onerror = (event) => {

    $("voiceStatus").textContent =
      "Voice Error: " + event.error;

    if (
      event.error === "not-allowed" ||
      event.error === "service-not-allowed"
    ) {
      stopVoice();
    }
  };

  recognition.onend = () => {

    if (isListening) {
      try {
        recognition.start();
      } catch (error) {
        console.log("Voice restart waiting.");
      }
    } else {
      $("startVoice").disabled = false;
      $("stopVoice").disabled = true;
    }
  };

  try {
    recognition.start();
  } catch (error) {
    stopVoice();
    $("voiceStatus").textContent =
      "Voice စတင်၍မရပါ။ ထပ်စမ်းကြည့်ပါ။";
  }
}


// ==============================
// STOP VOICE
// ==============================

function stopVoice() {

  isListening = false;

  if (recognition) {
    recognition.stop();
  }

  $("startVoice").disabled = false;
  $("stopVoice").disabled = true;

  $("voiceStatus").textContent =
    "Voice ရပ်ထားပါပြီ။";
}

$("startVoice").addEventListener("click", startVoice);
$("stopVoice").addEventListener("click", stopVoice);


// ==============================
// CAMERA SYSTEM
// ==============================

async function startCamera() {

  if (!navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia) {

    $("cameraStatus").textContent =
      "Camera အသုံးပြုရန် HTTPS သို့မဟုတ် localhost လိုအပ်နိုင်သည်။";

    return;
  }

  try {

    cameraStream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" }
        },
        audio: false
      });

    $("camera").srcObject = cameraStream;

    $("startCamera").disabled = true;
    $("stopCamera").disabled = false;

    $("cameraStatus").textContent =
      "Camera ဖွင့်ထားပါပြီ။";

  } catch (error) {

    $("cameraStatus").textContent =
      "Camera ဖွင့်မရပါ။ Permission စစ်ဆေးပါ။";

    console.error(error);
  }
}


function stopCamera() {

  if (cameraStream) {

    cameraStream.getTracks().forEach(track => {
      track.stop();
    });

    cameraStream = null;
  }

  $("camera").srcObject = null;

  $("startCamera").disabled = false;
  $("stopCamera").disabled = true;

  $("cameraStatus").textContent =
    "Camera ပိတ်ထားပါပြီ။";
}

$("startCamera").addEventListener("click", startCamera);
$("stopCamera").addEventListener("click", stopCamera);


// ==============================
// CSV EXPORT
// ==============================

function exportCSV() {

  const truck = $("truckNumber").value;
  const operator = $("operator").value;

  let csv =
    "Date,Mode,Amount,Total,Source,Truck,Operator\n";

  logs.forEach(item => {

    const row = [
      item.time,
      item.mode,
      item.amount,
      item.total,
      item.source,
      truck,
      operator
    ];

    csv += row.map(value => {
      return '"' +
        String(value ?? "").replace(/"/g, '""') +
        '"';
    }).join(",") + "\n";
  });

  const blob = new Blob(
    ["\uFEFF" + csv],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = "BOX_COUNTER_REPORT.csv";

  link.click();

  URL.revokeObjectURL(url);
}

$("exportBtn").addEventListener("click", exportCSV);


// ==============================
// RESET
// ==============================

$("resetBtn").addEventListener("click", () => {

  const confirmReset = confirm(
    "ရေတွက်ထားသော အရေအတွက်နှင့် မှတ်တမ်းများကို Reset လုပ်မှာ သေချာပါသလား?"
  );

  if (!confirmReset) return;

  count = 0;
  logs = [];
  undoStack = [];

  updateUI();
  saveData();
});


// ==============================
// SAVE JOB INFORMATION
// ==============================

$("truckNumber").addEventListener("input", saveData);
$("operator").addEventListener("input", saveData);


// ==============================
// INITIALIZE
// ==============================

loadData();
