module.exports = [
  {
    name: "main bundle (initial JS)",
    path: "dist/assets/index-*.js",
    limit: "200 kB",
    gzip: true,
  },
  {
    name: "recharts chunk (lazy)",
    path: "dist/assets/CategoricalChart-*.js",
    limit: "85 kB",
    gzip: true,
  },
];
