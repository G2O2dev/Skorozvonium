function setNativeValue(element, value) {
    const {set: valueSetter} = Object.getOwnPropertyDescriptor(element, 'value') || {};
    const prototype = Object.getPrototypeOf(element);
    const {set: prototypeValueSetter} = Object.getOwnPropertyDescriptor(prototype, 'value') || {};

    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
        prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
        valueSetter.call(element, value);
    }
}

//#region Scenario

function createSheet(link) {
    const iframe = document.createElement("iframe");
    iframe.src = link;
    iframe.loading = "eager";

    chrome.runtime.sendMessage({action: "get-setting", settingName: "hide-script-header"}).then(hideHeader => {
        if (hideHeader) {
            iframe.classList.add("scenario-hide-header");
        }
    });

    return iframe;
}

function findSheetLink() {
    try {
        const leadEditForm = document.querySelector(".lead-edit");
        const rows = leadEditForm.querySelectorAll(".row");

        for (const row of rows) {
            const input = row.querySelector(".columns .is-flex .is-grow input");
            if (input && input.value.startsWith("https://docs.google.com")) {
                return input.value;
            }
        }
    } catch {
    }
    return null;
}

function findScenario() {
    const sheetLink = findSheetLink();
    if (sheetLink) {
        loadScenario(sheetLink);
        console.log("Scenario loaded through UI");
    }
}

function loadScenario(link) {
    const infoCard = document.querySelector(".card-lead-info");
    const scenarioContainer = infoCard.querySelector(".tabs-details");
    scenarioContainer.appendChild(createSheet(link));
}

//#endregion

//#region Buttons

function createHotBtns(commentArea, words) {
    const wrapper = document.createElement("div");
    wrapper.className = "grid-x grid-padding-x e-hot-list";

    words.forEach(word => {
        const item = document.createElement("div");
        item.innerHTML = word;
        item.onclick = () => handleHotButtonClick(commentArea, word);
        wrapper.appendChild(item);
    });

    const backButton = createBackButton(wrapper);
    wrapper.appendChild(backButton);

    return wrapper;
}

function createBackButton(wrapper) {
    const backButton = document.createElement("div");
    backButton.innerHTML = "Назад";
    backButton.style.order = "-2";
    backButton.style.background = "#373737";
    backButton.style.color = "#f0f0f0";

    backButton.onclick = () => {
        wrapper.classList.add("e-none");
        document.getElementsByClassName("result-list")[0].classList.remove("e-none");
    };

    return backButton;
}

function handleHotButtonClick(commentArea, word) {
    const callBtn = document.getElementById("call_button");
    const saveBtn = document.getElementsByClassName("save-and-next")[0];

    if (callBtn.innerHTML === "Завершить") {
        callBtn.click();
    }

    setNativeValue(commentArea, word);
    commentArea.dispatchEvent(new Event('input', {bubbles: true}));

    setTimeout(() => saveBtn.click(), 50);
}

function replaceButtons() {
    try {
        const resultList = document.querySelector(".result-list");
        const results = resultList.querySelectorAll(".result-item");
        const commentArea = document.querySelector(".voice-record-textarea textarea");
        const deployPlace = resultList.parentElement;

        let noContactBtns = createHotBtns(commentArea, ["Автоответчик", "Сброс", "Молчит", "Тишина"]);
        let declineBtns = createHotBtns(commentArea, ["Не актуально", "Сброс", "Негатив"]);

        setupResultButtonHandlers(results[7], noContactBtns, resultList, deployPlace);
        setupResultButtonHandlers(results[10], declineBtns, resultList, deployPlace);
    } catch (error) {
        console.error("Error replacing buttons:", error);
    }
}

function setupResultButtonHandlers(resultButton, hotBtns, resultList, deployPlace) {
    let btnsDeployed = false;

    resultButton.onclick = () => {
        if (btnsDeployed) {
            hotBtns.classList.remove("e-none");
            resultList.classList.add("e-none");
        } else {
            deployPlace.appendChild(hotBtns);
            resultList.classList.add("e-none");
            btnsDeployed = true;
        }
    };
}

//#endregion

//#region Auto Recall

function onCallEnd() {
    console.log("checking for recall")

    const callCard = document.getElementById("call-card");
    if (callCard.classList.contains("auto-recall-disabled"))
        return;

    const substate = document.getElementsByClassName("call-substate")[0];
    const duration = substate.getElementsByClassName("duration")[0]?.innerHTML;
    if (duration == null) {
        console.log("need recall" + duration);
        waitAndClickCallBtn();
    } else {
        console.log("need recall" + duration);
        let match = /^(?:([0-9]*):)?([0-9]*)$/.exec(duration);
        const min = parseInt(match[1], 10) || 0;
        const sec = parseInt(match[2], 10) || 0;

        if (min <= 0 && sec <= 3) {
            waitAndClickCallBtn();
        }
    }
}

function waitAndClickCallBtn(iteration = 0) {
    if (iteration < 7) {
        setTimeout(() => {
            let callBtn = document.getElementById("call_button");
            if (!callBtn.classList.contains("button__primary")) {
                waitAndClickCallBtn(iteration++);
            } else {
                callBtn.click();
                console.log("Manualy CLIKCEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD")
            }
        }, 40)
    }
}

//#endregion


function initPort() {
    const port = chrome.runtime.connect({name: "content-background-connection"});

    port.onMessage.addListener((msg) => {
        switch (msg.message) {
            case "call-end":
                onCallEnd();
                break;
            default:
                console.warn('Unknown payload:', msg.message);
        }
    });
}
function initMutationObserver() {
    let btnsNeedReplace = true;
    new MutationObserver(async () => {
        if (document.getElementsByClassName("lead-edit").length !== 0
            && document.getElementsByTagName("iframe").length === 0) {
            findScenario();
        }

        const scenarioResults = document.getElementsByClassName("scenario-results");
        if (scenarioResults.length === 0) {
            btnsNeedReplace = true;
        } else if (btnsNeedReplace) {
            btnsNeedReplace = false;
            await replaceButtons();
        }

        const saveBtn = document.querySelector(".save-and-next");
        if (saveBtn && !saveBtn.classList.contains("save-handled")) {
            saveBtn.classList.add("save-handled");
            saveBtn.addEventListener("click", handleSave, {once: true});
        }

        const callBtn = document.getElementById("call_button");
        const callCard = document.getElementById("call-card");
        if (callBtn != null && !callCard.classList.contains("call-ended-manually")) {
            callBtn.addEventListener("click", () => callCard.classList.add("auto-recall-disabled"));
        }
    }).observe(document, {childList: true, subtree: true});
}

initPort();
initMutationObserver();

async function handleSave() {
    const callBtn = document.getElementById("call_button");
    if (callBtn.innerHTML !== "Завершить") {
        const resultList = document.querySelector(".result-list");
        const inputs = resultList.querySelectorAll("input");

        for (const input of inputs) {
            if (input.checked) {
                if (["492976", "492973", "492978"].includes(input.value)) {
                    await chrome.runtime.sendMessage({action: "add-dialog"});
                } else if (input.value === "492968") {
                    await chrome.runtime.sendMessage({action: "add-lead"});
                }
                break;
            }
        }
    }
}