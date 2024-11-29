# Start in development
- `yarn` to install dependencies
- `yarn dev` to run app on localhost

# Waypoints in RiceMap
- Assign as many waypoints you like in RiceMap, but there must be 1 home and 1 charger in each region
- Indicate charger by stating `"charger" : true` in waypoint.meta
- Indicate home by stating `"home" : {}` in waypoint.meta
- Charger and home is expected to be the same waypoint (logic for different waypoints is temporarily suspended)
- Indicate delivery point by stating `"delivery" : { "destination": true }` in waypoint.meta

# Multi-floor traversal
- When robot realises the point it's trying to reach is in different floor, it automatically takes elevator
- If elevator support is required, map must divide each floor into Regions, and name each floor as 0, 1, 2...
- Each elevator must be marked with unique identifier within its elevator group e.g. `"elevator": "A"` in the waypoint meta, that ID should also be what the elevator API returns when calling for elevator
- Elevator must be accompanied with its boarding and alighting zone, marked with the corresponding elevator ID e.g. `"boarding": "A"` in the waypoint meta
- Lift lobby is also needed, indicated by `lobby: true`
- Multiple elevators can be grouped together, indicated by the `integrationId`
- example: `elevator: { integrationId: "iCiticTower", car: "A" }` or `elevator: { integrationId: "iCiticTower", boarding: "A" }` or `elevator: { integrationId: "iCiticTower", lobby: true }`

# Disinfection task completion and charging logic
Upon task completion always go Home

- After short inactive period, head back to charger
- Upon being waken from charging, user may refill or perform quick disinfection (will head back to charger after inactivity)

# Delivery task completion and charging logic
Upon task completion always go to Home

- After short inactive period, head back to charger
- Upon being waken, head to home point if charge is more than min battery charge requirement
- If mission not started by user, after a short inactive period, head back to charger

# Error handling
- When tasks fails, user will be routed to ManualReboot page
- Alerts will be sent to RiceCore
- Corresponding errors are: nav-blocked, delivery-failure, sms-failure
- Details of the error will be embedded in `message: string` field
- Set logic of sending error to users on RiceCore

# App param
- `password`: `string (len=4)` (default is `"2357"` if not specified)
- `integrationTest`: `boolean` Factory testing mode
- `navTimeoutIntegrationTest`: `number` (s, default 30min)
- `navTimeoutDisinfection`: `number` (s, default 10min)
- `navTimeoutDeliver`: `number` (s, default 1hr)
- `navTimeoutReturn`: `number` (s, default 1hr)
- `idleTimeoutStandby`: `number` (s, default 5min, setting too long of a timeout here may cause robot to run out of battery in standby state)
- `idleTimeoutItemPlace`: `number` (s, default 10min)
- `idleTimeoutWaitReciepient`: `number` (s, default 30min)
- `idleTimeoutItemCollect`: `number` (s, default 5min)
- `minBatteryWakeup`: `number` (%, default 30, battery % required to wake up from docked state)
- `minBatteryDisinfection`: `number` (%, default 30, battery % required to start disinfection)

# Optional soundtrack
An optional soundtrack is supported for disinfection task.
The app will look for `/sfx/disinfection.ogg` and play it on loop if it exists.
This file does not exist by default, it's possible to add it via an asset resource.