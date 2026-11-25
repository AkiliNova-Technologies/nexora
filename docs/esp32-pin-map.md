# ESP32-S3 pin map and rewiring guide

The Smart Estate controller is an **ESP32-S3 N16R8** (ESP32-S3-DevKitC-1 style board, CH343 USB-serial, `/dev/ttyACM0` on Linux). It uses 20 GPIO pins: 4 lights, 2 fans, a siren, a 4-wire gate stepper, an LED strip, 2 PIR sensors, 2 ultrasonic sensors and 2 gate limit switches. Every pin number below matches the production firmware (`smart-estate-firmware/include/SmartEstatePins.h`) and the diagnostic sketch `~/Arduino/SmartEstate_Gate_Test/SmartEstate_Gate_Test.ino`. If that sketch changes, update this page to match.

The classic-ESP32 pin map was retired on 25 Nov 2026 when the controller changed to an S3. On the S3, GPIO22–25 do not exist, and GPIO26–37 are wired to the flash and PSRAM chips, so the old pins could not be reused. The old sketch is kept at `~/Arduino/backups/SmartEstate_Gate_Test.classic-esp32.ino`.

Pin numbers are **GPIO numbers**: the labels printed beside each header pin. The *Header position* column counts pins from the end nearest the USB connectors on a DevKitC-1 (pin 1 = 3V3 on the left header, GND on the right). Clone boards can differ, so trust the printed label over the position.

For the commissioning order and safety requirements, see [hardware-commissioning.md](hardware-commissioning.md).

## Pin assignments

| GPIO | Header position | Connected to | Direction | Notes |
| --- | --- | --- | --- | --- |
| 1 | Right 4 | Ultrasonic H1 — TRIG | Output | |
| 2 | Right 5 | Ultrasonic H2 — TRIG | Output | |
| 4 | Left 4 | House 1 Light 1 | Output | Active HIGH |
| 5 | Left 5 | House 1 Light 2 | Output | Active HIGH |
| 6 | Left 6 | House 2 Light 1 | Output | Active HIGH |
| 7 | Left 7 | House 2 Light 2 | Output | Active HIGH |
| 8 | Left 12 | PIR 1 — OUT (estate perimeter) | Input | Perimeter zone |
| 9 | Left 15 | PIR 2 — OUT (inside House 1) | Input | H1 zone |
| 10 | Left 16 | Siren driver | Output | Active HIGH |
| 11 | Left 17 | Fan driver (House 1) | Output | Active HIGH |
| 12 | Left 18 | Big fan driver (estate) | Output | **Active LOW**: LOW = on |
| 13 | Left 19 | LED strip DIN (SK6812 RGB, 60 LEDs) | Output | Data line, GRB colour order |
| 15 | Left 8 | Gate stepper driver — IN1 | Output | Stepper coil |
| 16 | Left 9 | Gate stepper driver — IN2 | Output | Stepper coil |
| 17 | Left 10 | Gate stepper driver — IN3 | Output | Stepper coil |
| 18 | Left 11 | Gate stepper driver — IN4 | Output | Stepper coil |
| 39 | Right 9 | Gate limit switch — OPEN | Input | Production firmware only; fit a pull-up/down resistor |
| 40 | Right 8 | Gate limit switch — CLOSED | Input | Production firmware only; fit a pull-up/down resistor |
| 41 | Right 7 | Ultrasonic H2 — ECHO | Input | **Through a voltage divider** (5 V → 3.3 V) |
| 42 | Right 6 | Ultrasonic H1 — ECHO | Input | **Through a voltage divider** (5 V → 3.3 V) |

Keep the stepper order: IN1→15, IN2→16, IN3→17, IN4→18. The firmware expects it, and swapping two wires makes the motor buzz instead of turning.

**Spare pins** for future devices: GPIO14, 21 and 47.

**Do not connect anything to these pins:**

| GPIO | Why |
| --- | --- |
| 0, 3, 45, 46 | Boot-strapping pins: they decide how the chip starts. GPIO0 is the BOOT button |
| 19, 20 | Native USB D−/D+ |
| 43, 44 | USB-serial TX/RX (Serial Monitor and uploads) |
| 26–32 | Internal flash chip |
| 33–37 | Octal PSRAM on `R8` modules (N8R8, N16R8) |
| 38 or 48 | On-board RGB LED (48 on DevKitC-1 v1.0, 38 on v1.1) |

## Wiring by device

