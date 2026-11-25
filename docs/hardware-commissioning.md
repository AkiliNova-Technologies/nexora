# Hardware commissioning gates

No physical readiness flag is enabled by this phase. Confirm the exact ESP32-S3 module, GPIO availability, voltage levels, drivers, fusing, grounds and load supplies first. Use the ESP32-S3 pin map in [esp32-pin-map.md](esp32-pin-map.md); keep its spare pins (GPIO14, 21, 39, 40, 47) free for future devices.

Commission in this order: network with actuator power isolated; individual lights; PIR warm-up/debounce; level-shifted ultrasonics; bounded fan and siren tests; SK6812 with confirmed pixel count/order/current limit; gate limits by hand; mechanically isolated gate calibration; finally supervised end-to-end commands.

GPIO0/3/45/46 are strapping pins and stay unconnected; GPIO26–37 belong to flash/PSRAM. ESP32-S3 pins are not 5 V tolerant, so ultrasonic echo must pass through a divider and not exceed 3.3 V. Gate motion requires both verified limits, calibrated travel and an emergency disconnect. Never infer position from motor steps.
