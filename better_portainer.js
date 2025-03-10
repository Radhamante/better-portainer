// ==UserScript==
// @name         BETTER PORTAINER
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Improve Portainer UI and functionality
// @author       Radhamante
// @match        http://localhost:9000/
// @match        https://portainer.radhamante.fr/
// @icon         https://vectochronix.io/docker/29d4ee6d4a5c786588a7.svg
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @require      https://raw.githubusercontent.com/Radhamante/better-portainer/refs/heads/main/better_portainer.js
// ==/UserScript==


// TESTED FOR Community Edition 2.21.4

(function () {
    "use strict";

    let token = null;

    const icon = `<svg class="tamper-restart" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg>`;

    // Function to create a restart button inside quick actions list
    function createButton(quickActions) {
        quickActions.forEach(action => {
            if (action.querySelector(".tamper-restart")) return;

            const button = document.createElement("span");
            button.innerHTML = icon;
            button.style.cursor = "pointer";
            button.style.color = "#337ab7";

            button.addEventListener("click", async () => {
                const containerId = extractContainerId(action);
                if (!containerId || !token) {
                    console.error("TAMPER ::: Unable to retrieve container ID or CSRF token");
                    return;
                }

                button.firstElementChild.classList.add("tamper-loading");
                try {
                    await fetch(`${window.location.href.split("#!")[0]}api/endpoints/2/docker/v1.41/containers/${containerId}/restart`, {
                        method: "POST",
                        headers: { "x-csrf-token": token }
                    });
                } catch (err) {
                    console.error("TAMPER ::: Error during restart", err);
                } finally {
                    button.firstElementChild.classList.remove("tamper-loading");
                }
            });

            action.append(button);
        });
    }

    // Function to extract the container ID from the "Attach Console" link
    function extractContainerId(action) {
        const siblingLink = action.parentElement.querySelector('a[title="Attach Console"]');
        if (!siblingLink) return null;
        const match = siblingLink.href.match(/\/containers\/([a-f0-9]{64})\/attach/);
        return match ? match[1] : null;
    }

    function injectStyles() {
        const styles = `
            tr .lt-selection input, .md-checkbox label::before, .md-checkbox input {
                width: 25px !important;
                height: 25px !important;
            }
            .widget .widget-body table tbody * {
                font-size: 13px;
            }
            .md-checkbox input[type=checkbox]:checked + label::before {
                background-image: url("https://icon.icepanel.io/Technology/svg/Portainer.svg");
                background-color: #0b4a6f !important;
                background-position: center;
                background-size: cover;
                width: 25px;
                height: 25px;
            }
            .md-checkbox input[type=checkbox]:checked+label:after {
                border-style: none none none none !important
            }
            .app-react-docker-containers-components-ContainerQuickActions-ContainerQuickActions-module__root svg {
                font-size: 18px !important;
            }
            @keyframes tamper-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .tamper-loading {
                animation: tamper-spin 1s linear infinite;
            }
        `;
        const styleSheet = document.createElement("style");
        styleSheet.textContent = styles;
        document.head.append(styleSheet);
    }

    // Function to observe UI changes and add restart buttons
    // Each time the body changes, try to retrieve all the lists of quick actions and then try to add the restart button to each list.
    // The case where the button already exists is handled by createButton.
    function observeElements() {
        const observer = new MutationObserver(() => {
            const quickActions = document.querySelectorAll(".app-react-docker-containers-components-ContainerQuickActions-ContainerQuickActions-module__root, .app-docker-components-container-quick-actions-ContainerQuickActions-module__root");
            if (quickActions.length) {
                createButton(quickActions)
            };
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Add resart button in logs page
    function observeLogs() {
        const urlParts = window.location.href.split("/");
        // If in the right page
        if (urlParts[urlParts.length - 1] === "logs") {
            // Use Obsever to display the button as fast as possible
            const observer = new MutationObserver(() => {
                // Use multiple “ifs” to avoid unnecessary actions
                if (!document.querySelector(".tamper-restart")) {
                    const buttonParent = document.querySelector('.btn[ng-click="$ctrl.clearSelection()"]')?.parentElement
                    if (buttonParent) {
                        const restartBtn = document.createElement("button");
                        restartBtn.innerHTML = icon + " Restart";
                        restartBtn.classList.add("btn", "btn-primary", "btn-sm");
                        restartBtn.addEventListener("click", async () => {
                            if (!token) {
                                console.error("TAMPER ::: Token CSRF introuvable !");
                                return;
                            }
                            restartBtn.firstElementChild.classList.add("tamper-loading");
                            try {
                                await fetch(`${window.location.href.split("#!")[0]}api/endpoints/2/docker/v1.41/containers/${urlParts[urlParts.length - 2]}/restart`, {
                                    method: "POST",
                                    headers: { "x-csrf-token": token }
                                });
                            } catch (err) {
                                console.error("TAMPER ::: Error during restart", err);
                            } finally {
                                restartBtn.firstElementChild.classList.remove("tamper-loading");
                            }
                        });
                        buttonParent.append(restartBtn);
                    }

                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    //Overrides the default XMLHttpRequest setRequestHeader method to capture the CSRF token.
    //When an HTTP request is made with an "X-CSRF-Token" header, this function intercepts it,
    // extracts the token value, and logs it to the console.
    // This allows the token to be retrieved dynamically during API requests.
    function captureToken() {
        const origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
        XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
            if (!token && name.toLowerCase() === "x-csrf-token") {
                token = value;
                console.log("TAMPER ::: CSRF token caught :", token);
            }
            return origSetRequestHeader.apply(this, arguments);
        };
    }

    function enableLogToggle() {
        document.body.addEventListener("keyup", (e) => {
            if (e.key === " " || e.code === "Space" || e.keyCode === 32) {
                document.querySelector("log-viewer .switch input")?.click();
            }
        });
    }

    async function verifyPortainerVersion() {
        try {
            const res = await fetch("/api/system/status")
            const json = await res.json()
            if (json.Version != "2.21.4") {
                console.warn(`TAMPER ::: Better Portainer is not tested on this version. Some features may not work. Please use version 2.21.4 (current version : ${json.Version})`)
            }
        }catch (err) {
            console.error("TAMPER ::: fail to get current version", err);
        }
    }

    // Initialisation du script
    verifyPortainerVersion();
    injectStyles();
    observeElements();
    observeLogs();
    captureToken();
    enableLogToggle();
})();
