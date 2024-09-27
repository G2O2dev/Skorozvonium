let stats;

document.addEventListener("DOMContentLoaded", async () => {
    stats = await chrome.runtime.sendMessage({
        action: "get-stats",
        timestamp: new Date().setHours(0),
    });
    console.log(stats);
    updateCounters();

    document.getElementsByClassName("multi-switch")[0].addEventListener("switched", async (e) => {
        let d = new Date();
        switch (e.detail.index) {
            case 0:
                stats = await chrome.runtime.sendMessage({
                    action: "get-stats",
                    timestamp: new Date().setHours(0),
                });
                break;
            case 1:
                let day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
                const monday = new Date(d.setDate(diff)).setHours(0);

                stats = await chrome.runtime.sendMessage({
                    action: "get-stats",
                    timestamp: monday,
                });
                break;
            case 2:
                stats = await chrome.runtime.sendMessage({
                    action: "get-stats",
                    timestamp: Number(new Date(d.getFullYear(), d.getMonth(), 1)),
                });
                break;
        }
        console.log(stats);
        updateCounters();
    });
});

const leadsCounter = document.getElementById("leads-counter");
const dialogsCounter = document.getElementById("dialog-counter");
const perHourCounter = document.getElementById("dialog-per-hour-counter");
const workHours = document.getElementById("work-hours");

function updateCounters() {
    animateCounter(perHourCounter, stats.dialogPerHour);
    animateCounter(dialogsCounter, stats.dialogs);
    animateCounter(leadsCounter, stats.leads);
    animateCounter(workHours, stats.workHours);

    if (stats.dialogPerHour < 33) {
        perHourCounter.style.color = "#FF5858";
    } else if (stats.dialogPerHour >= 33 && stats.dialogPerHour < 40) {
        perHourCounter.style.color = "#FFD358";
    } else if (stats.dialogPerHour >= 40 && stats.dialogPerHour < 45) {
        perHourCounter.style.color = "#c7ff58";
    } else if (stats.dialogPerHour >= 45) {
        perHourCounter.style.color = "#58FF8A";
    }
}

function animateCounter(counter, to) {
    counter.innerHTML = to;
}
