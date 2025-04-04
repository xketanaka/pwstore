const { contextBridge } = require('electron');
const pwstore = require(`${__dirname}/../pwstore`);

contextBridge.exposeInMainWorld('pwstore', {
  pwstore: pwstore,
  config: {},
});
