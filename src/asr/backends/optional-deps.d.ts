// Optional native dependencies. They are imported lazily via dynamic import
// at runtime; declaring them as ambient modules keeps tsc satisfied when the
// packages are not installed locally.
declare module "smart-whisper";
declare module "@ricky0123/vad-node";
