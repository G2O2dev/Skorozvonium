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

function endCall() {
    const callBtn = document.getElementById("call_button");

    if (callBtn.classList.contains("button__danger")) {
        callBtn.click();
    }
}

function fillComment(commentArea, word) {
    setNativeValue(commentArea, word);
    commentArea.dispatchEvent(new Event('input', {bubbles: true}));
}

function saveDialog() {
    const saveBtn = document.querySelector(".save-and-next");

    setTimeout(() => saveBtn.click(), 50);
}

//#region Scenario

function createSheet(link) {
    const iframe = document.createElement("iframe");
    iframe.src = link;

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

function createHotBtns(resultList, commentArea, words) {
    const wrapper = document.createElement("div");
    wrapper.className = "grid-x grid-padding-x e-hot-list e-none";

    words.unshift("Назад");
    for (let i = 0; i < words.length; i++) {
        const word = words[i];

        const btn = document.createElement("div");
        btn.textContent = word;

        if (i === 0) {
            btn.onclick = () => {
                wrapper.classList.add("e-none");
                resultList.classList.remove("e-none");
            };
        } else {
            btn.onclick = () => {
                endCall();
                fillComment(commentArea, word);
                saveDialog();
            };
        }

        wrapper.appendChild(btn);
    }

    return wrapper;
}

function deployHotBtns() {
    try {
        const resultList = document.querySelector(".result-list");
        if (resultList == null)
            return;

        const deployPlace = resultList.parentElement;
        const commentArea = document.querySelector(".voice-record-textarea textarea");

        let noContactBtns = createHotBtns(resultList, commentArea, ["Автоответчик", "Сброс", "Молчит", "Тишина"]);
        let declineBtns = createHotBtns(resultList, commentArea, ["Не актуально", "Сброс", "Негатив"]);

        deployPlace.appendChild(noContactBtns);
        deployPlace.appendChild(declineBtns);

        resultList.querySelector('[value="492969"]').addEventListener("click", (e) => {
            resultList.classList.toggle("e-none");
            noContactBtns.classList.toggle("e-none");
        });
        resultList.querySelector('[value="492976"]').addEventListener("click", (e) => {
            resultList.classList.toggle("e-none");
            declineBtns.classList.toggle("e-none");
        });
    } catch (error) {
        console.error("Error replacing buttons:", error);
    }
}

//#endregion

new MutationObserver(async () => {
    const callCard = document.getElementById("call-card");
    const callBtn = document.getElementById("call_button");

    if (!callCard || document.getElementsByClassName("lead-edit").length === 0)
        return

    if (document.getElementsByTagName("iframe").length === 0)
        findScenario();

    if (document.getElementsByClassName("e-hot-list").length === 0)
        await deployHotBtns();

    if (callBtn != null)
        callBtn.addEventListener("click", () => callCard.classList.add("call-ended-manually"));
}).observe(document, {childList: true, subtree: true});

window.addEventListener("skorozvonium:call-ended", (e) => {
    console.log(e.detail)
    chrome.runtime.sendMessage({action: "get-setting", settingName: "auto-recall"}).then(autoRecall => {
        const callCard = document.getElementById("call-card");

        if (autoRecall && e.detail.in && e.detail.duration <= 3.5 && !callCard?.classList.contains("call-ended-manually")) {
            window.dispatchEvent(new CustomEvent("skorozvonium:call"));
        }
    });
})