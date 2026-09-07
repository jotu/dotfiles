#!/bin/sh

# SketchyBar passes custom event variables as environment variables.
workspace="${NAME#space.}"
focused="${FOCUSED_WORKSPACE:-$(aerospace list-workspaces --focused 2>/dev/null || true)}"

if [ "$workspace" = "$focused" ]; then
  sketchybar --set "$NAME" \
    background.drawing=on \
    background.color=0xff363a4f \
    label.color=0xff8aadf4
else
  sketchybar --set "$NAME" \
    background.drawing=off \
    label.color=0xffb8c0e0
fi
