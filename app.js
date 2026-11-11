
// ======================================
// BOX COUNTER - VOICE FIRST VERSION 2.0
// ======================================

const $ = id => document.getElementById(id);

const STORAGE_KEY = "BOX_COUNTER_V2";

let total = 0;
let mode = "load";
let logs = [];
let undoStack = [];

let recognition = null;
let isListening = false;
let isSpeaking = false;
let restartTimer = null;


// ======================================
// 1. NUMBER RECOGNITION
// ======================================

const numberWords = {
  "one": 1,
  "won": 1,

  "two": 2,
  "to": 2,
  "too": 2,
  "tow": 2,

  "three": 3,
  "tree": 3,

  "four": 4,
  "for": 4,

  "five": 5,
  "six": 6,
  "seven": 7,
  "eight": 8,
  "ate": 8,
  "nine": 9,
  "ten": 10
};

const burmeseNumbers = {
  "တစ်": 1,
  "တစ္": 1,
  "နှစ်": 2,
  "နစ်": 2,
  "သုံး": 3,
  "လေး": 4,
  "ငါး": 5,
  "ခြောက်": 6,
  "ခုနစ်": 7,
  "ခုနှစ်": 7,
  "ရှစ်": 8,
  "ကိုး": 9,
  "တစ်ဆယ်": 10,
  "ဆယ်": 10
};

const myDigits = "၀၁၂၃၄၅၆၇၈၉";

function normalizeText(text) {

  return text
    .toLowerCase()
    .replace(/[၀-၉]/g, d => myDigits.indexOf(d))
    .replace(/[.,!?၊။]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function recognizeNumber(text) {

  const normalized = normalizeText(text);

  // Exact numeric value only: 1 to 10
  const numericMatch = normalized.match(/\d+/);

  if (numericMatch) {
    const value = Number(numericMatch[0]);

    return value >= 1 && value <= 10
      ? value
      : null;
  }

  // Exact Burmese number words
  if (burmeseNumbers[normalized] !== undefined) {
    return burmeseNumbers[normalized];
  }

  // English number words and common recognition errors
  const tokens = normalized.split(" ");

  for (const token of tokens) {

    if (numberWords[token] !== undefined) {
      return numberWords[token];
    }
  }

  // Burmese word inside a longer recognized sentence
  for (const [word, value] of Object.entries(burmeseNumbers)) {

    if (normalized.includes(word)) {
      return value;
    }
  }

  return null;
}


// ======================================
// 2. MYANMAR NUMBER SPEECH TEXT
// ======================================

const myDigitsText = [
  "",
  "တစ်",
  "နှစ်",
  "သုံး",
  "လေး",
  "ငါး",
  "ခြောက်",
  "ခုနစ်",
  "ရှစ်",
  "ကိုး"
];

function myanmarNumber(number) {

  if (number === 0) return "သုည";

  if (number < 10) {
    return myDigitsText[number];
  }

  if (number === 10) return "ဆယ်";

  if (number < 20) {
    return "ဆယ့်" + myDigitsText[number - 10];
  }

  if (number < 100) {

    const tens = Math.floor(number / 10);
    const units = number % 10;

    return myDigitsText[tens] + "ဆယ်" +
      (units ? "့" + myDigitsText[units] : "");
  }

  if (number < 1000) {

    const hundreds = Math.floor(number / 100);
    const remainder = number % 100;

    return myDigitsText[hundreds] + "ရာ" +
      (remainder ? myanmarNumber(remainder) : "");
  }

  if (number < 10000) {

    const thousands = Math.floor(number / 1000);
    const remainder = number % 1000;

    return myDigitsText[thousands] + "ထောင်" +
      (remainder ? myanmarNumber(remainder) : "");
  }

  return String(number);
}


// ======================================
// 3. TEXT TO SPEECH
// ======================================

function speakTotal() {

  if (!("speechSynthesis" in window)) {
    $("voiceStatus").textContent =
      "ဒီ Browser မှာ အသံပြန်ထွက်တဲ့စနစ် မရနိုင်ပါ။";
    return;
  }

  // Stop previous speech
  speechSynthesis.cancel();

  const text = "စုစုပေါင်း " +
    myanmarNumber(total) + " ဖာ";

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.lang = "my-MM";
  utterance.rate = 0.9;
  utterance.pitch = 1;

  const voices = speechSynthesis.getVoices();

  const myanmarVoice = voices.find(v =>
    v.lang.toLowerCase().startsWith("my")
  );

  if (myanmarVoice) {
    utterance.voice = myanmarVoice;
  }

  isSpeaking = true;

  utterance.onend = () => {
    isSpeaking = false;
    resumeListening();
  };

  utterance.onerror = () => {
    isSpeaking = false;
    resumeListening();
  };

  speechSynthesis.speak(utterance);
}


// ======================================
// 4. SAVE DATA
// ======================================

function saveData() {

  const data = {
    total,
    mode,
    logs,
    truck: $("truckNumber").value,
    operator: $("operator").value
  };

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(data)
  );
}

function loadData() {

  try {

    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY)
    );

    if (saved) {

      total = Number(saved.total) || 0;
      mode = saved.mode || "load";
      logs = Array.isArray(saved.logs)
        ? saved.logs
        : [];

      $("truckNumber").value = saved.truck || "";
      $("operator").value = saved.operator || "";
    }

  } catch (error) {
    console.log("No saved data.");
  }

  updateUI();
}


