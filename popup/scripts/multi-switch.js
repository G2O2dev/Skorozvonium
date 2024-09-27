for (let switchEl of document.getElementsByClassName("multi-switch")) {
    let btns = switchEl.getElementsByClassName("multi-switch__button");

    setActive(switchEl, btns[0], 0);
    for (let i = 0; i < btns.length; i++) {
        const btn = btns[i];

        btn.addEventListener("click", () => {
            setActive(switchEl, btn, i);
        });
    }
}

function setActive(switchEl, btn, index) {
    let selector = switchEl.getElementsByClassName("multi-switch__selector")[0];
    selector.style.inset = `${3}px ${switchEl.offsetWidth - btn.offsetLeft - btn.offsetWidth}px ${3}px ${btn.offsetLeft}px`;

    switchEl.getElementsByClassName("active")[0]?.classList.remove("active");
    btn.classList.add("active");

    switchEl.dispatchEvent(new CustomEvent("switched", {
        detail: {
            index: index,
        }
    }));
}