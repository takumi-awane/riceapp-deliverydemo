import { Observable, Subscriber, timer } from "rxjs";
import  { DateTime } from "luxon";
import { Schedule } from "../xstate.ts";

export default class Scheduler {
    schedule: Schedule[];
    generators: Generator<number>[];
    nextFromEach: number[];
    observable: Observable<number>;
    upcoming: number[] = [0, null]; //[timestamp, index]

    constructor(schedule: Schedule[]) {
        this.schedule = schedule;
        this.generators = [];
        this.nextFromEach = Array(schedule.length).fill(0);
        for(let i = 0; i < schedule.length; i++) {
            this.generators.push(this.scheduler(schedule[i]));
            this.nextFromEach[i] = this.generators[i].next().value;
        }
        this.observable = new Observable((subscriber)=>{
            this.emitCycle(subscriber);
        })
    }

    emitCycle = (subscriber: Subscriber<number>) => {
        if (this.schedule.length === 0) {
            subscriber.complete(); // complete subscription if schedule is empty
            return;
        }
        const now = Date.now();
        if (now > this.upcoming[0]) {
            this.upcoming = this.nearestDisinfection().next().value;
        }
        const out = this.upcoming;
        const remaining = out[0] - now;
        timer(remaining).subscribe(x => {
            subscriber.next(out[1]);
            this.emitCycle(subscriber);
        })
    }

    *scheduler(sched: Schedule): Generator<number> {
        while(true) {
            if(!sched.dt) {
                sched.dt = DateTime.now().set({
                    hour: sched.startTime[0],
                    minute: sched.startTime[1],
                    second: 0,
                    millisecond: 0,
                });
                if(sched.dt > DateTime.now()) {
                    sched.dt = sched.dt.minus({ day: 1 });
                }
            }
            do {
                sched.dt = sched.dt.plus({ day: 1 });
            } while(!((1 << (sched.dt.weekday - 1)) & sched.weekdays));
            yield sched.dt.toMillis();
        }
    }

    replace(idx: number) {
        let newTs = this.generators[idx].next().value;
        this.nextFromEach[idx] = newTs;
    }

    *nearestDisinfection(): Generator<number[], never> {
        while (true) {
            const minTs = Math.min(...this.nextFromEach);
            const idx = this.nextFromEach.indexOf(minTs);
            this.replace(idx);
            yield [minTs, idx];
        }
    }
}