// ======================================
// 5. UPDATE DISPLAY
// ======================================

function updateUI() {

  $("count").textContent =
    total.toLocaleString();

  $("counterLabel").textContent =
    mode === "load"
      ? "စုစုပေါင်း တင်ပြီးသောဖာ"
      : "စုစုပေါင်း ချပြီးသောဖာ";

  document.querySelectorAll(".mode-btn")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.mode === mode
      );
    });

  renderHistory();
}


// ======================================
// 6. ADD COUNT
// ======================================

function addCount(amount, source) {

  if (!Number.isInteger(amount) ||
      amount < 1 ||
      amount > 10) {
    return;
  }

  undoStack.push(total);

  total += amount;

  logs.push({
    time: new Date().toLocaleString(),
    mode,
    amount,
    total,
    source
  });

  updateUI();
  saveData();

  $("lastSpeech").textContent =
    "နောက်ဆုံးရေတွက်မှု: +" + amount;

  // Immediately speak updated total
  speakTotal();
}


// ======================================
// 7. VOICE RECOGNITION
// ======================================

function createRecognition() {

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert(
      "Chrome Browser နဲ့ စမ်းကြည့်ပါ။ Voice Recognition မရနိုင်ပါ။"
    );
    return null;
  }

  const rec = new SpeechRecognition();

  // English is recommended for clearer 1-10 recognition.
  rec.lang = $("voiceLanguage").value || "en-US";

  rec.continuous = true;
  rec.interimResults = false;
  rec.maxAlternatives = 5;

  return rec;
}


// ======================================
// 8. START LISTENING
// ======================================

function startVoice() {

  if (isListening) return;

  recognition = createRecognition();

  if (!recognition) return;

  isListening = true;

  $("startVoice").disabled = true;
  $("stopVoice").disabled = false;

  $("voiceStatus").textContent =
    "🎤 အသံနားထောင်နေပါပြီ...";

  recognition.onresult = event => {

    for (
      let i = event.resultIndex;
      i < event.results.length;
      i++
    ) {

      if (!event.results[i].isFinal) continue;

      const result = event.results[i];

      let detectedNumber = null;
      let detectedText = "";

      // Check recognition alternatives
      for (
        let j = 0;
        j < result.length;
        j++
      ) {

        const transcript =
          result[j].transcript.trim();

        const number =
          recognizeNumber(transcript);

        if (number !== null) {

          detectedNumber = number;
          detectedText = transcript;

          break;
        }
      }

      if (detectedNumber !== null) {

        $("lastSpeech").textContent =
          "ကြားလိုက်သောအသံ: " + detectedText;

        $("voiceStatus").textContent =
          "+" + detectedNumber +
          " ဖာ ပေါင်းလိုက်ပါပြီ။";

        // Stop microphone while speaking
        pauseListening();

        addCount(
          detectedNumber,
          "Voice: " + detectedText
        );

      } else {

        $("lastSpeech").textContent =
          "ကြားလိုက်သောအသံ: " +
          result[0].transcript;

        $("voiceStatus").textContent =
          "1 မှ 10 အတွင်း အရေအတွက်ကို ပြောပါ။";
      }
    }
  };

  recognition.onerror = event => {

    console.log("Voice error:", event.error);

    if (
      event.error === "not-allowed" ||
      event.error === "service-not-allowed"
    ) {

      stopVoice();

      $("voiceStatus").textContent =
        "Microphone Permission ပေးပါ။";
    }
  };

  recognition.onend = () => {

    if (isListening && !isSpeaking) {
      restartListening();
    }
  };

  try {
    recognition.start();
  } catch (error) {
    console.log(error);
  }
}


