import { assign } from "xstate";
import { createModel } from "xstate/lib/model.js";
import { escalate, sendParent, raise } from "xstate/lib/actions.js";
import { createActorContext } from "@xstate/react";
import axios from "axios";
import { catchError, interval, switchMap, EMPTY, map } from "rxjs";
import { fromFetch } from "rxjs/fetch";
import { nanoid } from "nanoid";
import { E164Number } from "libphonenumber-js";
import { DateTime } from "luxon";

import riceOsInspect from "./xstateInspect.ts";
import { timeout } from "./util.ts";
import { SoundEffect, playSoundEffect } from "./helper/sfx.ts";
import Scheduler from "./helper/scheduler.ts";
import i18n from "./i18n.ts";

export const screenWidth = 1024;
export const screenHeight = 600;
export const v4ScreenOffset = [30, 0, 0, 15];

const RiceAppAPI = axios.create({ baseURL: `${import.meta.env.VITE_ROBOT_URL}` });

// Initialize RiceOS XState inspector
riceOsInspect(import.meta.env.VITE_ROBOT_URL);

const initCtx = {
    devMode: import.meta.env.DEV,
    debugMode: new URLSearchParams(location.search).has("debugMode"),
    info: null as {
        site: {
            id: string;
            locale: string; // e.g. en-HK
            map: {
                height: number; // m
                width: number; // m
                resolution: number; // m/px, usually 0.05
                points: {
                    [id: string]: {
                        coord: [number, number]; // x, y
                        name?: string;
                        waypoint?: {
                            theta: number; // deg
                            home?: {
                                schedule?: Array<{
                                    startTime: [number, number]; // hr, min
                                    repetition: number;
                                    weekdays: number; // bitfield: 0b Su Sa F Th W Tu M
                                    disinfection?: {
                                        pathId: string;
                                    };
                                    dt?: DateTime;
                                }>;
                            };
                            charger?: boolean;
                            elevator?: {
                                integrationId: string;
                                car?: string;
                                boarding?: string;
                                lobby?: boolean;
                            };
                            delivery?: {
                                destination: boolean;
                            };
                        };
                    };
                };
                regions: {
                    [id: string]: {
                        geometry: [number, number][]; // x, y
                        name?: string;
                        floor?: {};
                        gate?: {
                            integrationId: string;
                            terminal: string;
                        };
                    };
                };
                paths: {
                    [id: string]: {
                        geometry: [number, number][]; // x, y
                        name?: string;
                    };
                };
            };
        };
        robot: {
            id: string;
            type: "rice" | "jasmine" | "chat" | "patrol";
            name?: string;
            riceOs: string;
            timezone: string;
            debugMode: boolean;
        };
        params: {
            password?: string;
            integrationTest?: boolean;
            navTimeoutIntegrationTest: number;
            navTimeoutNavigation: number;
            navTimeoutDeliver: number;
            navTimeoutReturn: number;
            idleTimeoutStandby: number;
            idleTimeoutItemPlace: number;
            idleTimeoutItemCollect: number;
            idleTimeoutWaitReciepient: number;
            minBatteryWakeup: number;
            minBatteryDisinfection: number;
        };
    },
    status: null as {
        charge: number; // %
        charging: boolean;
        lid: "open" | "close" | "opening" | "closing";
        eBrake: "release" | "latch" | "freewheel";
        lost: boolean;
        online: boolean;
        fluidLevel: {
            low: boolean;
            high: boolean;
            value: number;
        };
        position: {
            x: number;
            y: number;
            theta: number;
        };
        motorShutdown: boolean;
        currentGoal?: string;
        recordVideo: { [source: string]: boolean; };
        navigationState:
        | "init"
        | "idle"
        | "mapping"
        | "parking"
        | "parked"
        | "unparking"
        | "active"
        | "goalCancelling"
        | "delocalized"
        | "relocalizing"
        | "fault";
        waypointLastUpdate: number; // opaque timestamp
        currentFloor: {
            boundBox: [number, number][]; // x, y
            name?: string;
        };
    },
    homePoint: null as string, // waypoint ID
    chargerPoint: null as string, // waypoint ID
    mission: null as {
        id: string;
        type: "delivery" | "disinfection";
        state: "start" | "code" | "return" | "end" | "error" | "move" | "skip";
        meta?: {
            from?: string; // delivery(move)
            to?: string; // delivery(move)
            phoneNumber?: E164Number;
            pathId?: string; // disinfection(start/skip),
            repetition?: number; // disinfection(start/skip)
        }
    },
    tickRemain: 0, // timeout timer
    delivPassword: null as string,
    integrationTestPathId: null as string,
    integrationTestEnabledTests: null as Set<number>,
    nextCoordIdx: null as number,
    scheduler: null as Scheduler,
    mapImage: null as Blob,
    parkAttempts: 0 as number,
    parkSuccesses: 0 as number
};

export type Schedule = typeof initCtx.info.site.map.points.id.waypoint.home.schedule[number];
export type Point = typeof initCtx.info.site.map.points.id;

export const StateModel = createModel(initCtx, {
    events: {
        statusUpdate: (status: typeof initCtx.status) => ({ status }),
        passcodeEntered: () => ({}),
        initPosConfirmed: (homePoint: typeof initCtx.homePoint, chargerPoint: typeof initCtx.chargerPoint) => ({ homePoint, chargerPoint }),
        sendMission: (missionState: typeof initCtx.mission.state = null, meta?: typeof initCtx.mission.meta, api: boolean = true) => ({ missionState, meta, api }),
        navError: () => ({}),
        tick: () => ({}),
        setTickRemain: (value: number) => ({ value }),

        // delivery events
        startDelivery: () => ({}),
        back: () => ({}),
        itemPlaced: () => ({}),
        recipientConfigured: (meta: typeof initCtx.mission.meta) => ({ meta }),
        detailsConfirmed: () => ({}),
        recipientInteracted: () => ({}),
        itemCollected: () => ({}),
        clear: () => ({}),

        //disinfection events
        startDisinfection: (idx: number) => ({ idx }),
        quickStartDisinfection: (pathId: string) => ({ pathId }),
        toRefill: () => ({}),
        toOpenLid: () => ({}),
        toNavi: () => ({}),
        filled: () => ({}), // refill
        closed: () => ({}), // refill
        pause: () => ({}),
        resume: () => ({}),

        //charging events
        toCharging: () => ({}),
        wake: () => ({}),
        lidFire: () => ({}),
        eBrakeFire: () => ({}),
        parkFire: () => ({}),

        //integration test events
        beginTest: (tests: Set<number>, pathId: string) => ({ tests, pathId }),
    },
});

const navigationCtx = {
    waypoint: null as string | [number, number, number],
    maxRetry: Infinity, // times
    timeout: Infinity, // seconds
    /// Map data
    map: null as typeof initCtx.info.site.map,
    currentPosition: null as typeof initCtx.status.position,
    boundBox: null as typeof initCtx.status.currentFloor.boundBox,
    /// Internal states
    tryCount: 0,
    startTime: 0,
    currentFloor: null as { id: string, name: string, meta: object },
    targetFloor: null as { id: string, name: string, meta: object },
    integrationId: null as string,
    car: null as string,
};

async function moveToPoint(
    waypoint: string | [number, number, number],
    ignoreOrientation: boolean,
    profile: "normal" | "narrow" | "slow" | "depthCameraInterference" = "normal"
) {
    try {
        const resp = await RiceAppAPI.post("/api/nav/goal", { waypoint, profile, ignoreOrientation });
        return resp.data.message;
    } catch (err) {
        console.error("[api] navGoal", err);
        await playSoundEffect(SoundEffect.horn);
        await timeout(5000);
        throw (err);
    }
}

