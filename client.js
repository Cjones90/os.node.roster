"use strict";

const WebSocket = require("ws");
const url = require("url");

let ws;
let room = "";
let name = "";
let port = "";
let env = "";
let isInternal = "";
let keepAliveCheck = null;
let retries = 0;

let callbacks = {
    open: () => {},
    close: () => {},
    error: () => {},
    message: () => {},
    evt: () => {}
}

const SECOND = 1000;
const CHECK_SERVER_IN_SECONDS = (15 * SECOND);


// ============================ Public API ===============
// ============================ Public API ===============
exports.connect = function(conUrl) {
    if(!conUrl) {
        return console.log("Roster: Please specify a WS location to connect to with options.")
    }
    room = conUrl
    let query = url.parse(conUrl, true).query
    name = query.n || "Default#"+(Math.random()*1000).toFixed(0)
    port = query.p || "0000"
    env = query.e || "dev"
    isInternal = query.i || false
    establishSignal();
}
exports.on = function(type, callback) {
    callbacks[type] = callback;
}
exports.rm = function(type) {
    callbacks[type] && (callbacks[type] = () => {});
}
exports.close = function() {
    clearCallbacks();
    ws.close();
    ws.onopen = null;
    ws.onmessage = null;
    ws.onclose = null;
    ws.onerror = null;
}
exports.clearCallbacks = function() {
    for(let type in callbacks) {
        callbacks[type] = () => {};
    }
}

// ======================= Init ===============
// ======================= Init ===============
function establishSignal () {
    ws = new WebSocket(room);
    ws.onopen = handleWsOpen;
    ws.onmessage = handleWsMessage;
    ws.onclose = handleWsClose;
    ws.onerror = handleWsError;
}

// ======================= Utility ===============
// ======================= Utility ===============
function checkIfServerAlive () {
    keepAliveCheck = null;
    establishSignal();
}
// ======================= WebSocket Listeners ===============
// ======================= WebSocket Listeners ===============
function handleWsOpen() {
    retries = 0;
    callbacks["open"]()
    let info = {
        name: name,
        port: port,
        env: env,
        isInternal: isInternal
    }
    send("connection", info)
};
function handleWsMessage(evt){
    let parsed = JSON.parse(evt.data)
    parsed.type === "ping" && send("pong")
}
function handleWsClose (evt) {
    // We want to trigger reconnect on close event, but headless doesn't
    // re-trigger the close event when there's an error like the browser does.
    // So we check if it was already triggered from handleWsError
    if(!keepAliveCheck) {
        keepAliveCheck = setTimeout(checkIfServerAlive, (CHECK_SERVER_IN_SECONDS * ++retries));
    }
}
function handleWsError (err) {
    keepAliveCheck = setTimeout(checkIfServerAlive, (CHECK_SERVER_IN_SECONDS * ++retries));
    console.log("WS connection error. Retrying in "+(CHECK_SERVER_IN_SECONDS * retries / 1000)+" seconds");
}


// TODO: Here we should use some kind of allpurpose method to send
//  exactly what we need to the server in order for the api call to bal"

// For now, we're using it to send the basic info we need
function send(type, json) {
    let msg = { type: type }
    if(typeof(json) === "object") {
        for(let prop in json) { msg[prop] = json[prop] }
    }
    ws.send(JSON.stringify(msg))
}
