#!/bin/sh

volume="$(osascript -e 'output volume of (get volume settings)' 2>/dev/null || true)"
if [ -n "$volume" ]; then
  sketchybar --set "$NAME" label="VOL $volume%"
else
  sketchybar --set "$NAME" label="VOL --"
fi
