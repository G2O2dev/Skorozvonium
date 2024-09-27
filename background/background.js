import {openDB} from './idb.js';

class Database {
    constructor() {
        this.db = null;
    }

    async open() {
        if (!this.db) {
            this.db = await openDB("skorozvonium", 2, {
                upgrade(db, oldVersion, newVersion, transaction, event) {
                    if (oldVersion === 0) {
                        db.createObjectStore('dialogs', {keyPath: "id"});
                    }
                    if (oldVersion < 2) {
                        const tlStore = db.createObjectStore('work-timeline', {autoIncrement: true});
                        tlStore.createIndex("time", "time", {unique: true});
                        tlStore.createIndex("status", "status", {unique: false});

                        const settingsStore = db.createObjectStore('settings', {keyPath: "name"});
                        settingsStore.createIndex("value", "value", {unique: false});
                        settingsStore.put({name: "hide-script-header", value: true});
                        settingsStore.put({name: "auto-recall", value: false});
                    }
                },
            });
        }
        return this.db;
    }

    async pushDialog(dialog) {
        try {
            const db = await this.open();
            const tx = db.transaction('dialogs', 'readwrite');
            const store = tx.objectStore('dialogs');
            await store.add(dialog);
            await tx.done;
        } catch (error) {
            console.error('Failed to add dialog:', error);
        }
    }

    async getDialogsSince(timestamp) {
        try {
            const db = await this.open();
            const tx = db.transaction('dialogs', 'readonly');
            const store = tx.objectStore('dialogs');
            return await store.getAll(IDBKeyRange.lowerBound(timestamp));
        } catch (error) {
            console.error('Failed to get dialogs:', error);
            return [];
        }
    }

    async pushWorkStatus(status, time) {
        try {
            let store = await (await this.open()).transaction('work-timeline', 'readwrite').store;
            let cursor = await store.openCursor(null, 'prev');

            if (!cursor || cursor.value.status !== status) {
                store.add({time: time, status: status});
            }
        } catch (error) {
            console.error('Failed to add status:', error);
        }
    }

    async getWorkStatusesSince(timestamp) {
        try {
            const db = await this.open();
            const store = await db.transaction('work-timeline', 'readonly').store.index("time");

            return await store.getAll(IDBKeyRange.lowerBound(timestamp));
        } catch (error) {
            console.error('Failed to get dialogs:', error);
            return [];
        }
    }

    async getNormalHours(since) {
        let timeline = await database.getWorkStatusesSince(since);
        let timeOfWork = 0;

        let lastNormalStart = null;

        timeline.forEach((entry, index) => {
            if (lastNormalStart == null && (entry.status === 'normal' || entry.status === 'wrapup')) {
                if (index === timeline.length - 1) {
                    timeOfWork += Number(new Date()) - entry.time;
                } else {
                    lastNormalStart = entry.time;
                }
            } else if (lastNormalStart != null && (entry.status !== 'normal' || entry.status !== 'wrapup')) {
                timeOfWork += entry.time - lastNormalStart;
                lastNormalStart = null;
            }
        });
        console.log(timeOfWork);

        return Math.round(((timeOfWork / (1000 * 60 * 60)) % 24) * 10) / 10;
    }


    async getSetting(name) {
        try {
            const store = await (await this.open()).transaction('settings', 'readonly').store;
            return (await store.get(name)).value;
        } catch (error) {
            console.error('Failed to get setting: ' + name, error);
            return null;
        }
    }

    async setSetting(name, value) {
        try {
            const store = await (await this.open()).transaction('settings', 'readwrite').store;
            store.put({name: name, value: value});
            console.log(await store.getAll());
        } catch (error) {
            console.error('Failed to set setting:', error);
        }
    }
}

const database = new Database();

async function handleStatsRequest(timestamp, sendResponse) {
    //const oneHourAgo = Date.now() - 60 * 60 * 1000;

    try {
        const dialogs = await database.getDialogsSince(timestamp);
        //const dialogCountLastHour = await database.countDialogsSince(oneHourAgo);
        const leadCount = dialogs.filter(dialog => dialog.isLead).length;

        const normalHours = await database.getNormalHours(timestamp);

        sendResponse({
            dialogPerHour: Math.floor(dialogs.length / (normalHours < 1 ? 1 : normalHours)),
            dialogs: dialogs.length,
            leads: leadCount,
            workHours: normalHours,
        });
    } catch (error) {
        console.error('Error in handleStatsRequest:', error);
    }
}

async function handleAddDialog(isLead) {
    try {
        const dialog = {id: Date.now(), isLead};
        await database.pushDialog(dialog);
    } catch (error) {
        console.error('Error adding dialog:', error);
    }
}



let contentPorts = [];
chrome.runtime.onConnect.addListener((port) => {
    contentPorts.push(port);
});
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case "get-stats":
            handleStatsRequest(request.timestamp, sendResponse);
            return true;
        case "get-setting":
            database.getSetting(request.settingName).then(sendResponse);
            return true;
        case "set-setting":
            database.setSetting(request.settingName, request.value);
            break;
        case "add-dialog":
            handleAddDialog(false);
            break;
        case "add-lead":
            handleAddDialog(true);
            break;
        default:
            console.warn('Unknown action:', request.action);
    }
});
chrome.webRequest.onBeforeRequest.addListener(async req => {
    if (req.url.includes("/user_states/") && req.method === "PUT") {
        var postedString = decodeURIComponent(String.fromCharCode.apply(null, new Uint8Array(req.requestBody.raw[0].bytes)));
        database.pushWorkStatus(JSON.parse(postedString)["status"], Number(new Date()))
    } else if (req.url.includes("/stop") && req.method === "POST" && await database.getSetting("auto-recall")) {
        console.log("call end")
        for (let i = 0; i < contentPorts.length; i++) {
            try {
                contentPorts[i].postMessage({message: "call-end"});
            } catch {
            }
        }
    }
}, {urls: ['<all_urls>']}, ['requestBody']);


// chrome.webRequest.onCompleted.addListener(function(details){
//         console.log(details.responseBody);
// },  { urls: ['<all_urls>'] }, ['responseHeaders', 'extraHeaders']);

// chrome.debugger.attach({ tabId: tab.id }, "1.3", () => { /* Attached */ });
//
// chrome.debugger.sendCommand({ tabId: tab.id }, "Network.enable", {});
//
// chrome.debugger.onEvent.addListener((source, method, params) => {
//     if (method === "Network.requestWillBeSent") {
//         console.log('Тело запроса:', params.request.postData);  // Здесь будет тело POST-запроса
//     }
// });