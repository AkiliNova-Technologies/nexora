# Hardware commissioning gates

No physical readiness flag is enabled by this phase. Confirm the exact ESP32 board, GPIO availability, voltage levels, drivers, fusing, grounds and load supplies first. Preserve GPIO16/17, 18/19, 13, 23, 25/26/27/14, 32/33, 4/34, 5/35, 22 and 36/39.

Commission in this order: network with actuator power isolated; individual lights; PIR warm-up/debounce; level-shifted ultrasonics; bounded fan and siren tests; SK6812 with confirmed pixel count/order/current limit; gate limits by hand; mechanically isolated gate calibration; finally supervised end-to-end commands.

GPIO4/5 are strapping pins. GPIO34/35/36/39 are input-only and need external biasing; ultrasonic echo must not exceed 3.3 V. Gate motion requires both verified limits, calibrated travel and an emergency disconnect. Never infer position from motor steps.
