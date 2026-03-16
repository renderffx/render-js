import serverEntry from 'virtual:vite-rsc-render/server-entry';

export { serverEntry as unstable_serverEntry };

export async function INTERNAL_runFetch(
  env: Readonly<Record<string, string>>,
  req: Request,
  ...args: any[]
) {
  return serverEntry.fetch(req, ...args);
}

export default serverEntry.defaultExport;