async function computeFloor(p: [number, number]) {
    const res = await RiceAppAPI.post("/api/compute-floor", { coordinate: p });
    return res.data;
}

export function checkIsSameFloor(position: [number, number], floorBound: typeof initCtx.status.currentFloor.boundBox) {
    const [bottomLeft, topLeft, topRight, bottomRight] = floorBound;
    const res = (
        bottomLeft[0] < position[0] &&
        bottomLeft[1] < position[1] &&
        topLeft[0] < position[0] &&
        position[1] < topLeft[1] &&
        position[0] < topRight[0] &&
        position[1] < topRight[1] &&
        position[0] < bottomRight[0] &&
        bottomRight[1] < position[1]
    );
    return res;
}

async function waitForElevator(elevatorId: string, integrationId: string, type: "enter" | "exit") {
    while (true) {
        try {
            const resp = await RiceAppAPI.post("/api/elevator/state", {
                integration: integrationId,
                car: elevatorId
            });
            const elevatorStatus = resp.data;
            // elevator is no longer allocated to robot
            if ((elevatorId in elevatorStatus) === false) {
                return;
            }
            console.log("[elevatorState]", elevatorStatus[elevatorId].state);
            if (type === "enter" && elevatorStatus[elevatorId].state === "boarding" || type === "exit" && elevatorStatus[elevatorId].state === "alighting") {
                return elevatorId;
            }
        } catch (error) {
            console.error(error);
        } finally {
            await timeout(1000);
        }
    }
}

async function setPosition(waypoint: string) {
    while (true) try {
        await RiceAppAPI.post("/api/nav/position", { waypoint: waypoint });
        return;
    } catch (err) {
        console.warn("[api] nav/position", err);
        await timeout(1000);
    }
}

async function lidAsync(lid: string) {
    while (true) try {
        await playSoundEffect(SoundEffect.lid);
        await RiceAppAPI.post("/api/lid", { lid: lid });
        return;
    } catch (err) {
        console.warn("[api] lid", err);
        await timeout(1000);
    }
}

const NavigationModel = createModel(navigationCtx, {
    events: {
        openDoor: () => ({}),
    }
});

// Invoked during navigation
// https://xstate.js.org/docs/guides/communication.html#invoking-machines
const NavigationMachine = NavigationModel.createMachine({
    id: "navigation",
    predictableActionArguments: true,
    preserveActionOrder: true,
    context: navigationCtx,
    initial: "init",
    states: {
        init: {
            entry: NavigationModel.assign({
                startTime: () => Date.now(),
                timeout: (ctx) => ctx.timeout || Infinity,
                tryCount: () => 0,
                maxRetry: (ctx) => ctx.maxRetry || Infinity,

            }),
            always: [
                {
                    target: "takeElevator",
                    cond: (ctx, e) => {
                        const coord: [number, number] = typeof ctx.waypoint === "string" ?
                            ctx.map.points[ctx.waypoint].coord :
                            [ctx.waypoint[0], ctx.waypoint[1]];
                        return !checkIsSameFloor(coord, ctx.boundBox);
                    }
                },
                { target: "navigating" }
            ]
        },
        navigating: {
            entry: NavigationModel.assign({ tryCount: (ctx, e) => ctx.tryCount + 1 }),
            invoke: {
                src: "navGoal",
                onDone: { target: "finished" },
                onError: [
                    { // Escalate error if timeout or max retry reached
                        actions: [
                            "sendBlockedAlert",
                            escalate({ error: "Navigation failure" })
                        ],
                        cond: (ctx, e) =>
                            ctx.tryCount >= ctx.maxRetry ||
                            (Date.now() - ctx.startTime) > (ctx.timeout * 1000)
                    },
                    { target: "navigating", actions: sendParent('navError') }
                ]
            }
        },
        // TODO: Reject if car in current floor doesn't go to target floor
        // TODO: error handling
        takeElevator: {
            initial: "init",
            on: { openDoor: { actions: "fireDoor" } },
            states: {
                init: {
                    invoke: {
                        src: "getFloor",
                        onDone: { actions: assign((ctx, e) => ({ currentFloor: e.data[0], targetFloor: e.data[1] })), target: "toLobby" }
                    }
                },
                toLobby: {
                    invoke: {
                        src: "moveToLobby",
                        onDone: { target: "dispatching", actions: assign({ integrationId: (_, e) => e.data }) },
                        onError: "toLobby"
                    }
                },
                dispatching: {
                    invoke: {
                        src: "dispatchCar",
                        onDone: { actions: assign((ctx, e) => ({ car: e.data.car })), target: "waiting" }
                    }
                },
                waiting: {
                    invoke: [{
                        src: "waitForCar",
                        onDone: "boarding",
                        onError: "dispatching"
                    }, {
                        src: "holdDoor"
                    }]
                },
                boarding: {
                    invoke: [{
                        src: "boardCar",
                        onDone: "riding",
                        onError: "boarding"
                    }, {
                        src: "holdDoor"
                    }]
                },
                riding: {
                    invoke: {
                        src: "waitRiding",
                        onDone: "alighting"
                    }
                },
                alighting: {
                    invoke: [{
                        src: "alightCar",
                        onDone: "completed",
                        onError: "alighting"
                    }, {
                        src: "holdDoor"
                    }]
                },
                completed: { entry: "closeDoor", type: "final" }
            },
            onDone: { target: "navigating" }
        },
        finished: { type: "final" },
    }
}, {
    services: {
        navGoal: async (ctx) => {
            let ignoreOrientation = Array.isArray(ctx.waypoint) && ctx.waypoint[2] < 0;
            await moveToPoint(ctx.waypoint, ignoreOrientation);
        },
        getFloor: async (ctx, e) => {
            const currentPos: [number, number] = [ctx.currentPosition.x, ctx.currentPosition.y];
            const targetPos: [number, number] = typeof ctx.waypoint === "string" ?
                ctx.map.points[ctx.waypoint].coord :
                [ctx.waypoint[0], ctx.waypoint[1]]
            const data = await Promise.all([computeFloor(currentPos), computeFloor(targetPos)]);
            return data;
        },
        moveToLobby: async (ctx, e) => {
            const elevatorLobby = Object.entries(ctx.map.points).filter(([id, point]) =>
                point.waypoint.elevator?.lobby &&
                checkIsSameFloor(point.coord, ctx.boundBox))[0];
            const [lobbyId, lobbyPoint] = elevatorLobby;
            await moveToPoint(lobbyId, false);
            const integrationId = lobbyPoint.waypoint.elevator.integrationId;
            return integrationId;
        },
        dispatchCar: async (ctx, e) => {
            console.log('[elevator] dispatch')
            while (true) {
                try {
                    const res = await RiceAppAPI.post('/api/elevator/command', {
                        integration: ctx.integrationId,
                        command: "dispatch",
                        boardingZone: ctx.currentFloor.name,
                        alightingZone: ctx.targetFloor.name,
                        rpcTimeout: 20 * 1000
                    });
                    return res.data;
                } catch (err) {
                    console.error("dispatchCar failed", err);
                    await timeout(5000);
                }
            }
        },
        waitForCar: async (ctx, e) => {
            const boardingZone = Object.entries(ctx.map.points).filter(([id, point]) =>
                point.waypoint.elevator?.boarding === ctx.car &&
                point.waypoint.elevator?.integrationId === ctx.integrationId &&
                checkIsSameFloor(point.coord, ctx.boundBox))[0];
            const [boardingId, boardingPoint] = boardingZone;
            await moveToPoint(boardingId, false);
            const car = await waitForElevator(ctx.car, ctx.integrationId, "enter");
            if (car) {
                console.log("[takeElevator] now boarding");
                return "success"
            } else {
                const err = new Error("elevator is no longer allocated to robot");
                throw (err);
            }
        },
        holdDoor: (ctx, e) => (callback) => {
            const holdId = setInterval(() => callback('openDoor'), 1000);
            return () => clearInterval(holdId);
        },
        boardCar: async (ctx, e) => {
            const carFrom = Object.entries(ctx.map.points).filter(([id, point]) =>
                point.waypoint.elevator?.car === ctx.car &&
                point.waypoint.elevator?.integrationId === ctx.integrationId &&
                checkIsSameFloor(point.coord, ctx.boundBox))[0];
            const [carId, carPoint] = carFrom;
            await moveToPoint(carId, false, "narrow");
            console.log('[takeElevator] moved to car');

            await RiceAppAPI.post("/api/elevator/command", {
                integration: ctx.integrationId,
                command: "call",
                car: ctx.car,
                boardingZone: ctx.currentFloor.name,
                alightingZone: ctx.targetFloor.name,
            });
            console.log('[boardCar] called elevator for dest');
        },
        waitRiding: async (ctx, e) => {
            const boundBoxTarget = ctx.map.regions[ctx.targetFloor.id].geometry;
            const carTarget = Object.entries(ctx.map.points).filter(([id, point]) =>
                point.waypoint.elevator?.car === ctx.car &&
                point.waypoint.elevator?.integrationId === ctx.integrationId &&
                checkIsSameFloor(point.coord, boundBoxTarget))[0];
            const [carId, carPoint] = carTarget;
            await setPosition(carId);
            await waitForElevator(ctx.car, ctx.integrationId, "exit");
            return;
        },
        alightCar: async (ctx, e) => {
            const alightingZone = Object.entries(ctx.map.points).filter(([id, point]) =>
                point.waypoint.elevator?.boarding === ctx.car &&
                point.waypoint.elevator?.integrationId === ctx.integrationId &&
                checkIsSameFloor(point.coord, ctx.map.regions[ctx.targetFloor.id].geometry))[0];
            const [alightingId, alightingPoint] = alightingZone;
            await moveToPoint(alightingId, false, "narrow");
        }
    }, actions: {
        sendBlockedAlert: () => {
            try {
                RiceAppAPI.post("/api/alert", {
                    alarmType: "nav-blocked",
                    message: ""
                })
            } catch (err) {
                console.error(err);
            }
        },
        fireDoor: (ctx, e) => {
            try {
                RiceAppAPI.post("/api/elevator/command", {
                    integration: ctx.integrationId,
                    command: "open",
                    car: ctx.car
                });
            } catch (err) {
                console.error("fireDoor failed", err);
                throw err;
            }

        },
        closeDoor: (ctx, e) => {
            try {
                RiceAppAPI.post("/api/elevator/command", {
                    integration: ctx.integrationId,
                    command: "close",
                    car: ctx.car
                });
            } catch (err) {
                console.error("closeDoor failed", err);
                throw err;
            }
        }

    },
});

