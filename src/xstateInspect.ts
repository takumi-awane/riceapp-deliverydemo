import {
    interpret,
    Observer,
    Interpreter,
    ActorRef,
    EventData,
    EventObject,
    AnyInterpreter,
    toObserver,
    toSCXMLEvent,
    toEventObject,
    XStateDevInterface
} from "xstate";

import { Inspector, ServiceListener } from "@xstate/inspect";
import { createInspectMachine, InspectMachineEvent } from "@xstate/inspect/lib/inspectMachine.js";
import { stringifyMachine, stringifyState } from "@xstate/inspect/lib/serialize.js";
import { stringify } from "@xstate/inspect/lib/utils.js";

import IO from "socket.io-client";

const serviceMap = new Map<string, Interpreter<any>>();
const patchedInterpreters = new Set<AnyInterpreter>();

function createDevTools(): XStateDevInterface {
    const services = new Set<Interpreter<any>>();
    const serviceListeners = new Set<ServiceListener>();
  
    return {
        services,
        register: (service) => {
            services.add(service);
            serviceMap.set(service.sessionId, service);
            serviceListeners.forEach((listener) => listener(service));
            service.onStop(() => {
                services.delete(service);
                serviceMap.delete(service.sessionId);
            });
        },
        unregister: (service) => {
            services.delete(service);
            serviceMap.delete(service.sessionId);
        },
        onRegister: (listener) => {
            serviceListeners.add(listener);
            services.forEach((service) => listener(service));
            return { unsubscribe: () => serviceListeners.delete(listener) };
        }
    };
}

export default function inspect(baseUrl: string): Inspector {
    const wsUrl = new URL(baseUrl);
    wsUrl.protocol = "ws";
    const io = IO(wsUrl.toString(), { transports: ["websocket"] });

    const devTools = createDevTools();
    globalThis.__xstate__ = devTools;

    const inspectMachine = createInspectMachine();
    const inspectService = interpret(inspectMachine).start();
    const listeners = new Set<Observer<any>>();
    const sub = inspectService.subscribe((state) => {
        listeners.forEach((listener) => listener.next(state));
    });
    
    let client: Pick<ActorRef<any>, 'send'>;
    function messageHandler(msg: string) {
        const event = JSON.parse(msg) as InspectMachineEvent;
        if(event.type === "xstate.inspecting") {
            if(!client) client = {
                send: (e) => {
                    io.emit("xstate.insp", stringify(e));
                }
            };
            event.client = client
        }
        inspectService.send(event);
    }

    io.on("xstate.recv", messageHandler);

    devTools.onRegister((service) => {
        const state = service.state || service.initialState;
        inspectService.send({
            type: 'service.register',
            machine: stringifyMachine(service.machine),
            state: stringifyState(state),
            sessionId: service.sessionId,
            id: service.id,
            parent: service.parent?.sessionId
        });
    
        inspectService.send({
            type: 'service.event',
            event: stringify(state._event),
            sessionId: service.sessionId
        });
    
        if (!patchedInterpreters.has(service)) {
            patchedInterpreters.add(service);
    
            // monkey-patch service.send so that we know when an event was sent
            // to a service *before* it is processed, since other events might occur
            // while the sent one is being processed, which throws the order off
            const originalSend = service.send.bind(service);
    
            service.send = function inspectSend(event: EventObject, payload?: EventData) {
                inspectService.send({
                    type: 'service.event',
                    event: stringify(
                        toSCXMLEvent(toEventObject(event as EventObject, payload))
                    ),
                    sessionId: service.sessionId
                });
                return originalSend(event, payload);
            };
        }
    
        service.subscribe((state) => {
            // filter out synchronous notification from within `.start()` call
            // when the `service.state` has not yet been assigned
            if (state === undefined) return;
            inspectService.send({
                type: 'service.state',
                // TODO: investigate usage of structuredClone in browsers if available
                state: stringifyState(state),
                sessionId: service.sessionId
            });
        });
    
        service.onStop(() => {
            inspectService.send({ type: 'service.stop', sessionId: service.sessionId });
        });
    });

    return {
        send(event) {
            inspectService.send(event);
        },
        subscribe(next, onError = undefined, onComplete = undefined) {
            const observer = toObserver(next, onError, onComplete);
            listeners.add(observer);
            observer.next(inspectService.state);
            return { unsubscribe: () => listeners.delete(observer) };
        },
        disconnect() {
            inspectService.send("disconnect");
            io.off("xstate.recv", messageHandler);
            sub.unsubscribe();
        }
    } as any;
}