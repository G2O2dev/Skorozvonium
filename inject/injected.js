function listenTube() {
    setTimeout(() => {
        try {
            Tube.Phone.on("call:ended", (e) => {
                window.dispatchEvent(new CustomEvent("skorozvonium:call-ended", {
                    detail: {
                        duration: e.session.audioRemote.currentTime,
                        in: e.attributes.direction === "in",
                    }
                }));
            });
        } catch {
            listenTube();
        }
    }, 200)
}

listenTube();

window.addEventListener("skorozvonium:call", () => {
    document.querySelector(".call-wrapper").__vue__.makeCall();
});