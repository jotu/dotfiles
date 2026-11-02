# Keep the Pi safety gate local and best-effort

To let agents complete task-scoped local work while requiring explicit approval for remote, authenticated, destructive, and publishing actions, this repository owns a best-effort Pi safety gate instead of adopting a third-party gate package. Pi’s native confirmation remains authoritative; TUIOS and Herdr observe gate state without becoming approval channels. The gate is not an operating-system security boundary, and its policy continues to apply if either observer integration is unavailable.