| Device | Signal wire(s) → ESP32-S3 | Power | Ground |
| --- | --- | --- | --- |
| Lights (driver/relay inputs): House 1 L1, L2; House 2 L1, L2 | IN1→GPIO4, IN2→GPIO5, IN3→GPIO6, IN4→GPIO7 | Module VCC 5 V | Common GND |
| House 1 fan (driver) | IN→GPIO11 | Driver VCC 5 V; fan from its own supply | Common GND |
| Estate big fan (active-LOW driver) | IN→GPIO12 | Driver VCC 5 V; fan from its own supply | Common GND |
| Siren (driver) | IN→GPIO10 | Siren from its own supply | Common GND |
| Gate stepper driver (likely ULN2003 + 28BYJ-48) | IN1→GPIO15, IN2→GPIO16, IN3→GPIO17, IN4→GPIO18 | Driver + motor 5 V external | Common GND |
| LED strip (SK6812 RGB, 60 LEDs) | DIN→GPIO13 | 5 V external | Common GND |
| PIR 1, perimeter (HC-SR501 type) | OUT→GPIO8 | VCC 5 V | Common GND |
| PIR 2, House 1 | OUT→GPIO9 | VCC 5 V | Common GND |
| Ultrasonic H1 (HC-SR04 type) | TRIG→GPIO1; ECHO→divider→GPIO42 | VCC 5 V | Common GND |
| Ultrasonic H2 | TRIG→GPIO2; ECHO→divider→GPIO41 | VCC 5 V | Common GND |

Echo divider for each ultrasonic: ECHO → **1 kΩ** → GPIO pin → **2 kΩ** → GND. The ESP32-S3 is a 3.3 V chip and its pins do not tolerate 5 V.

Module models marked "likely" or "type" are inferred from the firmware. Confirm them against the hardware.

## Power and ground

Power the heavy loads from an external 5 V supply, not from the board's 5V pin. All grounds must join at one point.

- **ESP32-S3 GND** → common ground rail. Without a shared ground, the signals have no reference.
- **External 5 V supply** → stepper driver, LED strip, fan and siren drivers. The motor and strip can draw more than 1 A, which causes brownouts and watchdog resets (`rst:0x10 RTCWDT_RTC_RST`) on USB power.
- **ESP32-S3 5V** → PIR and ultrasonic sensors only (a few mA each).
- **ESP32-S3 3V3** → nothing needs it in the current wiring.
- LED strip: put a 1000 µF capacitor across 5 V/GND and a 330 Ω resistor in series with DIN. The S3 drives DIN at 3.3 V. If the strip flickers or shows wrong colours, add a 74AHCT125 level shifter.

Open question: the exact light, fan and siren driver modules (relay or MOSFET) are not recorded in the firmware. Relay boards that need 5 V on their inputs may not switch reliably from 3.3 V.

## Arduino IDE settings

| Setting (Tools menu) | Value |
| --- | --- |
| Board | **ESP32S3 Dev Module** |
| Port | `/dev/ttyACM0` |
| Flash Mode | **DIO 80MHz** (confirmed working on this board's Boya flash chip; QIO is untested) |
| Flash Size | **16MB (128Mb)** |
| Partition Scheme | 16M Flash (3MB APP/9.9MB FATFS) |
| PSRAM | **OPI PSRAM** |
| USB CDC On Boot | Disabled (uploads and Serial Monitor go through the CH343 "COM" port) |
| Upload Speed | 921600 (drop to 115200 if uploads fail) |
| Erase All Flash Before Sketch Upload | Disabled (the flash was fully erased on 25 Nov 2026; enable only to clear old firmware) |

The module is an **ESP32-S3 N16R8**: 16 MB flash and 8 MB octal PSRAM. Octal PSRAM uses GPIO33–37, which is why the pin map avoids them.

The sketch refuses to compile for any other board, so a wrong board selection shows up as a compile error instead of a dead controller.

## Reconnect checklist

First flash the bare board, then add one device group at a time and test it from the Serial Monitor (115200 baud, Newline).

1. Connect the bare ESP32-S3 by USB only, upload the sketch, press RST and confirm `SMART ESTATE DIAGNOSTIC READY` in the Serial Monitor. If the upload hangs on `Connecting...`, hold **BOOT**, tap **RST**, then release BOOT.
2. Join ESP32-S3 GND to the common ground rail.
3. Connect the sensors: PIRs (8, 9), then the ultrasonics (TRIG 1/2, ECHO 42/41 through the dividers).
4. Connect the lights (4–7), then the House 1 fan (11) and the big fan (12).
5. Connect the siren (10). Use `SIREN MUTE ON` for quiet testing.
6. Connect the LED strip (13) with its external 5 V.
7. Connect the gate stepper last (15–18) with its external 5 V.
8. Run the full test sequence and check each device responds.

If the board boot-loops (`rst:0x10 (RTCWDT_RTC_RST)` repeating) with devices connected, disconnect the external loads and check that nothing is wired to a pin in the do-not-connect table.
