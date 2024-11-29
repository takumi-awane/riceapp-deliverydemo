# Rice App API

Contents
- [Conventions](#conventions)
- [API: General](#general)
- [API: Hardware](#hardware)
- [API: Navigation](#navigation)
- [API: Notification](#notification)
- [API: Multimedia](#multimedia)
- [API: Integration](#integration)
- [API: Socket.IO](#socketio)

## API revisions

- 2023-09-27:
    - add `xstateViz` capability to `init` (RiceOS 3.3.2)
    - change default locale to `en-HK` (RiceCore 4.63)
    - document `debugMode` query parameter

## Conventions

Unless otherwise specified:
- Request
    - Body (`application/json`)
- Successful response
    - Status `200`
    - Body (`application/json`, empty object `{}`)
- Error response
    - Status `500`
    - Body (`text/plain`, error message)

## General

### Query Parameters
- `debugMode=1` Parameter set if robot in debug mode (OS >= 3.0.7)

### `POST /api/init`

Return basic information for app

Optionally enable extra functionality provided by app

- Request
    - Body
        - `capability` object (Optional)
            - `intercom`: bool (app supports WebRTC 2-way voice call)
            - `broadcast`: bool (app supports WebRTC audio broadcast)
            - `xstateViz`: bool (request xstate visualizer, OS >= 3.3.2)
- Response
    - Body
        - `site` object
            - `id` string
            - `locale` string (default to en-HK)
            - `map`
                - `width` number (m)
                - `height` number (m)
                - `resolution` number (m/px, usually 0.05)
                - `points` object (see RiceMap data structure)
                - `regions` object (see RiceMap data structure)
                - `paths` object (see RiceMap data structure)
        - `robot` object
            - `id` string
            - `type` string (enum: rice, jasmine, portal)
            - `name` string (null if not set)
            - `riceOs` string (version)
            - `timezone` string (derrived from WAN IP address)
            - `debugMode` boolean (OS >= 3.0.7)
        - `params` object

### `GET /api/status`

Return robot's current status

- Response
    - Body
        - `charge` number (%)
        - `charging` boolean
        - `lid` string (`open`, `close`)
        - `eBrake` string (`release`, `latch`)
        - `lost` boolean (true when the robot is delocalized, will auto relocalized and become false within 5s)
        - `online` boolean
        - `fluidLevel` object (For disinfection robots only)
            - `low` boolean (deprecated)
            - `high` boolean (deprecated)
            - `value` number (0-100, OS >= 3.0)
        - `position` object (current position on map)
            - `x` number (m)
            - `y` number (m)
            - `theta` number (deg)
        - `motorShutdown` boolean (motor in protected state due to overload)
        - `currentGoal` string | null (name of the Current navigation goal, will be null if finished / idle)
        - `recordVideo`: object
            - `[source: string]`: boolean
        - `navigationState` enum (init, idle, active, parking, unparking, reparking, pc-capturing, mapping)
        - `waypointLastUpdate` number (Last updated time of waypoints stored in robot, have to call `GET /map-waypoints` AGAIN to sync with the robot if the value is changed, unit in ms)
        - `currentFloor` object
            - `boundBox` array[array[x,y]]
            - `name` string (optional)

### `POST /api/mission`

RiceCore: Set robot mission state

RFIS: Send job status (if enabled)

- Request
    - Body
        - `mission`: object | null
            - `id`: string (uuid for the corresponding mission, RFIS `jobId`)
            - `type`: string (`delivery`, `disinfection` or a custom mission type)
            - `state`: string (`start`, `code`, `return`, `end`, `error`, `move` or intermediate states)
            - `meta`: object (optional)
                - `from`: string (for `move` state)
                - `to`: string (for `move` state)

NOTE: When robot is not on a mission, set `mission` to `null`.

### `POST /api/local-storage`

Store any key-value pairs into a json file in the robot.
The size of the json file could not be larger than 10 MBs.


- Request
    - Body object
        - `data` object | null (if data is null, local storage is cleared, otherwise merged)

### `GET /api/local-storage`

Return saved Json.

- Response
    - Body object

### `POST /api/proxy`

Configure RiceApp data proxy for external TLS connections or serial communication

TCP endpoint: port 3100

WebSocket endpoint: port 3200

- Request
    - Body
        - `host`: string
        - `port`: number
        - `ca`: string (optional, PEM encoded)
        - `key`: string (optional, PEM encoded)
        - `cert`: string (optional, PEM encoded)
        - `rejectUnauthorized`: boolean (optional, disable CA verification)

OR

- Request
    - Body
        - `host`: string
        - `baud`: number

## Hardware

### `POST /api/lid` (Rice)

Open or closes the lid for delivery robots. (Rice)
Can only call when robot is `idle` or `parked`.

- Request
    - Body
        - `lid`: string (`open`, `close`)

### `POST /api/disinfection` (Jasmine)

Turns disinfector on or off

- Request
    - Body
        - `power`: number (0-100)

### `POST /api/ebrake` 

The robot won't release ebrake when there is other source of ebrake.

- Request
    - Body
        - `brake`: string (`release`, `latch`, `freewheel`)

### `POST /api/led` 

- Request
    - Body
        - `channels`: array of string (4 items, each base64 encoded pixel data in rgb888 order)

### `GET /api/wifi/scan`

Get desired ap strength from cached wifi scan result.
The scan will occurs periodically according to the interval set in robot config (default 10s) 
It is suggested to use ttl to prevent stale result.

- Request
    - Body
        - `ssid`: string[]
        - `ttl`: number (ms, optinoal)
- Response
    - Body
        - [ssid provided]: number | null (dbm, null when ttl not fulfill or ap cannot be found) 

## Navigation

### `POST /api/nav/goal`

Set navigation goal for robot.
Can only call when robot is `idle`, `parked` or `active`.

Several navigation profiles are supported:
- `normal`: follow settings from robot's config
- `narrow`: minimize allowed robot-to-wall distance, disable sonar & cliff detection
- `slow`: limit speed to lowest speed set in robot's config
- `depthCameraInterference`: disables negative depth (cliff) detection

The server will return 200 when:
- Robot reached goal
- A new goal is received
- Current goal is cancelled by `/api/nav/cancel`

The server will return 500 when:
- Failed to reach goal
- Delocalized
- Invalid navigation state

NOTE: Navigation may fail if path is blocked for too long, retry logic should be implemented for this call.

- Request
    - Body
        - `waypoint`: string | number[x, y, theta] (string = Waypoint ID)
        - `profile`: string (Optional, default `normal`)
        - `ignoreOrientation`: boolean (Optional)

- Response
    - Body
        - `message`: string `success | busy | cancelled | failed`



### `POST /api/nav/park`

Perform parking sequence.
Can only call when robot is `idle`.

NOTE: Make sure robot is in front of the docking station before performing parking sequence!

### `POST /api/nav/cancel`

Cancel navigation / parking sequence

### `POST /api/nav/position`

Override robot's current position.
Can only call when robot is `idle`, `parked`, `delocalized`.

- Request
    - Body
        - `waypoint`: string | number[x, y, theta] (string = Waypoint ID)
        - `useRobotOrientation`: boolean (Optional)


### `GET /api/map/image`

Return navigation map as PNG image.

- Query parameter
    - `currentFloor` boolean (filter only current floor)

- Response
    - Body (image/png)

### `POST /api/compute-floor`

Return meta of the floor which the input coordinate belongs.

- Request
    - Body
        - `coordinate`: array[number] ([ x, y ]) (meter, meter)

- Response
    - Body 
        - `id`: string
        - `name`: string
        - `meta`: object

### `POST /api/plan-path`

Plan path to goal.

- Request
    - Body
        - `start`: string (Waypoint name)
        - `end`: string (Waypoint name)

- Response
    - Body array[object]
        - `x` number
        - `y` number

## Notification

### `POST /api/email` (Authorized app only)

Sends an email to a specified recipient from core@ricerobotics.com

- Request
    - Body
        - email: string
        - subject: string
        - body: string
        - attachmentList: array of object
            - filename: string (filename with extension)
            - data: string (base64 encoded)
            - contentType: string (mime type, e.g. "image\png", "image\jpeg")


### `POST /api/message` (Authorized app only, SMS costs apply)

Sends a message via the specified platform.

- Request
    - Body
        - `platform`: string (`sms`, `whatsapp`)
        - `phoneNumber`: string
        - `message`: string
        - `senderId`: string
        - `isCritical`: boolean (set true to track sms delivery status, default false)

### `POST /api/alert`

Trigger RiceCore alert

- Request
    - Body
        - `alarmType`: string
        - `message`: string

## Multimedia

### `POST /api/video/record`

Start / stop video recording

NOTE: The external hard drive must be formatted as exfat and the label of the hard drive must be 'RICE'. (exactly 4 capital letters)
If there is no available space in the hard drive, no new video will be recorded.
Therefore, tranfering the video recorded and cleanup the hard disc on a regular basis is recommended.

- Request
    - Body
        - `record`: boolean

### `POST /api/video/detect` 

Start / stop video object detection

NOTE: CPU must be Gen 9 or higher to enable object detection

- Request
    - Body
        - `detect`: boolean
        - `source`: string (front only)

### `POST /api/video/stream`

Live stream video from local cameras via WebRTC

- Request
    - Body 
        - `offer`: RTCSessionDescription (See https://developer.mozilla.org/en-US/docs/Web/API/RTCSessionDescription)
            - `type` string
            - `sdp` string
            - `source` string (optional, default front)
            - `iceServers` string[] (optional)

- Response
    - Body: RTCSessionDescription

### `POST /api/video/snapshot`

Take a photo in jpeg format from the camera on the robot

- Request
    - Body
        - `source`: "rear" | "front"
        - `quality`: number (1 - 100)

- Response
    - Body binary

### `POST /api/sfx` 

Play sound effect on robot, using the name of sfx file in the sfx directory of rice app.

- Request
    - Body
        - `sfx`: string (name of sfx file)

### `POST /api/user-content`

Upload user-generated content to RiceCore.

- Request
    - Body
        - `mime`: string
        - `data`: string (base64)
- Response
    - Body
        - `token`: string (JWT to access data from RiceCore)

## Integration

### `POST /api/elevator/state`

- Request
    - Body
        - `integration`: string
        - `car`: string (Optional, all cars by default)

- Response
    - Body object
        - `<carId>`: object
            - `lastUpdate`: number (Unix timestamp ms)
            - `state`: string (enum `unavailable`, `standby`, `dispatching`, `boarding`, `calling`, `alighting`, `trapped`)
            - `door` object
                - `<doorId>` object
                    - `clear`: boolean (Safe to enter/exit via this door)

NOTE: Robot should act according the elevator's current state, refer to state machine in `ElevatorAPI.md`.

NOTE2: While `boarding` or `alighting`, robot should repeatedly send the `open` command to reset the timeout (and keep the doors open if supported).

NOTE3: When the elevator only has 1 door, the doorId is always `0`.

### `POST /api/elevator/command`

- Request
    - Body
        - `integration`: string (RiceCore: Integration ID)
        - `command`: string (`dispatch`, `call`, `open`, `close`)
        - `boardingZone`: string (Required for `dispatch` command)
        - `alightingZone`: string
            - Destination Control: Zone ID
            - Conventional `dispatch`: `up`, `down`, `access`
            - Conventional `call`: Floor ID
        - `car`: string (Optional, only required for conventional elevators)
        - `rpcTimeout`: number (Optional, ms, RiceCore only)

- Response
    - Body object
        - `car`: string (From `dispatch` only)

NOTE: The `alightingZone` parameter is multi-function depending on elevator type:
- Destination-Control elevator: Destination floor
- Conventional elevator (shared access): `up` or `down`
- Conventional elevator (exclusive access): Must be `access`

## Socket.IO

### `GET /socket.io`

Socket.IO events

- RiceOS > App
    - `position`: object
        - `x` number (m)
        - `y` number (m)
        - `theta` number (deg)
    - `wifi`: object
        - `[ssid: string]`: number (%)
    - `water`: true (Portal, only emit once when water detected)
    - `delocalized`: true (only emit once when delocalized, either simultaneous displacement larger than threshold / covariance larger than threshold) 
    - `ring` any (sends ring signal to dashboard)
    - `sdp` RTCSessionDescription (RiceOS 2.106)
        - `id` string
        - `type` string (offer)
        - `sdp` string
        - `iceServers`: string[]
    - `webhook` object (RiceOS 3.0.11, 3rd party events)
        - `type` string
        - Other type-specific keys
- App > RiceOS
    - `sdp` RTCSessionDescription (RiceOS 2.106)
        - `id` string
        - `type` string (offer)
        - `sdp` string
- App > App (Used to communicate between different browers, i.e. App <-> Eye. Messages published to this channel will be broadcasted to all clients)
   - `app`: any

