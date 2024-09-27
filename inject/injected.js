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