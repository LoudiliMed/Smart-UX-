const corsAnywhere = require('cors-anywhere');
corsAnywhere.createServer({
  originWhitelist: [],
  requireHeader: [],
  removeHeaders: []
}).listen(8080, () => {
  console.log('Proxy running on port 8080');
});
