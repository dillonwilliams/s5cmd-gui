# s5cmd-gui: GUI wrapper for s5cmd

[s5cmd](https://github.com/peak/s5cmd) is a very fast tool for interacting with S3 (especially when uploading or downloading many small files), but it is CLI only. The goal of this repo is to provide a friendly desktop interface to `s5cmd`. 

This repo is a work-in-progress - it does *not* currently bundle `s5cmd`. On Mac, even if the Tauri DMG is trusted, the bundled `s5cmd` also has to be trusted, which seems to mean an integrated DMG will need a signing key to work.

## Demo

This video shows just how much faster using s5cmd via s5cmd-gui is vs the S3 web interface:

https://github.com/dillonwilliams/s5cmd-gui/assets/1835005/c58dee43-25c4-4f48-a0d3-34205f325286


## Other TODOs
- Logging, progress bars
- E2E tests
- tauri-action for build / packaging