// ======================================
// 9. PAUSE AND RESUME MICROPHONE
// ======================================

function pauseListening() {

  if (recognition) {

    try {
      recognition.stop();
    } catch (error) {
      console.log(error);
    }
  }
}

function resumeListening() {

  if (!isListening) return;

  if (recognition) {

    try {
      recognition.start();

      $("voiceStatus").textContent =
        "🎤 အသံနားထောင်နေပါပြီ...";

    } catch (error) {
      restartListening();
    }
  }
}

function restartListening() {

  clearTimeout(restartTimer);

  if (!isListening || isSpeaking) return;

  restartTimer = setTimeout(() => {

    if (!isListening || isSpeaking) return;

    try {
      recognition.start();
    } catch (error) {
      console.log("Waiting to restart voice.");
    }

  }, 500);
}


// ======================================
// 10. STOP VOICE
// ======================================

function stopVoice() {

  isListening = false;
  isSpeaking = false;

  clearTimeout(restartTimer);

  if (recognition) {
    try {
      recognition.stop();
    } catch (error) {
      console.log(error);
    }
  }

  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
  }

  $("startVoice").disabled = false;
  $("stopVoice").disabled = true;

  $("voiceStatus").textContent =
    "အသံရပ်ထားပါပြီ။";
}

$("startVoice").addEventListener(
  "click",
  startVoice
);

$("stopVoice").addEventListener(
  "click",
  stopVoice
);


// ======================================
// 11. MANUAL BUTTONS
// ======================================

$("plusBtn").addEventListener("click", () => {
  pauseListening();
  addCount(1, "Manual +1");
});

$("minusBtn").addEventListener("click", () => {

  if (total <= 0) return;

  undoCount();
});

document.querySelectorAll("[data-add]")
  .forEach(button => {

    button.addEventListener("click", () => {

      const amount = Number(button.dataset.add);

      pauseListening();

      addCount(amount, "Manual +" + amount);
    });
  });


// ======================================
// 12. UNDO
// ======================================

function undoCount() {

  if (undoStack.length === 0) {
    alert("ပြန်ဖျက်စရာ မရှိသေးပါ။");
    return;
  }

  total = undoStack.pop();

  logs.push({
    time: new Date().toLocaleString(),
    mode,
    amount: 0,
    total,
    source: "Undo"
  });

  updateUI();
  saveData();

  pauseListening();
  speakTotal();
}

$("undoBtn").addEventListener(
  "click",
  undoCount
);


// ======================================
// 13. MODE
// ======================================

document.querySelectorAll(".mode-btn")
  .forEach(button => {

    button.addEventListener("click", () => {

      mode = button.dataset.mode;

      updateUI();
      saveData();
    });
  });


// ======================================
// 14. HISTORY
// ======================================

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
      item.total + " ဖာ";

    row.appendChild(left);
    row.appendChild(right);

    container.appendChild(row);
  });
}


// ======================================
// 15. CSV EXPORT
// ======================================

$("exportBtn").addEventListener("click", () => {

  let csv =
    "Date,Mode,Amount,Total,Source,Truck,Operator\n";

  logs.forEach(item => {

    const values = [
      item.time,
      item.mode,
      item.amount,
      item.total,
      item.source,
      $("truckNumber").value,
      $("operator").value
    ];

    csv += values.map(value =>
      '"' + String(value ?? "")
        .replace(/"/g, '""') + '"'
    ).join(",") + "\n";
  });

  const blob = new Blob(
    ["\uFEFF" + csv],
    { type: "text/csv;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = "BOX_COUNTER_REPORT.csv";

  link.click();

  URL.revokeObjectURL(url);
});


// ======================================
// 16. RESET
// ======================================

$("resetBtn").addEventListener("click", () => {

  if (!confirm("အရေအတွက်အားလုံး Reset လုပ်မှာ သေချာပါသလား?")) {
    return;
  }

  total = 0;
  logs = [];
  undoStack = [];

  updateUI();
  saveData();

  pauseListening();
  speakTotal();
});


// ======================================
// 17. JOB INFORMATION
// ======================================

$("truckNumber").addEventListener("input", saveData);
$("operator").addEventListener("input", saveData);


// ======================================
// 18. INITIALIZE
// ======================================

loadData();

if ("speechSynthesis" in window) {
  speechSynthesis.getVoices();
}
