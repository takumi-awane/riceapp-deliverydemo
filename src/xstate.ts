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
    /** @xstate-layout N4IgpgJg5mDOIC5RQDYHsBGBDFBiWALlgQK6wCqADhMWANoAMAuoqJWrAJYGdoB2rEAA9EAJgAcDAMwA6AGyiArNIDsARgCcU0RvFSANCACeiNQxUyNi7QBYV56WqUBfZ4dSYc+MHwgBZTlgufkYWJBB2Lh5+QREECQZReQYNGydNbV0DY1NRV3d0bDxYMAIAFU4AYwBrACUwAFssTj5QwUjuXgFwuNEVDQ0ZNLTExUUbbTVskwQ5OYtzMfG5Bjl0-JAPItweGrbwjuju0DjxFUMZ7UUklX7JdQkNcw2tr13qujUwtg5OmJ7THYLogbBodDJElI1GprlIJio5C9Cm8qh9RN8Ir8jrFEGdgfFJGoZOI1HIbDZxIo5LcUjYkZ48O86FIMYcujiEHicggbHJZE95ipRLyUlIVIp6dsmTZWVj2QCEDDztyKSpxDJYQxxpowXk3JtkYzUXRFLKovKTmI1USBqI7eLxpNpog5Ip1DInKIpIspIpJOJJV4UJwIAAxTgAJ3ozHacv+loJEnkaiFUKkcieanEcnxZPFHozqwYvPGGkR+teeDAACEI1hqmBw1H9j9zfHhGISTYPWdrF2M0LlTM+f0ZKIYSSpFIrFmpIGUDIWtxcBB+GBF3wAG5oBsySsb7gIFrbyrELqhFuYtvHDvxP1jxT4rNnIYqUHUqyuibzmQ+AhgCMAAUsCCSo0AgMBcEoEDYDAiCAFE+H-KMIEvNl2ziN0GBkew0zJckUizJ8wRtBIwU-R0fzAvgADNIwaQC4z4Fc1xkQhaD3Q0ZGouiIwYpi0KYjlRAYLUPVFDQ1XEEk9BzbknBJHC-S9SSRS0AMKy4nj6MY68WL4dd2P-TiGW4-heP469PjNP4bziHVFHErRJOkmT02IjNiUUXQtDucQJDUKjzJ0pj9MMohjP3bS+N02y6HRWNrw5BynOnKS3LkmY-W7V1qXMBF03UDQgtokLrwPAhcCXAhdIAYWCvjIEEpKFQ0MwIRhMlxzmKZbmIrMNWknRQX8trEhKizYqOGQ0E3ACIxDFooDCjdt13KKGss2yZrmiMFogJajy3NBTyOC8YwOISFSmb0NV8tU1kSHRH3k1Iki7SSrGsO0+gmsrtpgzgoD4ABlSoAAtIBIFAANwZrbOS9RHIYTrFBTRJpJSYibHetRQX6MZtHtH8Wn-KA6yOMo4AICrcAwMAoBaKnCHh7EFWFccPSUaQOdBUQ5HEfEwTkHsUfFa0XE00zSYZimumZmmIxIPgAEEUBQAB1LAjHYUnYBWoz133GXybPfgFZkJXVfVrWdbQPXWYtW9pwFiFeS0NI+nuTLTGkbt+m6tGRPJHQSaQ2Wzb4C2rbVzXtd1pDYEXCAYbhi7WwR9mVHTeQbFWV0tQmcdnU5MFLFWBEzl0fySTDsm5fN6nLeV2PbYTggk5DVPrMSzOEz6HOyXz5RHWLp8GBfMwsj6PlqU0OuI8ppuY5t+P7cTmQ+CwTcgbPPhltXAzVp3I2uJNhuo+XlvV7tvXN+33eeH3o6T0j6zHYwxAp15GQxRHoVg7eXHtmX+3lszaBJJLAo0tw6myXoQZu1s463w3lvHeUA94H1YseE+JkigbnrpHaO19kHtyTmgx+h0cGnXPF8Hul0Wr93EKkIY4hySkjLKSIciArDYQFJXPyAUF5wPlk3aCEZqgq18LVcGWAIwwANhFU+MDCHwJpuIyR0jZHyOjDZNmCYpwsIllYW4s9uGKgFo5FYkl1BCkpJ1YRF8LYaKkRAGRciYDJ27unK8fdbzCjmFzZQthhTC0FvJO4TkHq6GzsWFQjiiFiLkZotx2jPFd0gvQjO+j-G8hFk4YJvMwlPgFkkckUItSrCzBSYqUt8Hn0SQglxWiPHrlXDUJaK0cHrTPrApxSSJGuPcTomQ7TqhUOOjQkIzAP52StC+CW0k8YDj6CUtUv89B2nJGcb0dgElqJkM01JrTRknXGfvXA800ARkOSgYgNFrkNDwTgAhi9RFNOSUMtJbSzkTNfmdGZPj0JzPiGSWQeM2HqE2X0cYJToROU2QVOetToH1L6Y09RnyWkjLGZAXAQhDYyCwDRZCAAKZQokACUuBjbooOUc4ZnjcWoSBVdAxE9ZDLDahmNY1Inz2CJFPEk4pixDQ0qil5DSDloEoD4IZ6ASgABkQyKI4rS1R7yaYyrldIhVYBlUsr0U7XoRMgmJDyhIEkT4cZJF9DYlMEg0ZUn2ZqmasrVa6o4PqkMXjMmssYc7V06obDWCzI4KEZgbD8oGhmb0zDJDenLBKhcUrXXao9W4vVBrfVwy+L3HJcR0z3hDVCBNUxoTFhKb6IYEwnA81WFIfyLrG4IPTfKr12bgwQAAPLus6Yfdc3TlFoo1S2rV7r21Kp9V23tPg-knTfoCo1n8eSiWwlmcUj1fSdVEFWnKWgYQcv8qSOcdTJV0rTROz1U6ICjLAHcow+LCXErJWYNd1L1VvLHW6nVmaO0+ogg+2ZHIcYIghAoKk1I3QiV3fJPk+6oTKD0MevkzbL6tqvX+m9Mgu21QVf27Bx0ekqK-eh8dv68P-tvbh-Dz9qGLqYMBhUIaQEbqpBSEa1gXozBPQhw9yHuqnuTTm9iEYCAABF72cF2kYJjTC3QQjXY25ZklVncnHIpO1iKzF6mExk-ARAxPicCC0GiYBKgAuXSCyQ4Jbi+hxnnNI4p8RTkUuYOYaM1hTFDmelNKdIIAEcSCohBoZiTJnaLmcs-m41uJRKDDtHMakjmUzca-o6rmcJizahRq6Em-nvC+ACEEc8-q-GFv6Ouoq042G6C4y5gcEJvrimWRSa4+XU4EDQPUOi6s5PO0qx6aruhOO+hc8oEWtwsgIl5G13TBppYFa64ypa-WKtPCGxkEbdWxvcnTD-Qm440jQkyB19cDRAjBD4DI8z1Q05WY5N6XQQwBb9E0Ly8xYophjjuALUked4NnZkBdkr-Abs1FzQ9hUYoNspi27Vyku2Zhe1kOoDMkbRLThhEDkHV3wd3filD9lz3eRV3e1wlzZx1TSFEiJFrVg6S+d9cDy7XR8dwxZDFldT3g2vbapwvle29DdkSD5bMJIyTY6ZxkmQNFmgwwgJJ4MMncCVBhnItbX8nObbBGwrUCIUwufUNhUX8a-uS4lEziGHjOmifC1wSLFnStE9vGNRy04yzML7FMDQ+IlC3EsE8O0fpvTmBRQt-B1v5G27C8Zh3ZmnchDzQw8rPCJ6DEmFScwXoQ4ud9NhN0ZIBiQgmGwqiaTbc+H8Kz6ZLv7KG+5NYQJkkRybrhLccvNuLklCKzX1oyfsmxYQGNEW9pIF8jDy5pQOUvRKE0KG-mnfo8XLV2ADXZWC08OqThJ42hzUo0pC5ic8h7CiQpDXKYjPhNR8ZvvU5HSLkDuPsRyPFe79jPnVM1oS6ucguuEoLyVIb6FGYaFzHmSwCYawacX0cYDvK3N-KAe-c5ZaK5G5SgO5AgB5PiZ5BcG-JaJAz-BjTXBACbEWfyaQWrAOCkP3FyE-RIUEEvRtK-CPF5PA9-M5PFAAd3rF0V-w5H-0ckpCAL3ycFSBoKhAgLhGhGzFhHa3gK70QOZVwG4IbCyV8U30VDUyyjxkciFD5F1x+jmCX1v0QL-AAmAlAnAkgmgksIQnDhQmIN6nxGUCsDHH5inBTDOCnmMPwLMKAhgjgkgmwD2A3yHwEMAJLRElEKjXU10DKQmDsB0Exzakt2E0A2kwAiMF-HsIsNgisIAEk+BlwbC8i7DkImpQiV0+xLANN-IFBnIQ0-dqRZAoQyRmF-dJxmD9x0iZNsjkJcjAjCjlxgiPhKiQVhQcZf4RU7RXJZwfYEA7VJs7hzAFInh4kmcejMjbksBKgwB8j-wGh9Yn9CVuipNej0Cdi9iDjYBiDg5Bgh48xZjZImj7wPcngnhC8swfxNiIwsiLjdj9jGh9YRjbiQ1bVpjLUMoGs7AftdBzcAc4Rvizitj-irigScMQxZ0ijH9CM1ph0Xkfi-i7kATriMSe0+06NJkiCxiOR1IzVoRyQ842pwlkc55f4Bh-IlA2o8Z1i0jkTfjtiST0TuBGhAJiTOkRSGJiSKi69TA41wNuYEQdBpxGj1NXQrF8YuTrg8YtAkTlcUTpTATDjFwDixSdjOkQSaTrp5TVhFT6iVS0t4gDdwNJdJBlBy09SMiBTUSjSk4aNfgcSj4h0cC719TvTDTST-SHcoAX4F1LNHC+QkhXs0Ypw0YCIYjWSFMdThVlBz8xRPTziIz0TTw+Bdj1Y8Un9gzTiwyiTLjfTuIsBSz70FdYyv9zpZT4gwSpjlAZillniVRRJ1Rs4dAFAyQ2i5C+SayzJSooB6hKhOBKBOA-xcAox5zFy-x6oZySAHCrSExHQajnx+ZlSgCaCBh2Tp4kVBwCytjtJZzzMFylykI6YdjRiOzUzADG18ImSiJYiKRiQBhbgHV7E8sNj+SsjooGhJMiBOAUAjjSh5dYBNyLIZS+CFRCYDyhp7STy9tZwxxNBxQzh3M9BUiWCFxCTpyLIoKELnyQiOz0KSJMLjzVTLhvMcJ3sW8hRrheTSLQyvSsifiCMgyiN8SyKwLeLdpCD4zdznZXChDPzGTCIWSv5mixxMhRzZtKR5tqy+LxKAJOlUDtjMDHkQzyKBLKT-lndQTJi-4nonj3IVQ0ZsIvQI1YR4Qk0eLTL+TOk0F4I9prliDG0yxiRqQ7RUgPswDJIIQZtzA7AHAuiuJyLuDuBQxrk5yHzlzKzhKTKxKkqCAUqIw0r1ykJWy346FpL7IKR10rApw4R-Qkcv5xh1Rrhpsxy5tryBTcr8rCrHzKpVz0qkJCjkIdj-xDVUKEwzBOZzAuxRgqc2ojcRIXTg5QMJ54rTJyK-CBirD6pyyLMoIAirDEJyjRqU8NC-4PzswFLmT8Q3LVLvQvR4SpdJydKNr9qIJtqYZdrLSOyJqiQpq8YZq1Q5q9s5hBhIM8ZDFNA+huLtLeiwIdqCBfTVVIoEqxK4aPqEbrjHCxoOoqQ0Z7BLUsYVQUwEspwVq0c7h2rwK0B4b6yZ0KSsEhK8Tsqpy0aotabMT6aSqpKOzbhkYIMYQlBZq1Brq7QbQ9AUgAKxgzhKazIabSTJT3qosugqoDjFaLMUKTqh8GTkY10GSCIrqVQ7RsIKRQ82EZiJyPLUbqb0b2asNBLB0sqYabzra2bIyQxKNoyubLLyrAQNtHB3Dt10yRaxQXTS9pw0ZiKZbCT6oGh0DSg-UOzJJcwswyD-I-RPD1BAoNiIsE9ppqoulHaEqc6lb+AKovba9iCVh+RXtXRBbAbhbG8MwrF+hQRQQss9Bvji7E8+BDkAIsCLtAzwo1Ui748S6e7ZUIx+7VsfbZhvtPcERrg-R67nCxhjaRyAkpx+hO7R7u7e7J7Hl8CKEMEn4GaHambuiu7poJ6p678j7MFy7v9GMZ6lRfrOoC5R4phnDbh1REzf78ZVr8EDod6r6+6D7b6H5j77bn8RLRlL6ug96b7EC76T6H6LwB91CtboRBgCl6CCZvpYMspJcajUgdliwBZxUPK4HS7r6wGkGIHMFLk-K0CMD+6TKqHx7QG+JD76GUH6NuaxrbwX6caPNC4nQv6JDvNxREjRJrBt7TMx6EHaH750EGGDKLijLsCL7gH4GaGuHwGVHeGqT4z0HgVkosGd9Cw3xQl+YlKSDGrLAZtnKasQ05HHcQH969G6GDHOloIyBeDNaV030yDpiUg6rHSqQQF-cVheRxRhpXHc6dHOGB7EDfGSgIAVy4ASAGh-HB8V1bRf4ClNBzBaq+Qv62EHwpH9sUZG14mFHdHknDksA-H0mCUlEiUSUAJSUVh30aUR75Hd76n8DUmNbcmQV8moQ581iSmS43Qc5xYPNjcXHs7tHS6IZbt7sBHeg7RUc4Q0hpJCwU7nCUiPQs9IavCs60j2HuJIYIc1DTGFQ1hq6zha6l7mEG6spvILByIeyqR29oauIoxesFw6a51B7oGQzAWYLgWObQWYy+HvaOy0g+QDzUh1JXQk69t7HmrUhyQ-RBz-nTJIX1ZLYwAgXOkgWRmMGV1ylBh+gm7HKLqS57MFgdBNKPi+hvwmciXoW7awWqyAXSWoWySPbJKEXNmxAINy4FAHoJrnprrVgSa407AuEbEkSGg0BuJaNlo1cvVjrRnhIxQRYHj36i5P71NBzkhdBUtRUa41WNWoyoH+W1rGh7X3atXUGf8AnxjcIXsqcikbG-cUZ10JaUh9c1ghQfwoxSAIw+AAAJNAbJgu8+gV6NuNhNsAD1p+768wXMCueQbQLqTk-mEC4TKN7ctNxNtRlh4y-cMtmN+N7JzN248YJIClGnPGt0WxtM-2fmDjGylGVwfUPgKw+AcISscVhY33WIr51YVu-6iDMObgCdrkHjeNGokkCeccKArSriF62wsACdvOCwPt+4I2kNKdnjXUIYMiZ6L8ITHiiCqaJ2e5hMN8WQFGX5r8xSp8cW4kHk0VXhefP6GKJiCqCdt7YR-bfWn8y9tIP98-SQM-aSe9jaUqED8qWaeaRafeCdqeUGtdCQR6UKx0zQAaKECkfmMsbd4DraaaQGYGMGSGCAaGACXD6we4qFACr6ImfqdUcjuoqjqcHd0yR90D2AEgSoXYoIXDjd1KFyPs+y2DgvNozGJDju6XC9MdCd4PQVbmfmfGpZXMakKVscuxJ1dyz9ERb9aqbTu6s1fTjGK1bkMsJMoTtKNSGpjT0dMjRBVuNePWbTqke4gHbyITmFDMxAB0IYCuPnMVC5ni1Nb9FeUhdeDuX1bT8N3OVYULomKR-EZhCwWZikRMyBEiyz-pBBZLtuVL8hHhpaCdu6vjgpNMkbM1njUVQA7TQqeeLz0jYhJBaru+WAcZSgBrjGAppQFrthNr3EZhKV+wUxbr8PcrjFXzm+MhMyWOmGf8Br3ms1aDQBC932cpoVSqrZNYNDZxLFY5HRbTnQbBvTi1Qz+SWES143WNO1AB89bzq7wZbFdJfzWzmEnBhzy1d50wV7KJESGQ6SMYS7gZFJRlH5B-KADLpMeethMLvLuDZF6xd7rQT7+Hj5P7m7plDgiAbTsEbsTtk9FTQcNZI10J618-CQInzFEnpHzbuOnbr1x7ESMg7yPZ7MTMbMEpZ7IQmzAJUUChlb+la7zn4bhctH9UDHiYXL2FCJVwoVJ6DzmX3pH7puNta9b1Cn3n6HUEIkEtFMc9swMkEj--eQb54UbOKwSkNnn9DND2k39Ls3gxdjoYUNN8byW35iiHvOKJdMJwGJ3kd3o3rDb3kF7E1H3352Y9McMsLQH6bLI7ixdqDIfjRtQTWPzDL37NQDbWQ9pUBUqkMwbdKkKtWQWNLUXXRq4TkdPrw3kvrNadN1gM5P-V5jPODU1YeNUbEjx6D0LQGK8YUDeL2Xy9Cjbv29MCLb+Ow9t8f2Q8-XLMAYKteItMMYFuvoNv77jvjDRfqjNiEbhrtPkczPs9oBCJGER3xrhESrTzvTQHlP3oaSEXJTfsVTJ9lLAahWWcJCXGkDK5nx-MLOUHNdhubVBKe2gRTJjgAH08hcfQa9raCexYQvufmGGJqzXw3gX2zsa4KPkcDZhpA5nAhl-HsTEgJcvUJutoCBxy4YKkAJXHxQa7uFf4AUPQnoDRxG52o2LN8JJCloEtX8ChQ9gMGC4Ks3wVBWxjY2pwCwQ0M2UkPQR8LsEUeE7EeEmQByqQ5BYBCRgKko4L4LOWkBAkgUgBaDPYxIAKAME-KfMaClIGtO3iSLSAUi6g0wjkVeoHtv+iAXMhYAeJ6Cqe8gzkhqAFguwVg+EUwc6xrLacA8clC6tB3kHph8kI0EroUxlp7tSiexIogQE4GCFQuiQ78vINngukVg0IMYNEMAZiUfS1xcDvChzyF8sKofTss9mzI69rEMfUClOVqHolE+9XXwQgHFAk1S8R5Boo6V7ZkEAKvIHQEKA-Yy1ehxpSUmaXnI4dBhU8HWqJD1rFCmiP8ZhKpHqJzDHqltHoUWWNIOs1hA-cal2XnaNpA6jmJokgKLxvh0g0vXAbpXDJ1lSSJZMsgrlw43CESxFPGA8PUzihwU+MWxI6lJCQCYhOlRYUnH+JLQY63PHwVcMEYQcNMCIKZsVxLj8xxg-5VTN5G1IjQZat5bqn+G07-YJupAgzk52RwDAiQheZqjlmhGkjNoVFGCqOzRGFoACCQr9gbRYorBuBPJGHIf3eGeUwyAw7kZF2soCgCI2cHEUfmeyi4vwLIkticJ0qdVUq95IqnkMGHZwVetpNYJdRg7KUf4FHTMF5lOzdDnqXg-dmrT1HSjNCXoE5tK0hJzEGsegXODiwUBEUUOKNFmi7Qsy+krB6oOHPsxNG2MRggwOIpaJOw+YnqsNIMRjT6Ewsk+WgoKuGKKHfsiakVE2pCAeowjqhgYuWsKVVrJjn2bKV3BIV8hOo66bza6vhVYR3V0w4A44U7QFKs1gxbtXlv3ypYgopgKQVhKXiBFB1DaTgMIbPHHAgEP+GopMaWONJdijgyI7bqiP7HJQ2iYQyZsU0VGG04Qf7eDEoImLLcAxOlaOgmxRHad6C8gXsN6A7bWhGx1gVhMqXHCPBngyzfpjkmIGFppwGoa0FBx2GN4vQxtRxjVRGxFiCSVzGzoMMbSFd-x-I00SQVjRSsUY0IwClUMgkrMOGHjZJuB0kC-w3Ki9IWs4XTBlIkUwE0nHrzWpXNBm+jShJcPXHXQuBbg2kFT2KSN4XedAybk4EYEn8yKNEpJkMyaZpNl2SYOEIayInL0OJQ4+Zq6EWYQT+JWExRp4y56rjcOUgnCLlBNZiMOJIdJodizsC6kPxbjeBmsxqA384Jk4BCV20P7EhssF1cXCmEjaCt1YDXXyBCDTAiQ3QO-MQntgmAixmqb4axH-Dn4CsgWZJLElKMYkGI6sHk7zNv32ERcFi1wEXKy3hINp3h3LElmSwYnfiQQe+Cxqi3sEYtLgsBEAXViSJcVOWpbFyTyxFa5SqxcQEtE1TTCGJnKSU30MKAhBpTwBGUu1ndyHEPEcu9oDXquzaEpB8eqZVIHa01Z987uCmIaQTxGlJSRIQ4oVL5GrhCJQK6rYVlq206qgUWMVaxgLGIhODrEXXZFM5NTYNs1xeU+IGKGDR-xQQwfWduEzrRuE2i8IClKFNMhy4iAKAXyhGGuTadf+Y4RwMNPC65gRyeFN0LCG6a-RB2QAA */
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
                { src: "timeoutTimer", data: (ctx) => ({ timeout: ctx.info.params.idleTimeoutStandby }) },
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
            initial: "enterPasscodeInit",
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
                        { src: "sendPasswordMessage", onDone: { actions: assign({ delivPassword: (_, e) => e.data }) } }
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
                    entry: raise((ctx, e) => ({ type: "sendMission", missionState: "return", api: true, meta: ctx.mission.meta })),
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
                                    target: "#global.refill",
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