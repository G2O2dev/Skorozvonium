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
        item.onclick = () => handleHotBtnClick(commentArea, word);
        wrapper.appendChild(item);
    });

    const backButton = createBackBtn(wrapper);
    wrapper.appendChild(backButton);

    return wrapper;
}

function createBackBtn(wrapper) {
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

function handleHotBtnClick(commentArea, word) {
    const callBtn = document.getElementById("call_button");
    const saveBtn = document.getElementsByClassName("save-and-next")[0];

    if (callBtn.innerHTML === "Завершить") {
        callBtn.click();
    }

    setNativeValue(commentArea, word);
    commentArea.dispatchEvent(new Event('input', {bubbles: true}));

    setTimeout(() => saveBtn.click(), 50);
}

function replaceBtns() {
    try {
        const resultList = document.querySelector(".result-list");
        const results = resultList.querySelectorAll(".result-item");
        const commentArea = document.querySelector(".voice-record-textarea textarea");
        const deployPlace = resultList.parentElement;

        let noContactBtns = createHotBtns(commentArea, ["Автоответчик", "Сброс", "Молчит", "Тишина"]);
        let declineBtns = createHotBtns(commentArea, ["Не актуально", "Сброс", "Негатив"]);

        handleHotClick(results[7], noContactBtns, resultList, deployPlace);
        handleHotClick(results[10], declineBtns, resultList, deployPlace);
    } catch (error) {
        console.error("Error replacing buttons:", error);
    }
}

function handleHotClick(resultButton, hotBtns, resultList, deployPlace) {
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

function clickCallBtn(iteration = 0) {
    if (iteration < 6) {
        setTimeout(() => {
            let callBtn = document.getElementById("call_button");
            if (!callBtn.classList.contains("button__primary")) {
                clickCallBtn(iteration++);
            } else {
                callBtn.click();
            }
        }, 40)
    }
}


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
        await replaceBtns();
    }
}).observe(document, {childList: true, subtree: true});

window.addEventListener("call:ended", (e) => {
    console.log(e.detail)

    chrome.runtime.sendMessage({action: "get-setting", settingName: "auto-recall"}).then(autoRecall => {
        if (autoRecall && e.detail.in && e.detail.duration < 3) {
            document.getElementById("call_button").click();
        }
    });
})