import { Service } from "encore.dev/service";

export default new Service("frontend");

// Static asset serving disabled - dist directory no longer present
// export const assets = api.static({
//   path: "/frontend/*path",
//   expose: true,
//   dir: "./dist",
//   notFound: "./dist/index.html",
//   notFoundStatus: 200,
// });