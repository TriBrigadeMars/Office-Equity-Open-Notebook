const { isHttpReady } = require('../start-services');

async function testHttpReady() {
  const isReady = await isHttpReady('http://127.0.0.1:0/not-a-port', 50);
  console.log('isReady expected false: ', isReady === false);
  if (isReady !== false) {
    process.exit(1);
  }
}

testHttpReady().then(() => console.log('Done'));
