function listenTube() {
    setTimeout(() => {
        try {
            Tube.Phone.on("call:ended", (e) => {
                window.dispatchEvent(new CustomEvent("call:ended", {
                    detail: {
                        duration: e.session.audioRemote.currentTime,
                        in: e.attributes.direction === "in",
                    }
                }));
                console.log("call:ended handled from injected", e)
            });
        } catch {
            listenTube();
        }
    }, 200)
}

listenTube();


//TODO: Получать скрипт через перехват запросов

// (function() {
//     const originalXhrSend = XMLHttpRequest.prototype.send;
//
//     XMLHttpRequest.prototype.send = function(body) {
//         this.addEventListener('load', function() {
//             if (!this.responseURL.includes("/calls"))
//                 return;
//
//             try {
//                 if (this.responseText && document.getElementsByTagName("iframe").length === 0) {
//                     const homepage = JSON.parse(this.responseText)["data"]["lead"]["contacts"][0]["homepage"];
//                     // loadScenario(homepage)
//                 }
//             } catch {}
//         });
//         return originalXhrSend.apply(this, arguments);
//     };
// })();