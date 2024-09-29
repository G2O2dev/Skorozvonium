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

    async pushDialog(isLead) {
        try {
            let store = await (await this.open()).transaction('dialogs', 'readwrite').store;
            await store.add({id: Date.now(), isLead: isLead});
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
        let timeline = await db.getWorkStatusesSince(since);
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
        } catch (error) {
            console.error('Failed to set setting:', error);
        }
    }
}

const db = new Database();

async function handleStatsRequest(timestamp, sendResponse) {
    try {
        const dialogs = await db.getDialogsSince(timestamp);
        const leadCount = dialogs.filter(dialog => dialog.isLead).length;

        const normalHours = await db.getNormalHours(timestamp);

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


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case "get-stats":
            handleStatsRequest(request.timestamp, sendResponse);
            return true;
        case "get-setting":
            db.getSetting(request.settingName).then(sendResponse);
            return true;
        case "set-setting":
            db.setSetting(request.settingName, request.value);
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
    try {
        if (req.url.includes("/user_states/") && req.method === "PUT") {
            let postedString = decodeURIComponent(String.fromCharCode.apply(null, new Uint8Array(req.requestBody.raw[0].bytes)));
            await db.pushWorkStatus(JSON.parse(postedString)["status"], Number(new Date()))
        } else if (req.url.includes("/calls/") && req.method === "PUT") {
            let str = decodeURIComponent(String.fromCharCode.apply(null, new Uint8Array(req.requestBody.raw[0].bytes)));
            const result = JSON.parse(str)["result"];

            if ([492976, 492973, 492978].includes(result))
                await db.pushDialog(false);
            else if (492968 === result){
                await db.pushDialog(true);
            }
        }
    } catch (error) {
        console.error('Error in beforeRequest:', error);
    }
}, {urls: ['<all_urls>']}, ['requestBody']);