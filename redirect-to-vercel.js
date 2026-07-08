(function () {
  if (location.hostname.endsWith('github.io')) {
    location.replace(
      'https://start-reposi.vercel.app' +
      location.pathname.replace('/start_reposi', '') +
      location.search +
      location.hash
    );
  }
})();
