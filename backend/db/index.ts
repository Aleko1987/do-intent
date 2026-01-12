// DB disabled on Render image deploy - Encore SQL proxy initialization removed
const dbStub = new Proxy({} as any, {
  get() {
    throw new Error("DB disabled on Render image deploy");
  },
});

export default dbStub;
