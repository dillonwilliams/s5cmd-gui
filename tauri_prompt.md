A Tauri + React app that offers a filesystem interface to S3 using `s5cmd`. The filesystem interface should use the `chonky` React library with drag-and-drop enabled. The only visible UI elements besides the S3 browser should be a tool to select and configure the S3 bucket and a tool to configure and select the S3 secrets.

Important Details:
- Typescript should be used. 
  - For example, `ChonkyActions` should be used for actions emitted from Chonky
- JSX for all React components should be filled out as much as possible. Types should also be filled out as much as possible. 
- The s5cmd interface should include command file support with the `s5cmd run`, receiving a list of commands.
- Chonky delete should be implemented with `s5cmd rm`. Chonky rename should be implemented with `s5cmd mv`. 
  - However, when the user transfers a directory or multiple files, `s5cmd run` instead of `s5cmd cp` should be used.
- Configuration for buckets and secrets should be stored in LocalStorage.
- All calls to `s5cmd` need to be routed through the Tauri invoke API, which calls a `run_s5cmd` command on the Tauri backend.
- The buckets in the bucket config tool come from the `s5cmd ls` command. Multiple secrets are possible. The buckets and the file browser are refreshed when a new secret is selected. 