export const StateMachine = StateModel.createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5RQDYHsBGBDFBiWALlgQK6wCqADhMWANoAMAuoqJWrAJYGdoB2rEAA9EAJgAcDAMwA6AGyiArNIDsARgCcU0RvFSANCACeiNQxUyNi7QBYV56WqUBfZ4dSYc+MHwgBZTlgufkYWJBB2Lh5+QREECQZReQYNGydNbV0DY1NRV3d0bDxYMAIAFU4AYwBrACUwAFssTj5QwUjuXgFwuNEVDQ0ZNLTExUUbbTVskwQ5OYtzMfG5Bjl0-JAPItweGrbwjuju0DjxFUMZ7UUklX7JdQkNcw2tr13qujUwtg5OmJ7THYLogbBodDJElI1GprlIJio5C9Cm8qh9RN8Ir8jrFEGdgfFJGoZOI1HIbDZxIo5LcUjYkZ48O86FIMYcujiEHicggbHJZE95ipRLyUlIVIp6dsmTZWVj2QCEDDztyKSpxDJYQxxpowXk3JtkYzUXRFLKovKTmI1USBqI7eLxpNpog5Ip1DInKIpIspIpJOJJV4UJwIAAxTgAJ3ozHacv+loJEnkaiFUKkcieanEcnxZPFHozqwYvPGGkR+teeDAACEI1hqmBw1H9j9zfHhGISTYPWdrF2M0LlTM+f0ZKIYSSpFIrFmpIG8JQsBHqk3o2a-sduQBaJSyRSGOKpKTq1Ku+yiFZZiUVw0yFrcXAQfhgO98ABuaAbMkrr+4CBaH6VMQXShC2mJtpuvR+mO+7clmZxDCooLUlYroTPOMg+AQYARgAClgQSVGgEBgLgi6EcRYAAKJ8NhUYQGBbLtnEboMDI9hpmS5IpFm+KaOOlgJGCqGOhhRF8AAZpGDS4XGfCPs+MiELQ363uJUkRjJcmMXJHKiAwWoeqKGhquIJJ6DmcESES4riF6JkiloAY3gyMjqdJskQQpfAvsp2Gqa57maZ5G6fOu2IKjqihGVoJlmeZ6Z8WWgyUroWh3HZJJifwGlaRBv4ELg94EJ5ADCOXSZAOkQRyGhmBCMJkuOcxTLcSVZhqZk6KCdl1Yk2WSR5ckyGgb44RGIYtFA3kvgBn4vj+QV5RuI1jRGE0QFN-7vmgQFHKBMYHLpkVTmxijpWqayJDosEzJoNhJF2JlWNYdp9ANuUhUcMgEVwUB8AAypUAAWkAkCgOG4NVG4cimMINVSigpokZkpElD3EmooL9GM2j2hhLTYVAdZHGUcAEAVuAYGAUAtGThDQxFCbCgJTjKLYwpgnI4j4lzPYMCmboki4LlFK+RMk109MUxGJB8AAgigKAAOpYEY7CE7AM1KUQ-k-oTNOS-w0syLLCtK6r6toJrjMWh2CDTtzEK8loaR9Pcll3dI3b9M1SP6eSOgE7RhvAcb5Om3Lisq2rGu0bAd4QBDUOHa2MMKn06byDYqyulqEzjs6nJgpYqwImcuiZWowcS2HfAm2b0eW3HBAJyGydhbGNUZyoWdkrnyiOoXfEMAhZhZH0fLUpoNeh6TEeNxbsfW-HMh8Fgb6cFAwF8NNT4+a+H5fvrIfE3XDdR0vVua2vG9bzvUDbYBddhbbzGIFOvIyGKg9CgH50j2zN-c62ZtDC2vAUVyBsz7z0IJHc2Mdr6r3XpvbePBd7azmsfW80Cjb1wXpfRBLcE4oPvugx+c09ogS+J3I63dmbiFSEMcQ5JSRllJEORAVg2ICnLhlays8YFSwjouZc8tfClWBkuGA2s-ILRwafPBJtRHVHERASR0i1xd3TgmKcTDrQ3VuFPThipubRRWCZdQQpKSNUEUokRS5VESKkRGGAicO6p3Ajo+2wo5geiUNIFmoILw8zgncGKl1dC92LCoOx58HFiOcZo9xpFaFpyZj43kch-HsyCVzUJd1uZJHJFCLUqwswUg0HE2BFMVFqI0a4l8T4ahTUwTtbBUDFHxLgXUpJjSZDNOqFtShL9mBv0glaBCBizJYwHH0Pi1J1THjxuSM43o7DVOET0xx9SXFuMGa08aaAIwyEoCgYgEljkNACmLXB3Tak7L6fs3aQzd5P12qMpg4y9JklkFjFh6g9D2nGAs6EMUgUInTOoKposcDiznlsh5iT1F7KaS8yAuAhByJ+hJOiAAKZQBkACUuAT61xqacx5KLkmDKqp4piEyHajz3C7NhaxqR8XsESceJJxTFi6s5SBtyukUrQJQHw9T0AlAADIhlkbreRnTyWIpGuKhWEipVgFlQxelx1mZ4xyYkakKMSR8QekkX0liUwSCRlSTZ4c4FiolRqjgWqQwpJTuFO2cR0zQRsNYLMjgoRmBsJyjqGZvSMMkN6csQq4V3NFWqyVrrtUerSV4jJPrXTqn9VCaNUxoTFgWb6IYEwnCBNWMePUcaUDwqEQ6imTr1XqM1am4MEAADyarWn71mu0xVwrlUNtVc6ltKb3Xtq7T4YZO0qEhDGbq+h9sc4GR7OKK6vpGqiGLd2CNMJmV2VJHOWFtaE0qqbcmmV7qSLnKMJi7FWBcU4TxWYAyDASVkoRcOi9Lqr0QAGWAW93yFQPQRBCBQVJqRun0tuuCfJd1aH3XoQ9fJ7X4MdUm39br-3ttKlKntiksEDvjSK89mGx1-pkLh-DbyRn7QXV69+PI-TZKzOuikPVrC3VMPB+QiHlDIeasemtHqCBoCnXwbVwHdG9THI4bM0hbUKHxKs7JvdvRem5qSNIECDRQKTqRMTAA5O+0n7ZVsGPpPNKxN1UlgzMf1oIxynU0ySMkMICYGZ2GgBptNd5mZ9f0NicNYosN0Fx-E6Yv643HGkaEmRPMQxkA0QIwQ+CSLADUT12jM0fxSDm7m-RNDspMWKKYY47haf7vBxLL4UtBC6BlrL6aGUcjFE8D00LpxhcpL6fE7tZDqAzCGgy04PMnpScl1LjXQbNfRDl71eXdBDEK3VdhHLuTHjVBCb0iRFiaHGLVqbDX+BNeqFDFkC2mPemW7yCuxWOGRb0N2RIaVsxuZ00diSzQIYQAACKAc4GtO9lQIZLgCx-NIFgQsSBzm6NYpX1BsVe1Gqrn2JswAIAASWwg0bz9QpJKwh8xz2pgzjdgepIYSiN0IY9KDjxo3mTOb2J-60nio7LZMpykG6aFhN6bFpjhneOxO+amqzqknLtvc+p3zjCQvcfHbS2d7LdDvEzC9EoTGFJUYGR19kXoX9AXinl-TxX9XlezfOy1vVmS1Nse4-EPoFguzxTffr032PzfTdO1bqG821e5fiEbh3-Xnfa7d3rsy-OfwK8aErmbmXreXcD4t4P9vez9eWRH3X-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-oTW6ceQbQJqLEi8U8jF0oC9w949wd7-Eds9z9vd7969yFuNhY8YJIQlaQLUQWNUdQrGH2NilhBSgWVwfUPgSieAcISsJtrcMsfELcNIQYUEAYFhKYB6My7Sk+bgJtrkO6KNQSEkUeccW-atKe1q0wkiJthy5hdA8wO0YsABOCXUIYISXnUSTvUCr6O2VrBUJCWQAWKkKLIm3c+j70CPV0MsFdNUD6IafKYqJtorba5TncxixUVIIkV3XPD3STwaYKYaUacaSaXeJt8eUat9CQK6E1x3TQDqKECkC8MsVj3T+z-KX6LeQGQpiAcGHCVz6wJYwFaGl6PGdqJZf5QL10KcNjxaKT4aUxyoQYoIVzpjmKacUyBKdne6M6XI6z6PNDaWJtu0JGQ1C8c8GZXMakA186d29dN0eriOAzhN3oDTFr41fM3OmYIup97QMrxyY8fruBReIhFeVuRrqkJYnOTTrLvoEFbkB0IYMuPg48f1VIBbmWQhZuFbtuAzRrhHD1rbvGcUUW3EWyt0Bxp08BM7+BJuZeG+XeqaJtjTNLpQPg3QNIIuENA8kBSc4xGeCbM9YdJby7m+WAIZSgQHlGGxkH-ksjouMyQYXhcwKc6FL7pH371eIiJWiGbCQH-6w1aDf+I5uCVK8FCka6XkFpkTBH9DJFJxalRpRrpl0btr01OCWEP1-W1ktw9lz9etHnylZFXzWaG7obsQNw4Xk1CbnjMeFIBKhgsyMYL73pfn55N-KAW7pMMsGKiYR73bwpPkP1pHCNS1Se2X+xbZRX1FVgiARrsEbsIWI9WZHkkxDhbJCxXlZQQNjxhRIdeX43pXl6qnlWwH-SbWuw+Cap7MBZZbVKSQO0Ob6PpVL9OPqlBP1Hxsi3k8QrZD2357xUHGcFdnixeb+H0jb9cjMF7DQH0EIkXNFME7swMkHzo-PjYNX0Quu7L7n9CjbDFJQH+LoYANJCc6Qfr8njHOCJdMJwTR3kKfjv1tFZztO6wHw9McZKPGRn0FYLfjA9ITPf0dTv1NG9NWbjpUZkqkMwWzSroW0frUJpnh7LjH2L4mxp+j-Q-mCwB6q8eQcOe7lGk4x9Y4M9UDIOYEcygZOeU9bniAP37jp-0lPZWjTygF2ByQKFLqDsSzADBi0xSMtPfl9p9BABRfOXlgIf4H9-05fdHlAKrREgyyWgN6IJyZ53R1A5iLQCjARBBYW+XPFXq6wYRD430sBIPoOHpb5gZWqQL0DfSDjw8DMCeX3Enl97IVZBx4eQfMk2x2QLAhdMEDdlYiu8cEmg3vJuFk66JrgdVeTDZiUxX0HYNiBdqSFaje1tAX2H7JADLxBkU+DvMBNam5hlZWiSORltDWxhjBYadOdarhwQJOE7GNjYJBmAGBHoqOt4OPNcgtyJ4agTbBgFnmPz-JauHeETLkIdbV47BtuOIMUKcIig0hkef0gXkVzF5S83FIoZkVvpWc28rQzvIvhc6ECxy93ByPATM4hJZS7zHONZHUpbtN8QwwArvnN5QDB4zpTbuML95mdvQNBZGMuwDQXgxC2BdFD7zWFuxiQ1kAYHRTpZ7lKQrhOwDoFGxeFjhgBDjtlSbaR8G8mwxytsP6xYkNQ4QssCsC4jZDI22pRrrcE3KVUVOkw9MKxhI7FgRwsVLBuCJapBFOOYRCIgQBT40UtyVVYmhriniqlLwMIO1NNWDIWkTihnMFF6HQKpFFSHJHqD6Tig65oMYIsWGJRFInESWx-KAeKCOr0iEKa-Ztl-EPJIQFSCVJqrazNLcjfiYpakhKVWFSDmGKQfGgZEJqmceh2tGIZKLPwLCaaso3UpaV+bKtXO-qJIFjErR6B3SRaL0shTJAOR0gooDAhSPjKhkkyEZX7OaOuJWi+QNohDnaI1zig-k2MKxDalJAGjxK-RY0TyIGJTRFa+AsAK5yM7jh+mTwZJo4y9LjBiQ0NXkrFjOpuj5ymWPyrREa7aYsejgkXlr3iCZCNQCIGVtqAFjvtmq55OzmBTvI3lcR0IsVrCMnwrBv4sWXuBfSQhw19KhneSgKG4iZjUmm2TQLKTLLjAmxkYuGm5QIAeUIwXlJcjiP5HHgDWF4BDlqMeJfwAumYNYFMHUGtipi7w6IiRExo7iVR3BMpvU0Nb5kKuw1PQNyXJAKBzA4QuGuzTmKfCKQnWDPgSNU6UsUglgIFIjCjTxCrxM1V6mtQZqktlRDzRIuZThhVMwJZnIjqYMhquZtM0o2MueQRo8ika94mTnUK4Q0F0oQNQZqDQcx-kyaDVD7ERLlps1EJV1BmhAOGGPjTAN2XjseADEi0VM44SDnMHTDjhKC4gmUXGQAmil2ajWI9kmNc65FARiTDMe9yLgUduwbmOEKi0OZjjuKiY6nsmKgEwZd0vYb0EjAyai9GJ1gZhGkTEndEZeETYRpRK4IfxH2AfEztVTzpegC69lIQjMmsA6ME6g3Pie4IsA+T6KhI6+hGgNYCxIxtwUkGFMoY+NIBkUtUGxDhC1Us6g1GsdYAUCIQdqFTJYK5NyZtM9GGUghhI14loTYYghHbE8BpacNuYaTFKIu39g+D6BnIqqd41Ea+NDGkAWjkmFykNiPaDE6+vYCFbw4smgnNKVE23qJ8VJUAnUEK0bwD1EGRcN7hYCrTu0BgdgAUq0xwYFMrcJ-aKQUVingSEA5U4kIJzFbvYUwXzC5iGCSE4SA0NjM8CZCgLskXpPgGZkf1xbdCVQOzZFvpIpqGSJsILblvVPsH2wGhDmFhGlxRaQz0W5zAGeALNFQDEZIIXQI9DeZoz9CHLDVli0B7pQBao+WBoeTr65TskMrdQFcByJlgMIirHFnM1QnwyfU4WSmfpGpmHT6WwoKVi8Q+xvFWZpM4lrDM5lUSeQo+NhjSxuEa1NsD+aIZSCeFytUR27CWdi1NH-NuOSRANFOCEKfxBZL2Zwq8Rqy9EQ2gvSCdVloq18+IDHHlFYgUBuErBkbENg6z1nmT8i93e2cCjr4YNT6+WdKJXAERWzQ2us8Fo11VDUsUBbUszvOPMT5YYeUKOHiJjHZQAi2702pmZG-gmCyOtwIuV2wLZZyJ24DMyZFNxnO1yqXUg4b4I-a7tL25jRrmKBzQ-xQQK-VYCKP9hqUkO8IQlOgJ-DfYiAKAIyhGGOSNczI3YKzDCC0AOzuQCpOqkqFhChMZyrgIAA */
    id: "global",
    description: "Global state machine",
    predictableActionArguments: true,
    preserveActionOrder: true,
    context: StateModel.initialContext,
    initial: "init",
    invoke: { src: "pollStatus" },
    on: {
        statusUpdate: { actions: StateModel.assign({ status: (_, e) => e.status }, "statusUpdate") },
        sendMission: { actions: "missionAssign" },
        setTickRemain: { actions: StateModel.assign({ tickRemain: (_, e) => e.value }, "setTickRemain") },
        tick: [
            { // Item collection timeout -> close lid and return home (considered successful)
                target: ".delivery.collectItems.lidClosing",
                cond: (ctx, _, { state }) => ctx.tickRemain <= 0 && state.matches("delivery.collectItems.itemCollection")
            },
            { // Recipient did not interact -> send alert api and return home
                actions: "sendDeliveryFailureAlert",
                target: ".returnHome",
                cond: (ctx, _, { state }) => ctx.tickRemain <= 0 && state.matches("delivery.waitForRecipient")
            },
            { // Item placing timeout -> close lid and go to idle
                target: ".delivery.placeItems.cancelled",
                cond: (ctx, _, { state }) => ctx.tickRemain <= 0 && state.matches("delivery.placeItems.itemPlacing")
            },
            { // Idle timeout -> charge
                target: ".charging",
                cond: (ctx, _, { state }) => ctx.tickRemain <= 0 && state.matches("idle")
            },
            { // General timeout -> return home
                target: ".returnHome",
                cond: (ctx, _) => ctx.tickRemain <= 0
            },
            // Decrement remining ticks
            { actions: StateModel.assign({ tickRemain: (ctx) => ctx.tickRemain - 1 }) },
        ],
        // Only for debug
        lidFire: { actions: (ctx, e) => RiceAppAPI.post("/api/lid", { lid: ctx.status.lid === "close" || ctx.status.lid === "closing" ? "open" : "close" }) },
        eBrakeFire: { actions: (ctx, e) => RiceAppAPI.post("/api/ebrake", { brake: ctx.status.eBrake === "freewheel" ? "release" : "freewheel" }) },
        parkFire: 'charging',
    },
    states: {
        init: {
            invoke: {
                src: "callInit",
                onDone: {
                    target: "enterPasscode",
                    actions: [
                        assign({
                            info: (ctx, { data }) => {
                                console.log("app param", data.params);
                                function withDefault(obj, field: keyof typeof ctx.info.params, val) {
                                    if (!obj) return;
                                    if (!Number.isFinite(obj[field])) obj[field] = val;
                                };
                                withDefault(data.params, "navTimeoutIntegrationTest", 30 * 60);
                                withDefault(data.params, "navTimeoutNavigation", 10 * 60);
                                withDefault(data.params, "navTimeoutDeliver", 60 * 60);
                                withDefault(data.params, "navTimeoutReturn", 60 * 60);
                                withDefault(data.params, "idleTimeoutStandby", 5 * 60);
                                withDefault(data.params, "idleTimeoutItemPlace", 10 * 60);
                                withDefault(data.params, "idleTimeoutWaitReciepient", 30 * 60);
                                withDefault(data.params, "idleTimeoutItemCollect", 5 * 60);
                                withDefault(data.params, "minBatteryWakeup", 30);
                                withDefault(data.params, "minBatteryDisinfection", 30);
                                return data;
                            }
                        }),
                        (ctx) => i18n.changeLanguage(ctx.info.site.locale),
                    ],
                },
            }
        },
        enterPasscode: { on: { passcodeEntered: "confirmPosition" } },
        confirmPosition: {
            initial: "init",
            states: {
                init: {
                    on: {
                        initPosConfirmed: {
                            target: "overriding",
                            actions: "assignBase"
                        }
                    }
                },
                overriding: {
                    invoke: {
                        src: "overridePosition",
                        onDone: "assignScheduler"
                    }
                },
                assignScheduler: {
                    entry: StateModel.assign({
                        scheduler: (ctx, e) => {
                            const schedule = ctx.info.site.map.points[ctx.homePoint].waypoint.home.schedule;
                            return schedule ? new Scheduler(schedule) : null;
                        }
                    }),
                    always: "success"
                },
                success: { type: "final" }
            },
            onDone: [
                { target: "integrationTest", cond: "isIntegrationTest" },
                { target: "idle", cond: (ctx, e) => ctx.info.robot.type === "rice" },
                //{ target: "charging", cond: (ctx, e) => ctx.info.robot.type === "jasmine" }
            ]
        },
        integrationTest: {
            initial: "init",
            states: {
                init: {
                    on: {
                        beginTest: {
                            target: "runAllWaypoints",
                            actions: [
                                StateModel.assign((_, e) => ({ integrationTestEnabledTests: e.tests, integrationTestPathId: e.pathId })),
                                "startRecording"
                            ]
                        }
                    }
                },
                runAllWaypoints: {
                    entry: StateModel.assign({ nextCoordIdx: 0 }),
                    initial: "idle",
                    states: {
                        idle: {
                            always: [
                                { target: "skip", cond: (ctx, e) => !ctx.integrationTestEnabledTests.has(1) },
                                { target: "navigating" }
                            ]
                        },
                        navigating: {
                            invoke: [
                                { src: "disinfect" },
                                {
                                    src: NavigationMachine,
                                    data: (ctx) => ({
                                        waypoint: [...ctx.info.site.map.paths[ctx.integrationTestPathId].geometry[ctx.nextCoordIdx], -1],
                                        timeout: ctx.info.params.navTimeoutIntegrationTest,
                                        map: ctx.info.site.map,
                                        currentPosition: ctx.status.position,
                                        boundBox: ctx.status.currentFloor.boundBox
                                    }),
                                    onDone: [
                                        {
                                            target: "complete",
                                            cond: (ctx) => ctx.nextCoordIdx === ctx.info.site.map.paths[ctx.integrationTestPathId].geometry.length - 1
                                        },
                                        {
                                            target: "navigating",
                                            actions: assign({ nextCoordIdx: (ctx) => ctx.nextCoordIdx + 1 })
                                        }
                                    ],
                                },
                            ]
                        },
                        skip: { type: "final" },
                        complete: { type: "final" },
                    },
                    onDone: "parkAndCharge"
                },
                parkAndCharge: {
                    initial: "idle",
                    states: {
                        idle: {
                            always: [
                                { target: "skip", cond: (ctx) => !ctx.integrationTestEnabledTests.has(2) },
                                { target: "docking" }
                            ]
                        },
                        docking: {
                            invoke: {
                                src: "park",
                                onDone: { target: "docked", actions: () => playSoundEffect(SoundEffect.charging) },
                                onError: { target: "docking" }
                            },
                            exit: StateModel.assign({ parkAttempts: (ctx) => ctx.parkAttempts + 1 }),
                        },
                        docked: {
                            entry: StateModel.assign({ parkSuccesses: (ctx) => ctx.parkSuccesses + 1 }),
                            after: { 5000: "complete" }
                        },
                        complete: { type: "final" },
                        skip: { type: "final" }
                    },
                    onDone: "openAndCloseLid"
                },
                openAndCloseLid: {
                    initial: "idle",
                    states: {
                        idle: {
                            always: [
                                { target: "skip", cond: (ctx) => !ctx.integrationTestEnabledTests.has(3) },
                                { target: "lidOpening" }
                            ]
                        },
                        lidOpening: {
                            invoke: {
                                src: "lidOpen",
                                onDone: "delay"
                            }
                        },
                        delay: {
                            after: {
                                10000: "lidClosing"
                            }
                        },
                        lidClosing: {
                            invoke: {
                                src: "lidClose",
                                onDone: "complete"
                            }
                        },
                        complete: { type: "final" },
                        skip: { type: "final" }
                    },
                    onDone: "runAllWaypoints"
                }
            }
        },
        idle: {
            initial: "missionCheck",
            invoke: [
                //{ src: "timeoutTimer", data: (ctx) => ({ timeout: ctx.info.params.idleTimeoutStandby }) },
                { src: "disinfectionScheduler" }
            ],
            on: {
                toOpenLid: "openLid",
                toNavi: "movingNavi",
                toCharging: "#global.returnHome"
            },
            states: {
                missionCheck: {
                    always: [
                        { target: "failedDelivery", cond: (ctx, e) => (ctx.mission?.state !== "return" && ctx.mission?.meta?.hasOwnProperty("to")) },
                        {
                            target: "#global.charging", // send robot straight to charger if robot (jasmine) just returned from disinfection
                            cond: (ctx, e) => ctx.mission?.state === "return" && ctx.info.robot.type === "jasmine",
                            actions: raise(({ type: "sendMission", missionState: "end", api: true, meta: null }))
                        },
                        {
                            target: "clean",
                            cond: (ctx) => ctx.mission?.state === "return",
                            actions: raise(({ type: "sendMission", missionState: "end", api: true, meta: null })), // send end mission if robot just returned from mission
                        },
                        { target: "clean" }
                    ]
                },
                clean: {
                    entry: raise({ type: "sendMission", missionState: null, meta: null, api: true }) // send null mission
                },
                failedDelivery: {
                    on: { clear: "clean" }
                }
            }
        },
        getItem: {
            initial: "missionCheck",
            invoke: [
            ],
            on: {
                // raises sendMission instead of transition to disinfection directly because missionAssign needs to happen before entering disinfection
                toRefill: "refill",
                toNavi: "movingNavi",
                toCharging: "#global.returnHome"
            },
            states: {
                missionCheck: {
                    always: [
                        { target: "failedDelivery", cond: (ctx, e) => (ctx.mission?.state !== "return" && ctx.mission?.meta?.hasOwnProperty("to")) },
                        {
                            target: "#global.charging", // send robot straight to charger if robot (jasmine) just returned from disinfection
                            cond: (ctx, e) => ctx.mission?.state === "return" && ctx.info.robot.type === "jasmine",
                            actions: raise(({ type: "sendMission", missionState: "end", api: true, meta: null }))
                        },
                        {
                            target: "clean",
                            cond: (ctx) => ctx.mission?.state === "return",
                            actions: raise(({ type: "sendMission", missionState: "end", api: true, meta: null })), // send end mission if robot just returned from mission
                        },
                        { target: "clean" }
                    ]
                },
                clean: {
                    entry: raise({ type: "sendMission", missionState: null, meta: null, api: true }) // send null mission
                },
                failedDelivery: {
                    on: { clear: "clean" }
                }
            }
        },
        charging: {
            invoke: { src: "disinfectionScheduler" },
            on: {
                clear: {
                    actions: raise({ type: "sendMission", missionState: null, meta: null, api: true }) // send null mission
                }
            },
            initial: "docking",
            states: {
                docking: {
                    invoke: {
                        src: "park",
                        onDone: { target: "docked", actions: () => playSoundEffect(SoundEffect.charging) },
                        onError: { target: "docking" }
                    }
                },
                docked: {
                    on: {
                        wake: [
                            { target: "enterPasscode", cond: (ctx, e) => ctx.info.robot.type === "jasmine" },
                            { target: "#global.returnHome", cond: (ctx, e) => ctx.status.charge >= ctx.info.params.minBatteryWakeup }
                        ]
                    }
                },
                enterPasscode: {
                    on: {
                        passcodeEntered: "#global.returnHome",
                        back: "docked",
                    }
                }
            }
        },
        delivery: {
            id: "delivery",
            description: "Child state for delivery",
            initial: "waitForRecipient",
            states: {
                enterPasscodeInit: {
                    invoke: { src: "timeoutTimer", data: (ctx) => ({ timeout: ctx.info.params.idleTimeoutItemPlace }) },
                    on: {
                        passcodeEntered: "placeItems",
                        back: "#global.idle"
                    },
                },

                placeItems: {
                    entry: raise({ type: "sendMission", missionState: "start", api: true, meta: null }),
                    initial: "lidOpening",
                    on: { back: "#global.idle" },
                    states: {
                        lidOpening: {
                            invoke: {
                                src: "lidOpen",
                                onDone: "itemPlacing"
                            }
                        },
                        itemPlacing: {
                            invoke: { src: "timeoutTimer", data: (ctx) => ({ timeout: ctx.info.params.idleTimeoutItemPlace }) },
                            on: {
                                itemPlaced: "lidClosing",
                                back: "cancelled"
                            },
                        },
                        lidClosing: {
                            invoke: {
                                src: "lidClose",
                                onDone: "placingComplete"
                            },
                        },
                        cancelled: {
                            invoke: {
                                src: "lidClose",
                                onDone: "#global.idle"
                            },
                        },
                        placingComplete: { type: "final" }
                    },
                    onDone: "configRecipient"
                },
                configRecipient: {
                    invoke: { src: "timeoutTimer", data: (ctx) => ({ timeout: ctx.info.params.idleTimeoutItemPlace }) },
                    on: {
                        recipientConfigured: {
                            target: "confirmDetails",
                            // actions: StateModel.assign({ mission: (ctx, e) => ({...ctx.mission, meta: e.meta}) }) // Update mission context with meta
                            actions: raise((ctx, e) => ({ type: "sendMission", missionState: null, meta: e.meta, api: false }))
                        },
                        back: "placeItems"
                    },
                },
                confirmDetails: {
                    invoke: { src: "timeoutTimer", data: (ctx) => ({ timeout: ctx.info.params.idleTimeoutItemPlace }) },
                    on: {
                        detailsConfirmed: {
                            target: "delivering",
                            actions: raise((ctx, e) => ({ type: "sendMission", missionState: "move", meta: ctx.mission.meta, api: true })) // send mission move api
                        },
                        back: "configRecipient"
                    },
                },
                delivering: {
                    on: {
                        // Receive event from child machine to send error mission api
                        navError: { actions: raise((ctx, e) => ({ type: "sendMission", missionState: "error", meta: ctx.mission.meta, api: true })) }
                    },
                    invoke: {
                        src: NavigationMachine,
                        // Pass navigation context to child machine
                        data: (ctx) => ({
                            waypoint: ctx.mission.meta.to,
                            timeout: ctx.info.params.navTimeoutDeliver,
                            map: ctx.info.site.map,
                            currentPosition: ctx.status.position,
                            boundBox: ctx.status.currentFloor.boundBox
                        }),
                        onDone: {
                            target: "waitForRecipient",
                        },
                        onError: "#global.fatalError"
                    }
                },
                waitForRecipient: {
                    entry: raise((ctx, e) => ({ type: "sendMission", missionState: "code", meta: ctx.mission.meta, api: true })),
                    invoke: [
                        { src: "timeoutTimer", data: (ctx) => ({ timeout: ctx.info.params.idleTimeoutWaitReciepient }) },
                        //{ src: "sendPasswordMessage", onDone: { actions: assign({ delivPassword: (_, e) => e.data }) } }
                    ],
                    on: { recipientInteracted: "enterPasscodeCollect" },
                },
                enterPasscodeCollect: {
                    invoke: { src: "timeoutTimer", data: (ctx) => ({ timeout: ctx.info.params.idleTimeoutWaitReciepient }) },
                    on: {
                        passcodeEntered: { target: "collectItems" },
                        back: "waitForRecipient"
                    },
                },
                collectItems: {
                    initial: "lidOpening",
                    states: {
                        lidOpening: {
                            invoke: {
                                src: "lidOpen",
                                onDone: "itemCollection"
                            }
                        },
                        itemCollection: {
                            invoke: { src: "timeoutTimer", data: (ctx) => ({ timeout: ctx.info.params.idleTimeoutItemCollect }) },
                            on: { itemCollected: "lidClosing" },
                        },
                        lidClosing: {
                            invoke: {
                                src: "lidClose",
                                onDone: "collectionComplete"
                            },
                        },
                        collectionComplete: { type: "final" }
                    },
                    onDone: "deliveryComplete"
                },
                deliveryComplete: {
                    type: "final",
                    entry: raise((ctx, e) => ({ type: "sendMission", missionState: "end", api: true, meta: ctx.mission.meta })),
                    //entry: raise((ctx, e) => ({ type: "sendMission", missionState: "return", api: true, meta: ctx.mission.meta })),
                    always: "#global.returnHome",
                }
            },
        },
        disinfection: {
            description: "Child state for disinfection",
            initial: "init",
            states: {
                init: {
                    invoke: {
                        src: "getMapImage",
                        onDone: {
                            actions: assign({ mapImage: (_, e) => e.data }),
                            target: "performing"
                        }
                    }
                },
                performing: {
                    initial: "navigating",
                    entry: StateModel.assign({ nextCoordIdx: 0 }),
                    invoke: [
                        { src: "disinfect" },
                        { src: "playSoundtrack", data: () => ({ track: "disinfection" }) },
                    ],
                    states: {
                        navigating: {
                            on: { pause: "paused" },
                            invoke: [
                                {
                                    src: NavigationMachine,
                                    data: (ctx, e) => ({
                                        waypoint: [...ctx.info.site.map.paths[ctx.mission.meta.pathId].geometry[ctx.nextCoordIdx], -1],
                                        timeout: ctx.info.params.navTimeoutNavigation,
                                        map: ctx.info.site.map,
                                        currentPosition: ctx.status.position,
                                        boundBox: ctx.status.currentFloor.boundBox
                                    }),
                                    onError: [ // skip waypoint if blocked as if it had been reached
                                        {
                                            target: "complete",
                                            cond: (ctx, e) => ctx.nextCoordIdx === ctx.info.site.map.paths[ctx.mission.meta.pathId].geometry.length - 1
                                        },
                                        {
                                            target: "navigating",
                                            actions: assign({ nextCoordIdx: (ctx, e) => ctx.nextCoordIdx + 1 })

                                        }
                                    ],
                                    onDone: [
                                        {
                                            target: "complete",
                                            cond: (ctx, e) => ctx.nextCoordIdx === ctx.info.site.map.paths[ctx.mission.meta.pathId].geometry.length - 1
                                        },
                                        {
                                            target: "navigating",
                                            actions: assign({ nextCoordIdx: (ctx, e) => ctx.nextCoordIdx + 1 })

                                        }
                                    ]
                                }
                            ],
                        },
                        paused: {
                            entry: () => RiceAppAPI.post("api/nav/cancel", {}),
                            after: {
                                60000: "navigating"
                            },
                            on: { resume: "navigating" }
                        },
                        complete: {
                            entry: raise((ctx) => ({ type: "sendMission", missionState: "move", meta: { ...ctx.mission.meta, repetition: ctx.mission.meta.repetition - 1 }, api: false })),
                            type: "final"
                        }
                    },
                    onDone: "check"
                },
                check: {
                    always: [
                        {
                            target: "#global.returnHome",
                            actions: raise((ctx) => ({ type: "sendMission", missionState: "return", api: true, meta: ctx.mission.meta })),
                            cond: (ctx) => ctx.mission.meta.repetition <= 0,
                        },
                        { target: "performing" }
                    ]
                },
            },
        },
        openLid: {
            initial: "lidOpening",
            states: {
                lidOpening: {
                    invoke: {
                        src: "lidOpen",
                        onDone: "refilling"
                    }
                },
                refilling: {
                    on: {
                        filled: "lidClosing"
                    }
                },
                lidClosing: {
                    invoke: {
                        src: "lidClose",
                        onDone: "#global.idle"
                    }
                }
            }
        },
        refill: {
            initial: "lidOpening",
            states: {
                lidOpening: {
                    invoke: {
                        src: "lidOpen",
                        onDone: "refilling"
                    }
                },
                refilling: {
                    on: {
                        filled: "lidClosing"
                    }
                },
                lidClosing: {
                    invoke: {
                        src: "lidClose",
                        onDone: "#global.getItem"
                    }
                }
            }
        },
        demo: {
            initial: "closing",
            states: {
                closing: {
                    on: {
                        closed: "lidClosing"
                    }
                },
                lidClosing: {
                    invoke: {
                        src: "lidClose",
                        onDone: "#global.idle"
                    }
                }
            }
        },
        movingNavi: {
            entry: raise({ type: "sendMission", missionState: "start", api: true, meta: null }),
            initial: "navigate",
            invoke: [
                //{ src: "playSoundtrack", data: () => ({ track: "navigation" }) }, // play sound navigation.ogg
            ],
            states: {
                navigate: {
                    invoke: [
                        {
                            src: NavigationMachine,
                            data: (ctx, e) => ({
                                waypoint: [16.9, 11.6, 90],
                                timeout: ctx.info.params.navTimeoutNavigation,
                                map: ctx.info.site.map,
                                currentPosition: ctx.status.position,
                                boundBox: ctx.status.currentFloor.boundBox
                            }),
                            onError: [ // skip waypoint if blocked as if it had been reached
                                {
                                    target: "navigate",  // retry
                                }
                            ],
                            onDone: [
                                {
                                    target: "#global.delivery",
                                },
                            ]
                        }
                    ],
                },
            },
        },
        returnHome: {
            invoke: {
                src: NavigationMachine,
                data: (ctx, e) => ({
                    waypoint: ctx.homePoint,
                    timeout: ctx.info.params.navTimeoutReturn,
                    map: ctx.info.site.map,
                    currentPosition: ctx.status.position,
                    boundBox: ctx.status.currentFloor.boundBox
                }),
                onDone: "idle",
                onError: { target: "#global.fatalError" }
            }
        },
        fatalError: {
            type: "final"
        },
    },
}, {
    services: {
        pollStatus: () => interval(1000).pipe(
            // switchMap will cancel prev req if not complete before next interval value
            switchMap(() => fromFetch(`${import.meta.env.VITE_ROBOT_URL}/api/status`)),
            switchMap(resp => {
                if (resp.ok) return resp.json();
                console.warn("[api] pollStatus", resp);
                return EMPTY;
            }),
            map(status => StateModel.events.statusUpdate(status)),
            catchError(err => (console.warn("[api] pollStatus", err), EMPTY)),
        ),
        async callInit() {
            while (true) try {
                const resp = await RiceAppAPI.post("/api/init", {
                    capability: { xstateViz: initCtx.devMode || initCtx.debugMode }
                });
                return resp.data;
            } catch (err) {
                console.warn("[api] callInit", err);
                await timeout(1000);
            }
        },
        async park(ctx) {
            try {
                const resp = await RiceAppAPI.post("/api/nav/goal", {
                    waypoint: ctx.chargerPoint
                });
                if (resp.data.message !== "success") {
                    throw "Failed to go to charger point";
                }
                await RiceAppAPI.post("/api/nav/park", { chargeAwaitTimeout: 5000 });
                return;
            } catch (err) {
                console.warn("[api] park", err);
                await timeout(1000);
                throw (err);
            }
        },
        async lidOpen() {
            await lidAsync("open");
        },
        async lidClose() {
            await lidAsync("close");
        },
        async overridePosition(ctx) {
            await setPosition(ctx.homePoint);
        },
        async getMapImage() {
            while (true) try {
                const resp = await RiceAppAPI.get("/api/map/image", {
                    responseType: "blob"
                });
                return resp.data;
            } catch (err) {
                console.warn("[api] api/map/image", err);
                await timeout(1000);
            }
        },
        async sendPasswordMessage(ctx) {
            if (ctx.debugMode) return;
            console.log("[api/message] not debug")
            const randomPassword = Math.floor(Math.random() * 9000 + 1000).toString(); // Generates 4 digit random password with range 1000-9999
            const message = `Hi, I'm Rice. I've got items for you, please meet me at your door with this password: ${randomPassword}`;
            for (let i = 0; i < 3; i++) try {
                console.log("[api/message] send")
                await RiceAppAPI.post("/api/message", {
                    platform: "sms",
                    phoneNumber: ctx.mission.meta.phoneNumber,
                    senderId: "Rice Robotics",
                    message
                });
                return randomPassword;
            } catch (err) {
                console.warn("[api] message", err);
                try {
                    RiceAppAPI.post("/api/alert/", {
                        alarmType: "sms-failure",
                        message: `Recipient: ${ctx.mission.meta.phoneNumber}; \nOriginal message: ${message}`
                    });
                } catch (err) {
                    console.error(err);
                }
                await timeout(60 * 1000); // wait 1 minute before sending another sms
            }
        },
        timeoutTimer: (ctx, e, { data }) => (callback) => {
            callback({ type: "setTickRemain", value: data.timeout || 5 * 60 });
            const intervalId = setInterval(() => callback("tick"), 1000);
            return () => clearInterval(intervalId);
        },
        disinfectionScheduler: (ctx) => ctx.scheduler?.observable.pipe(
            map((idx) => StateModel.events.startDisinfection(idx)),
        ),
        disinfect: () => () => {
            RiceAppAPI.post("/api/disinfection", { disinfection: "on" });
            return () => RiceAppAPI.post("/api/disinfection", { disinfection: "off" });
        },
        playSoundtrack: (ctx, e, { data }) => () => {
            const audio = new Audio(`/sfx/${data.track}.ogg`);
            audio.loop = true;
            audio.play();
            return () => audio.pause();
        },
    },
    actions: {
        missionAssign: StateModel.assign((ctx, e) => {
            let mission: typeof initCtx.mission = undefined;

            if (!e.missionState) {
                mission = e.meta ? { ...ctx.mission, meta: e.meta } : null;
            }
            else if (e.missionState === "start") {
                const type = ctx.info.robot.type === "rice" ? "delivery" :
                    ctx.info.robot.type === "jasmine" ? "disinfection" :
                        null;
                mission = { id: nanoid(), type: type, state: e.missionState, meta: e.meta };
            }
            else {
                mission = { ...ctx.mission, state: e.missionState, meta: e.meta };
            }
            console.log("[missionAssign]", mission, "api:", e.api);
            if (e.api && !ctx.debugMode) RiceAppAPI.post("/api/mission", { mission: mission });
            return { mission: mission }
        }, "sendMission"),
        assignBase: StateModel.assign((ctx, e) => {
            return { homePoint: e.homePoint, chargerPoint: e.chargerPoint };
        }, "initPosConfirmed"),
        sendDeliveryFailureAlert: (ctx, e) => {
            try {
                RiceAppAPI.post("/api/alert", {
                    alarmType: "delivery-failure",
                    message: `Recipient: ${ctx.mission.meta.phoneNumber}; \nDestination name: ${ctx.mission.meta.to}`
                });
            } catch (err) {
                console.error(err);
            }
        },
        startRecording: () => RiceAppAPI.post("/api/video/record", { record: true }),
    },
    guards: {
        isIntegrationTest: (ctx, e) => ctx.info.params.integrationTest,
    }
});

export const AppState = createActorContext(StateMachine, { devTools: initCtx.devMode || initCtx.debugMode });