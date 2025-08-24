import { EventEmitter } from "eventemitter3"

// app/auth/events.ts
export const authEvents = new EventEmitter()
// elsewhere: authEvents.on("logout", () => { /* navigate to Login */ })
