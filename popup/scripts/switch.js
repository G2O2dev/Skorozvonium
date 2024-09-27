for (let switchEl of document.getElementsByClassName("switch-block")) {
    let input = switchEl.getElementsByTagName("input")[0];

    input.checked = await chrome.runtime.sendMessage({
        action: "get-setting",
        settingName: input.getAttribute("data-setting")
    });

    switchEl.addEventListener("click", () => {
        input.checked = !input.checked;
        chrome.runtime.sendMessage({
            action: "set-setting",
            settingName: input.getAttribute("data-setting"),
            value: input.checked,
        });
    });
}