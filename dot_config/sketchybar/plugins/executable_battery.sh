#!/bin/sh

percent="$(pmset -g batt 2>/dev/null | grep -o '[0-9][0-9]*%' | head -1 || true)"
if [ -n "$percent" ]; then
  sketchybar --set "$NAME" label="BAT $percent"
else
  sketchybar --set "$NAME" label="BAT --"
fi
